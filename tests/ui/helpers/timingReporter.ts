import { mkdirSync, writeFileSync } from 'node:fs'
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'

type TimingRecord = {
  title: string
  file: string
  durationMs: number
  status: string
}

export default class TimingReporter implements Reporter {
  private readonly records: TimingRecord[] = []
  private startedAt = Date.now()

  onBegin(): void {
    this.startedAt = Date.now()
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.records.push({
      title: test.titlePath().join(' › '),
      file: test.location.file,
      durationMs: result.duration,
      status: result.status
    })
  }

  onEnd(result: FullResult): void {
    const report = {
      status: result.status,
      durationMs: Date.now() - this.startedAt,
      slowTests: this.records.filter((record) => record.durationMs > 5_000),
      tests: [...this.records].sort((a, b) => b.durationMs - a.durationMs)
    }
    mkdirSync('test-results', { recursive: true })
    writeFileSync('test-results/timings.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8')

    if (report.slowTests.length > 0) {
      process.stdout.write(
        `\nTests over 5s:\n${report.slowTests
          .map((test) => `- ${(test.durationMs / 1000).toFixed(1)}s ${test.title}`)
          .join('\n')}\n`
      )
    }
    process.stdout.write(`Browser suite: ${(report.durationMs / 1000).toFixed(1)}s\n`)
  }
}
