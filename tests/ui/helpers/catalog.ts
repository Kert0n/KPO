import type { ContentCatalog, ContentPage } from '../../../.vitepress/shared/content/contentTypes'

export function requireCatalogPage(
  catalog: ContentCatalog,
  predicate: (page: ContentPage) => boolean,
  description: string
): ContentPage {
  const page = catalog.pages.find(predicate)
  if (!page) throw new Error(`Required catalog page is missing: ${description}`)
  return page
}

export function routePath(page: ContentPage): string {
  return page.route.replace(/^\//, '')
}
