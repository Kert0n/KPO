export type ContentPageKind =
  'home' | 'intro' | 'lecture' | 'extras-index' | 'extra' | 'conclusion' | 'service'

export type ContentPageInclusion = {
  nav: boolean
  sidebar: boolean
  search: boolean
  askAi: boolean
  pdf: boolean
  uiSweep: boolean
  sitemap: boolean
}

export type ContentSection = 'root' | 'lectures' | 'extras' | 'service'

export type ContentPage = {
  kind: ContentPageKind
  section: ContentSection
  sourcePath: string
  outputPath: string
  route: string
  routeKey: string
  title: string
  navigationTitle?: string
  description: string
  order: number
  inclusion: ContentPageInclusion
}
