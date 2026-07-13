import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter(existsSync)

const prettier = fileURLToPath(
  new URL('../node_modules/prettier/bin/prettier.cjs', import.meta.url)
)
const result = spawnSync(process.execPath, [prettier, '--check', '--ignore-unknown', ...files], {
  stdio: 'inherit'
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
