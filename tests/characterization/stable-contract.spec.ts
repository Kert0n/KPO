import { expect, test } from '@playwright/test'
import { BREAKPOINTS, resetBrowserState, setTheme, UI_FIXTURE_ROUTE, waitForStableUi } from './helpers'

test.describe('stable geometry and DOM contracts', () => {
  for (const width of BREAKPOINTS) {
    test(`viewport geometry at ${width}px`, async ({ page }) => {
      await resetBrowserState(page)
      await page.setViewportSize({ width, height: 900 })
      await page.goto('intro')
      await waitForStableUi(page)

      const state = await page.evaluate(() => {
        const visibleRect = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector)
          if (!element || getComputedStyle(element).display === 'none') return null
          const rect = element.getBoundingClientRect()
          if (rect.right <= 0 || rect.left >= document.documentElement.clientWidth) return null
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
        }
        const logo = visibleRect('.VPNavBarTitle .logo')
        const title = visibleRect('.VPNavBarTitle .title')
        const controls = [...document.querySelectorAll<HTMLElement>('.VPNavBar .content-body > *')]
          .filter((node) => getComputedStyle(node).display !== 'none')
          .map((node) => {
            const rect = node.getBoundingClientRect()
            return { className: node.className, left: rect.left, right: rect.right }
          })
          .filter((rect) => rect.right > rect.left)
        return {
          htmlLeft: document.documentElement.getBoundingClientRect().left,
          rootTransform: getComputedStyle(document.documentElement).transform,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          logoTitleOverlap: logo && title ? Math.max(0, Math.min(logo.right, title.right) - Math.max(logo.left, title.left)) : 0,
          controlsOverlap: controls.some((left, index) => controls.slice(index + 1)
            .some((right) => Math.max(left.left, right.left) < Math.min(left.right, right.right) - 1)),
          sidebar: visibleRect('.VPSidebar'),
          outline: visibleRect('.VPDocAside')
        }
      })

      expect(state.htmlLeft).toBe(0)
      expect(state.rootTransform).toBe('none')
      expect(state.scrollWidth).toBe(state.clientWidth)
      expect(state.logoTitleOverlap).toBe(0)
      expect(state.controlsOverlap).toBe(false)
      for (const region of [state.sidebar, state.outline]) {
        if (!region) continue
        expect(region.left).toBeGreaterThanOrEqual(0)
        expect(region.right).toBeLessThanOrEqual(state.clientWidth)
      }
    })
  }

  test('theme changes navbar, sidebar and content background synchronously', async ({ page }) => {
    await resetBrowserState(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('intro')
    const colors = async () => page.evaluate(() => ({
      token: getComputedStyle(document.documentElement).getPropertyValue('--vp-c-bg').trim(),
      navbar: getComputedStyle(document.querySelector('.VPNavBar')!).backgroundColor,
      sidebar: getComputedStyle(document.querySelector('.VPSidebar')!).backgroundColor,
      content: getComputedStyle(document.querySelector('.VPContent')!).backgroundColor
    }))
    await setTheme(page, 'light')
    const light = await colors()
    await setTheme(page, 'dark')
    const dark = await colors()
    expect(dark).not.toEqual(light)
    expect(dark.token).not.toBe(light.token)
  })

  test('sanitized representative HTML remains stable', async ({ page }) => {
    await resetBrowserState(page, { 'kpo:playground-mode': '0' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(UI_FIXTURE_ROUTE)
    await waitForStableUi(page)
    const html = await page.evaluate(() => {
      const selectors = [
        '.VPNav', '.VPSidebar', '.VPDoc .content-container', '.KpoAskAiProvider',
        '.kpo-switcher', '.kpo-mermaid', '.kpo-content-block--table'
      ]
      const sanitize = (node: Element) => {
        const clone = node.cloneNode(true) as Element
        clone.querySelectorAll('svg').forEach((svg) => svg.replaceWith(document.createElement('svg')))
        clone.querySelectorAll('*').forEach((element) => {
          element.removeAttribute('style')
          for (const attribute of [...element.attributes]) {
            if (/^(?:data-v-|aria-controls$|id$)/.test(attribute.name) && /\d|mermaid|kpo-code/.test(attribute.value)) {
              element.setAttribute(attribute.name, '<stable-id>')
            }
          }
        })
        return clone.outerHTML.replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim()
      }
      return Object.fromEntries(selectors.map((selector) => {
        const node = document.querySelector(selector)
        return [selector, node ? sanitize(node) : null]
      }))
    })
    expect(JSON.stringify(html, null, 2)).toMatchSnapshot('representative-html.txt')
  })
})
