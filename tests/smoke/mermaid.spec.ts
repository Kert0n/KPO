import { expect, test } from '@playwright/test'
import {
  LAYOUT_VIEWPORTS,
  MERMAID_FIXTURE_ROUTE,
  getMermaidClipIssues,
  waitForMermaidSettled
} from '../ui/helpers/kpoTestSupport'

// Mermaid измеряет подписи в том движке, где рисует, поэтому обрезание
// проявляется не во всех браузерах: контракт проверяется в каждом.
for (const [name, viewport] of Object.entries({
  desktop: LAYOUT_VIEWPORTS.desktop,
  mobilePhone: LAYOUT_VIEWPORTS.mobilePhone
})) {
  test(`mermaid labels are not clipped on ${name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto(MERMAID_FIXTURE_ROUTE)
    await waitForMermaidSettled(page)

    const issues = await getMermaidClipIssues(page)
    expect(issues, JSON.stringify({ viewport, issues }, null, 2)).toEqual([])
  })
}
