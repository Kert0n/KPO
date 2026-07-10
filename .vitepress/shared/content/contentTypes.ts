export type ContentPageKind =
  | 'home'
  | 'intro'
  | 'lecture'
  | 'extras-index'
  | 'extra'
  | 'conclusion'
  | 'service'

export type ContentPageInclusion = {
  nav: boolean
  sidebar: boolean
  search: boolean
  askAi: boolean
  pdf: boolean
  uiSweep: boolean
  sitemap: boolean
}

export type ContentPage = {
  kind: ContentPageKind
  sourcePath: string
  route: string
  routeKey: string
  title: string
  description: string
  order: number
  inclusion: ContentPageInclusion
  rewrite?: {
    from: string
    to: string
  }
}

export type ContentCatalog = {
  pages: readonly ContentPage[]
  publicPages: readonly ContentPage[]
}
