export const CONTENT_LAYOUT_TOKENS = {
  proseWidth: '688px',
  wideWidth: '960px',
  sidebarWidth: '272px',
  navHeight: '56px',
  desktopBreakpoint: '960px',
  wideDesktopBreakpoint: '1280px',
  maxMobileMermaidViewportHeight: '70vh',
  mermaidDesktopMinScale: 0.72,
  mermaidMobileMinScale: 0.4,
  mermaidManualDesktopMinScale: 0.5,
  mermaidManualMobileMinScale: 0.35,
  mermaidManualMaxScale: 1.5,
  mermaidMinHeight: 120,
  mermaidWideDiagramMinWidth: 680,
  tableMinReadableColumnWidth: 112,
  tableDenseMinColumnWidth: 88,
  tableOverflowEpsilon: 1
} as const

export const LAYOUT_VIEWPORTS = {
  mobilePhone: { width: 414, height: 896 },
  narrowDesktop: { width: 960, height: 900 },
  desktop: { width: 1440, height: 900 },
  wideDesktop: { width: 1876, height: 1000 }
} as const
