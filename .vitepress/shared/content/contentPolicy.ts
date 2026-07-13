import type { ContentPage, ContentPageInclusion, ContentPageKind } from './contentTypes'

export type PdfPagePlan = { route: string; file: string }

const publicPage: ContentPageInclusion = {
  nav: false,
  sidebar: true,
  search: true,
  askAi: true,
  pdf: true,
  uiSweep: true,
  sitemap: true
}

export function inclusionForKind(kind: ContentPageKind): ContentPageInclusion {
  if (kind === 'home') {
    return { ...publicPage, sidebar: false, askAi: false, pdf: false }
  }
  if (kind === 'service') {
    return {
      nav: false,
      sidebar: false,
      search: false,
      askAi: false,
      pdf: false,
      uiSweep: true,
      sitemap: false
    }
  }
  return { ...publicPage, nav: ['intro', 'lecture', 'extras-index', 'conclusion'].includes(kind) }
}

export function isPublicKind(kind: ContentPageKind): boolean {
  return kind !== 'service'
}

export function buildPdfPagePlan(pages: ContentPage[]): PdfPagePlan[] {
  return [...pages]
    .sort((left, right) => pdfRank(left) - pdfRank(right) || left.order - right.order)
    .map((page, index) => ({
      route: page.route.replace(/^\//, ''),
      file: pdfFileName(page, index + 1)
    }))
}

function pdfRank(page: ContentPage): number {
  const ranks: Partial<Record<ContentPageKind, number>> = {
    intro: 0,
    lecture: 1,
    'extras-index': 2,
    extra: 3,
    conclusion: 4
  }
  return ranks[page.kind] ?? 99
}

function pdfFileName(page: ContentPage, index: number): string {
  const prefix = String(index).padStart(3, '0')
  if (page.kind === 'intro') return `${prefix}-intro`
  if (page.kind === 'lecture') return `${prefix}-lecture-${String(page.order).padStart(2, '0')}`
  if (page.kind === 'extras-index') return `${prefix}-extras`
  if (page.kind === 'extra' && page.order === 1) return `${prefix}-playground`
  if (page.kind === 'extra') return `${prefix}-extra-${String(page.order).padStart(2, '0')}`
  return `${prefix}-conclusion`
}
