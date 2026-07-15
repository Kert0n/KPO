#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { PDFDocument } from 'pdf-lib'
import { contentPagesFor } from '../.vitepress/shared/content/contentCatalog.ts'
import { buildPdfPagePlan } from '../.vitepress/shared/content/contentPolicy.ts'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const remote = process.argv.includes('--remote')
const configuredBaseUrl = process.env.KPO_PDF_BASE_URL
const localBaseUrl = 'http://127.0.0.1:4175/KPO/'
const outputDirectory = join(root, 'output', 'pdf')
const pagesDirectory = join(outputDirectory, 'pages')

const PDF_ROUTES = buildPdfPagePlan(contentPagesFor('pdf'))

if (remote && !configuredBaseUrl) {
  throw new Error('KPO_PDF_BASE_URL is required with --remote')
}

const baseUrl = normalizeBaseUrl(configuredBaseUrl ?? localBaseUrl)
let previewProcess
let browser

try {
  await prepareOutput()

  if (!configuredBaseUrl) {
    previewProcess = startPreview()
    await waitForHttp(localBaseUrl)
  }

  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1400 },
    deviceScaleFactor: 1
  })

  await context.addInitScript(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem('kpo:code-language', 'kotlin')
    window.localStorage.removeItem('kpo:playground-mode')
    document.documentElement.dataset.kpoLang = 'kotlin'
  })

  const page = await context.newPage()
  const pageFiles = []

  for (const { route, file: fileBase } of PDF_ROUTES) {
    const url = new URL(route, baseUrl).toString()
    const pageFile = join(pagesDirectory, `${fileBase}.pdf`)

    process.stdout.write(`Exporting ${route || '/'} -> ${pageFile}\n`)
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.evaluate(() => {
      window.localStorage.setItem('kpo:code-language', 'kotlin')
      window.localStorage.removeItem('kpo:playground-mode')
      document.documentElement.dataset.kpoLang = 'kotlin'
    })

    await page.locator('.vp-doc').first().waitFor({ state: 'attached', timeout: 30_000 })
    await waitForMermaid(page, route)
    await waitForMathJax(page)
    await page.emulateMedia({ media: 'print' })

    await page.pdf({
      path: pageFile,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '14mm',
        right: '12mm',
        bottom: '14mm',
        left: '12mm'
      }
    })

    pageFiles.push(pageFile)
  }

  const outputFile = join(outputDirectory, 'kpo-course.pdf')
  const totalPages = await mergePdfFiles(pageFiles, outputFile)

  process.stdout.write(`\nExported ${pageFiles.length} routes\n`)
  process.stdout.write(`Total PDF pages: ${totalPages}\n`)
  process.stdout.write(`Output: ${outputFile}\n`)
} finally {
  if (browser) await browser.close()
  if (previewProcess) await stopPreview(previewProcess)
}

async function prepareOutput() {
  await rm(outputDirectory, { recursive: true, force: true })
  await mkdir(pagesDirectory, { recursive: true })
}

function startPreview() {
  const vitepressBin = resolveVitePressBin()
  const child = spawn(vitepressBin, ['preview', '--host', '127.0.0.1', '--port', '4175'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  child.stdout.on('data', (chunk) => process.stdout.write(`[vitepress] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[vitepress] ${chunk}`))
  child.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      process.stderr.write(`[vitepress] preview exited with code ${code ?? signal}\n`)
    }
  })

  return child
}

function resolveVitePressBin() {
  const extension = process.platform === 'win32' ? '.cmd' : ''
  const bin = join(root, 'node_modules', '.bin', `vitepress${extension}`)
  if (!existsSync(bin)) throw new Error(`vitepress binary not found: ${bin}`)
  return bin
}

async function waitForHttp(url) {
  const deadline = Date.now() + 30_000
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await delay(500)
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'no response'}`)
}

async function waitForMermaid(page, route) {
  await page.waitForFunction(
    () => {
      const diagrams = [...document.querySelectorAll('.kpo-mermaid')]
      return diagrams.every((diagram) => {
        return diagram.querySelector('svg') || diagram.querySelector('.kpo-mermaid__error')
      })
    },
    null,
    { timeout: 30_000 }
  )

  const errors = await page.locator('.kpo-mermaid__error').evaluateAll((nodes) => {
    return nodes.map((node) => node.textContent?.trim().replace(/\s+/g, ' ') ?? '')
  })

  if (errors.length > 0) {
    throw new Error(`Mermaid render failed on ${route}: ${errors.join(' | ')}`)
  }
}

async function waitForMathJax(page) {
  await page.evaluate(async () => {
    const mathJax = window.MathJax
    if (mathJax?.startup?.promise) await mathJax.startup.promise
    if (typeof mathJax?.typesetPromise === 'function') await mathJax.typesetPromise()
  })
}

async function mergePdfFiles(pageFiles, outputFile) {
  const merged = await PDFDocument.create()
  merged.setTitle('КПО — конспект курса')

  for (const pageFile of pageFiles) {
    const source = await PDFDocument.load(await readFile(pageFile))
    const copiedPages = await merged.copyPages(source, source.getPageIndices())
    for (const copiedPage of copiedPages) {
      merged.addPage(copiedPage)
    }
  }

  await writeFile(outputFile, await merged.save())
  return merged.getPageCount()
}

async function stopPreview(child) {
  if (child.exitCode !== null) return

  child.kill('SIGTERM')
  await new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolvePromise()
    }, 3_000)

    child.once('exit', () => {
      clearTimeout(timer)
      resolvePromise()
    })
  })
}

function normalizeBaseUrl(value) {
  return value.endsWith('/') ? value : `${value}/`
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}
