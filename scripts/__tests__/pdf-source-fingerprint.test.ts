import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyPdfFingerprint } from '../check-pdf-fingerprint.mts'
import {
  fingerprintEntries,
  isPdfSourcePath,
  listPdfSourcePaths,
  PDF_FINGERPRINT_PREFIX
} from '../pdf-source-fingerprint.mts'
import { findConflictingPdfInputs } from '../sync-pdf-on-commit.mts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })))
})

describe('PDF source fingerprint', () => {
  it('is stable regardless of input order', () => {
    const first = { path: 'content/intro/vitepress.md', content: Buffer.from('intro') }
    const second = { path: 'package.json', content: Buffer.from('{}') }
    expect(fingerprintEntries([first, second])).toBe(fingerprintEntries([second, first]))
  })

  it('changes when source content changes', () => {
    const path = 'content/lectures/Lec1/vitepress.md'
    expect(fingerprintEntries([{ path, content: Buffer.from('a') }])).not.toBe(
      fingerprintEntries([{ path, content: Buffer.from('b') }])
    )
  })

  it('includes publication content, assets, rendering code and dependencies', () => {
    expect(isPdfSourcePath('content/extras/03/vitepress.md')).toBe(true)
    expect(isPdfSourcePath('content/lectures/Lec4/assets/slide.png')).toBe(true)
    expect(isPdfSourcePath('content/public/logo.svg')).toBe(true)
    expect(isPdfSourcePath('.vitepress/theme/index.ts')).toBe(true)
    expect(isPdfSourcePath('.vitepress/markdown/contentBlocks.ts')).toBe(true)
    expect(isPdfSourcePath('scripts/export-pdf.mjs')).toBe(true)
    expect(isPdfSourcePath('package-lock.json')).toBe(true)
  })

  it('lists the repository PDF inputs in stable order', () => {
    const paths = listPdfSourcePaths()
    expect(paths).toEqual([...paths].sort())
    expect(paths).toContain('content/intro/vitepress.md')
    expect(paths).toContain('scripts/export-pdf.mjs')
    expect(paths).not.toContain('output/pdf/kpo-course.pdf')
  })

  it('excludes tests, generated output, service pages and templates', () => {
    expect(isPdfSourcePath('.vitepress/theme/lib/__tests__/model.test.ts')).toBe(false)
    expect(isPdfSourcePath('.vitepress/dist/index.html')).toBe(false)
    expect(isPdfSourcePath('output/pdf/kpo-course.pdf')).toBe(false)
    expect(isPdfSourcePath('content/service-pages/ui-contract/vitepress.md')).toBe(false)
    expect(isPdfSourcePath('content/lectures/_template/vitepress.md')).toBe(false)
  })

  it('accepts matching PDF metadata and rejects missing or stale metadata', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kpo-pdf-test-'))
    temporaryDirectories.push(directory)
    const currentPath = join(directory, 'current.pdf')
    const missingPath = join(directory, 'missing.pdf')

    const current = await PDFDocument.create()
    current.addPage()
    current.setSubject(`${PDF_FINGERPRINT_PREFIX}abc123`)
    await writeFile(currentPath, await current.save())

    const missing = await PDFDocument.create()
    missing.addPage()
    await writeFile(missingPath, await missing.save())

    expect(await verifyPdfFingerprint({ pdfPath: currentPath, expected: 'abc123' })).toMatchObject({
      actual: 'abc123',
      valid: true
    })
    expect(
      await verifyPdfFingerprint({ pdfPath: currentPath, expected: 'different' })
    ).toMatchObject({ actual: 'abc123', valid: false })
    expect(await verifyPdfFingerprint({ pdfPath: missingPath, expected: 'abc123' })).toMatchObject({
      actual: undefined,
      valid: false
    })
  })

  it('reports unstaged and untracked PDF inputs as hook conflicts', () => {
    expect(
      findConflictingPdfInputs({
        unstagedPaths: ['content/intro/vitepress.md', 'README.md'],
        untrackedPaths: ['content/lectures/Lec1/assets/new.png']
      })
    ).toEqual(['content/intro/vitepress.md', 'content/lectures/Lec1/assets/new.png'])
  })
})
