import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PDFDocument } from 'pdf-lib'
import { computePdfSourceFingerprint, PDF_FINGERPRINT_PREFIX } from './pdf-source-fingerprint.mts'

export type PdfFingerprintResult = {
  actual?: string
  expected: string
  valid: boolean
}

export async function verifyPdfFingerprint(options: {
  pdfPath: string
  expected: string
}): Promise<PdfFingerprintResult> {
  const document = await PDFDocument.load(await readFile(options.pdfPath), {
    updateMetadata: false
  })
  const subject = document.getSubject()
  const actual = subject?.startsWith(PDF_FINGERPRINT_PREFIX)
    ? subject.slice(PDF_FINGERPRINT_PREFIX.length)
    : undefined

  return { actual, expected: options.expected, valid: actual === options.expected }
}

async function runCli(): Promise<void> {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const pdfPath = resolve(root, 'output/pdf/kpo-course.pdf')
  const expected = await computePdfSourceFingerprint(root)
  const result = await verifyPdfFingerprint({ pdfPath, expected })

  if (!result.valid) {
    const actual = result.actual ?? 'missing'
    throw new Error(
      `Course PDF is stale (expected ${result.expected}, got ${actual}). ` +
        'Run "npm run pdf" and add output/pdf/kpo-course.pdf.'
    )
  }

  process.stdout.write(`Course PDF fingerprint is current: ${expected}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runCli()
}
