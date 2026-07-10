import { registerConsoleGuard } from './helpers/consoleGuard'
import { test } from './helpers/fixtures'
import { themeSuiteCases } from './helpers/themeSuite'

registerConsoleGuard(test)
for (const item of themeSuiteCases('code-switcher')) test(item.title, item.body)
