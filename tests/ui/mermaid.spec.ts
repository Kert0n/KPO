import { registerConsoleGuard } from './helpers/consoleGuard'
import { test } from './helpers/fixtures'
import { themeSuiteCases } from './helpers/themeSuite'

registerConsoleGuard(test)
test.use({ mermaidMode: 'on' })
for (const item of themeSuiteCases('mermaid')) test(item.title, item.body)
