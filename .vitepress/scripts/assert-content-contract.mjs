import { execFileSync } from 'node:child_process'
import { assertMarkdownRouteContract } from '../lib/contentContract.ts'

const markdownFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean)
  .map(normalizePath)

assertMarkdownRouteContract(markdownFiles)

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}
