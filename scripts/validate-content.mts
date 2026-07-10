import { getContentCatalog } from '../.vitepress/shared/content/contentCatalog'

const catalog = getContentCatalog()
const publicRoutes = catalog.pages.filter((page) => page.inclusion.sitemap)

if (publicRoutes.length === 0) {
  throw new Error('Content catalog must contain at least one public route.')
}

process.stdout.write(`Validated ${catalog.pages.length} catalog pages (${publicRoutes.length} public).\n`)
