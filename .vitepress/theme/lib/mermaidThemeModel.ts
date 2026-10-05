export type MermaidThemeTokens = {
  darkMode: boolean
  fontFamily: string
  background: string
  softBackground: string
  text: string
  mutedText: string
  border: string
}

export type MermaidConfig = {
  startOnLoad: false
  theme: 'base'
  layout: 'dagre'
  look: 'classic'
  themeVariables: Record<string, string | boolean>
  fontFamily: string
  htmlLabels: true
  flowchart: {
    wrappingWidth: number
    minNodeWidth: number
  }
  state: {
    minNodeWidth: number
  }
}

export function createMermaidThemeVariables(
  tokens: MermaidThemeTokens
): Record<string, string | boolean> {
  return {
    darkMode: tokens.darkMode,
    fontFamily: tokens.fontFamily,
    primaryColor: tokens.softBackground,
    primaryTextColor: tokens.text,
    primaryBorderColor: tokens.border,
    lineColor: tokens.mutedText,
    secondaryColor: tokens.softBackground,
    tertiaryColor: tokens.background,
    background: tokens.background,
    mainBkg: tokens.background,
    secondBkg: tokens.softBackground,
    edgeLabelBackground: tokens.background,
    clusterBkg: tokens.softBackground,
    clusterBorder: tokens.border,
    noteBkgColor: tokens.softBackground,
    noteTextColor: tokens.text,
    noteBorderColor: tokens.border,
    textColor: tokens.text,
    nodeTextColor: tokens.text,
    labelTextColor: tokens.text
  }
}

export function createMermaidConfig(tokens: MermaidThemeTokens): MermaidConfig {
  return {
    startOnLoad: false,
    theme: 'base',
    // Mermaid 12 defaults to ELK layout, the `neo` look and a 120px minimum label
    // width; the site palette and the UI contracts are built for dagre + classic
    // with nodes sized to their text.
    layout: 'dagre',
    look: 'classic',
    themeVariables: createMermaidThemeVariables(tokens),
    fontFamily: tokens.fontFamily,
    htmlLabels: true,
    flowchart: {
      wrappingWidth: 180,
      minNodeWidth: 0
    },
    state: {
      minNodeWidth: 0
    }
  }
}
