import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const roots = ['tests', '.vitepress']
const testFiles = roots
  .flatMap(walk)
  .filter((file) => /(?:__tests__\/.*\.test\.ts|\.(?:test|spec)\.ts)$/.test(file))
// Проверки ищут запрещённое в исходнике теста, поэтому совпадение в любом
// месте файла — это цель, а не упущение. Продакшн-URL сравнивается как строка:
// экранировать в регулярке каждую точку и слэш незачем, а регулярка в форме
// URL вдобавок читается статическим анализом как проверка origin без якорей
// (CodeQL js/regex/missing-regexp-anchor).
const PRODUCTION_URL = 'https://kert0n.github.io/kpo/'
const forbidden = [
  { name: 'production URL', matches: (source) => source.toLowerCase().includes(PRODUCTION_URL) },
  {
    name: 'published page browser route',
    matches: (source) => /page\.goto\(\s*['"](?:intro|lectures\/)/.test(source)
  },
  {
    name: 'real lecture filesystem scan',
    matches: (source) =>
      /(?:readFileSync|readdirSync|statSync|existsSync)[\s\S]{0,120}content[\\/]['"`, ]*(?:lectures|extras|intro)/.test(
        source
      )
  },
  {
    name: 'production catalog lookup',
    matches: (source) => /(?:getContentCatalog|contentPagesFor)\(\s*\)/.test(source)
  }
]
const failures = testFiles.flatMap((file) => {
  const source = readFileSync(file, 'utf8')
  return forbidden
    .filter(({ matches }) => matches(source))
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
