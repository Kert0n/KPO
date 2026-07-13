import { readFileSync } from 'node:fs'

const summary = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'))
const requirements = [
  { suffix: '/.vitepress/shared/core/askAiModel.ts', statements: 90, branches: 80 },
  {
    suffix: '/.vitepress/theme/lib/askAiSelectionSnapshot.ts',
    statements: 90,
    branches: 80
  },
  { suffix: '/.vitepress/theme/composables/useMermaidRenderer.ts', statements: 90, branches: 80 }
]
const failures = []

for (const requirement of requirements) {
  const entry = Object.entries(summary).find(([file]) => file.endsWith(requirement.suffix))?.[1]
  if (!entry) {
    failures.push(`${requirement.suffix}: missing from coverage`)
    continue
  }
  for (const metric of ['statements', 'branches']) {
    if (entry[metric].pct < requirement[metric]) {
      failures.push(
        `${requirement.suffix}: ${metric} ${entry[metric].pct}% < ${requirement[metric]}%`
      )
    }
  }
}

if (failures.length) throw new Error(`Critical coverage failed:\n${failures.join('\n')}`)
console.log('Critical Ask AI and Mermaid coverage passed.')
