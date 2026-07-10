import { registerConsoleGuard } from './helpers/consoleGuard'
import { test } from './helpers/fixtures'
import { themeSuiteCases } from './helpers/themeSuite'

test.use({ playgroundMode: 'on' })
registerConsoleGuard(test)

for (const item of themeSuiteCases('playground')) test(item.title, item.body)
