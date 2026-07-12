import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const [outputFile, job, startedAtRaw] = process.argv.slice(2)
if (!outputFile || !job || !startedAtRaw) {
  throw new Error('Usage: record-ci-timing.mjs <output-file> <job> <started-at-ms>')
}

const startedAtMs = Number(startedAtRaw)
if (!Number.isFinite(startedAtMs)) throw new Error(`Invalid job start time: ${startedAtRaw}`)

const output = resolve(outputFile)
mkdirSync(dirname(output), { recursive: true })
writeFileSync(
  output,
  `${JSON.stringify(
    {
      job,
      startedAt: new Date(startedAtMs).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs
    },
    null,
    2
  )}\n`,
  'utf8'
)
