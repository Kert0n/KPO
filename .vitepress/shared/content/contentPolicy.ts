import type { ContentPageInclusion, ContentPageKind } from './contentTypes'

export function defaultInclusion(kind: ContentPageKind): ContentPageInclusion {
  switch (kind) {
    case 'home':
      return { nav: false, sidebar: false, search: true, askAi: true, pdf: false, uiSweep: false, sitemap: true }
    case 'service':
      return { nav: false, sidebar: false, search: false, askAi: false, pdf: false, uiSweep: false, sitemap: false }
    case 'intro':
    case 'lecture':
    case 'extras-index':
    case 'extra':
    case 'conclusion':
      return { nav: true, sidebar: true, search: true, askAi: true, pdf: true, uiSweep: true, sitemap: true }
  }
}
