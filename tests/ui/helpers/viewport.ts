import type { Locator, Page } from '@playwright/test'

export async function waitForDocumentAnimations(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState === 'finished')
  )
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  )
}

export async function waitForStableRect(
  locator: Locator,
  options: { frames?: number; tolerancePx?: number } = {}
): Promise<void> {
  const frames = options.frames ?? 2
  const tolerance = options.tolerancePx ?? 1

  await locator.evaluate(
    async (node, settings) => {
      let stableFrames = 0
      let previous = node.getBoundingClientRect()

      while (stableFrames < settings.frames) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        const current = node.getBoundingClientRect()
        const stable =
          Math.abs(current.x - previous.x) <= settings.tolerance &&
          Math.abs(current.y - previous.y) <= settings.tolerance &&
          Math.abs(current.width - previous.width) <= settings.tolerance &&
          Math.abs(current.height - previous.height) <= settings.tolerance
        stableFrames = stable ? stableFrames + 1 : 0
        previous = current
      }
    },
    { frames, tolerance }
  )
}
