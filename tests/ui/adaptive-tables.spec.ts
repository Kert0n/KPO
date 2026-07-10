import { registerConsoleGuard } from './helpers/consoleGuard'
import { test } from './helpers/fixtures'
import { themeSuiteCases } from './helpers/themeSuite'

registerConsoleGuard(test)
for (const item of themeSuiteCases('adaptive-tables')) test(item.title, item.body)
