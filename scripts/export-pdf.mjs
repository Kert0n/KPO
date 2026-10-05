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
const A4_MM = { width: 210, height: 297 }
const MARGIN_MM = { top: 14, right: 12, bottom: 14, left: 12 }
// Печатная область страницы в CSS-пикселях (96 dpi): на этой ширине Chrome
// раскладывает текст при печати, по этой высоте делит его на страницы.
const PRINT_AREA = {
  width: Math.floor(mmToPx(A4_MM.width - MARGIN_MM.left - MARGIN_MM.right)),
  height: Math.floor(mmToPx(A4_MM.height - MARGIN_MM.top - MARGIN_MM.bottom))
}

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
    // Язык кода и выключенный Playground выставляет init-скрипт контекста перед каждой навигацией.
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('.vp-doc').first().waitFor({ state: 'attached', timeout: 30_000 })
    await openDetailsBlocks(page)
    await waitForMermaid(page, route)
    await waitForMathJax(page)
    await page.emulateMedia({ media: 'print' })
    // Раскладываем страницу на ширине печатной области, чтобы диаграммы и
    // измерения блоков совпадали с тем, что Chrome положит на бумагу.
    // Печатные стили и новая ширина меняют колонку: ResizeObserver диаграмм
    // срабатывает в следующем кадре и снова выставляет aria-busy до конца пересчёта.
    await page.setViewportSize({ width: PRINT_AREA.width, height: PRINT_AREA.height })
    await waitForNextFrames(page)
    await waitForMermaid(page, route)
    await markPrintBlocks(page)

    await page.pdf({
      path: pageFile,
      format: 'A4',
      printBackground: true,
      margin: Object.fromEntries(
        Object.entries(MARGIN_MM).map(([side, value]) => [side, `${value}mm`])
      )
    })
    await page.setViewportSize({ width: 1440, height: 1400 })

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

// MermaidDiagram держит aria-busy, пока рисует диаграмму и пока не применена
// раскладка (масштаб и центровка). Это тот же сигнал готовности, которого ждут
// эталонные снимки в tests/characterization/helpers.ts.
async function waitForMermaid(page, route) {
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.kpo-mermaid')].every(
        (diagram) =>
          diagram.querySelector('svg, .kpo-mermaid__error') &&
          diagram.getAttribute('aria-busy') !== 'true'
      ),
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

// На бумаге свёрнутый блок ::: details не открыть, поэтому в PDF они раскрыты.
// Раскрываем до ожидания Mermaid: диаграммы внутри блока получают ширину и
// пересчитывают раскладку, а waitForMermaid дожидается её центровки.
async function openDetailsBlocks(page) {
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('.vp-doc details')) details.open = true
  })
}

// Блок от заголовка h2/h3 до следующего такого же заголовка печатается с новой
// страницы, если не помещается в её остаток. Сам перенос делает Chrome по
// правилам 27-print.css; здесь блоки только оборачиваются и помечаются:
// помещается на страницу -> break-inside: avoid, длиннее страницы -> break-before: page.
// Элементы, которые print CSS держит целиком, но которые выше страницы,
// помечаются kpo-print-oversize и печатаются в потоке.
// Первый h3 в разделе, который сам начался с новой страницы, не переносится,
// иначе заголовок раздела с коротким вступлением остался бы на странице один.
async function markPrintBlocks(page) {
  await page.evaluate((pageHeight) => {
    const root = document.querySelector('.vp-doc > div')
    if (!root) return

    const wrap = (container, tagName) => {
      const blocks = []
      let current = null
      for (const node of [...container.children]) {
        if (node.tagName === tagName) {
          current = document.createElement('section')
          current.className = 'kpo-print-block'
          node.before(current)
          blocks.push(current)
        }
        if (current) current.append(node)
      }
      return blocks
    }
    const mark = (block, keepInFlow) => {
      const tall = block.getBoundingClientRect().height > pageHeight
      block.classList.add(tall ? 'kpo-print-block--tall' : 'kpo-print-block--fits')
      if (tall && keepInFlow) block.classList.add('kpo-print-block--flow')
      return tall
    }

    for (const section of wrap(root, 'H2')) {
      const startsNewPage = mark(section, false)
      wrap(section, 'H3').forEach((subsection, index) => {
        mark(subsection, index === 0 && startsNewPage)
      })
    }

    // break-inside: avoid на элементе выше страницы Chromium исполняет разрывом
    // перед ним: блок уезжает на новую страницу и всё равно режется, а над ним
    // остаётся пустое место. Такие элементы (и почти такие, если над ними
    // заголовок) печатаются в потоке.
    const avoidSelector = 'pre, table, .kpo-content-block, .kpo-mermaid, .custom-block'
    const avoidCandidates = root.querySelectorAll(avoidSelector)
    // Запас на заголовок над элементом: break-after: avoid держит заголовок
    // вместе с элементом, и вдвоём они должны поместиться на страницу.
    const headingAllowance = 120
    for (const element of avoidCandidates) {
      if (element.getBoundingClientRect().height > pageHeight - headingAllowance) {
        element.classList.add('kpo-print-oversize')
        // Иначе вложенный блок, который сам помещается, уедет от своего заголовка.
        for (const nested of element.querySelectorAll(avoidSelector)) {
          nested.classList.add('kpo-print-oversize')
        }
      }
    }
  }, PRINT_AREA.height)
  await waitForNextFrames(page)
}

async function waitForNextFrames(page) {
  await page.evaluate(
    () =>
      new Promise((resolvePromise) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolvePromise()))
      })
  )
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

function mmToPx(mm) {
  return (mm * 96) / 25.4
}
