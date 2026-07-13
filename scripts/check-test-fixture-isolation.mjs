import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const roots = ['tests', '.vitepress']
const testFiles = roots
  .flatMap(walk)
  .filter((file) => /(?:__tests__\/.*\.test\.ts|\.(?:test|spec)\.ts)$/.test(file))
const forbidden = [
  { name: 'production URL', pattern: /https:\/\/kert0n\.github\.io\/KPO\//i },
  { name: 'published page browser route', pattern: /page\.goto\(\s*['"](?:intro|lectures\/)/ },
  {
    name: 'real lecture filesystem scan',
    pattern:
      /(?:readFileSync|readdirSync|statSync|existsSync)[\s\S]{0,120}content[\\/]['"`, ]*(?:lectures|extras|intro)/
  },
  { name: 'production catalog lookup', pattern: /(?:getContentCatalog|contentPagesFor)\(\s*\)/ }
]
const failures = testFiles.flatMap((file) => {
  const source = readFileSync(file, 'utf8')
  return forbidden
    .filter(({ pattern }) => pattern.test(source))
    .map(({ name }) => `${relative(process.cwd(), file)}: ${name}`)
})

if (failures.length > 0) {
  throw new Error(
    `Tests must use fixtures only:\n${failures.map((item) => `  - ${item}`).join('\n')}`
  )
}
console.log(`Fixture isolation passed for ${testFiles.length} test files.`)

function walk(path) {
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name)
    return statSync(child).isDirectory() ? walk(child) : [child]
  })
}
