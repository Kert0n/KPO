import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = ['intro', 'service-pages/ui-contract', 'lectures/01']

for (const route of routes) {
  test(`accessibility: ${route}`, async ({ page }) => {
    await page.goto(route)
    await page.locator('.vp-doc').waitFor({ state: 'attached' })

    const results = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      // The default VitePress sidebar nests its own collapsible controls. It is
      // outside the KPO custom-theme contract and cannot be fixed without
      // replacing the upstream component tree.
      .exclude('.VPNav')
      .exclude('.VPSidebar')
      .exclude('.VPLocalNav')
      .analyze()

    const seriousOrCritical = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical'
    )
    expect(seriousOrCritical).toEqual([])
  })
}
