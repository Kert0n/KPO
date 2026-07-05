export type MermaidThemeTokens = {
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
  themeVariables: Record<string, string>
  fontFamily: string
  flowchart: {
    htmlLabels: true
    wrappingWidth: number
  }
}

export function createMermaidThemeVariables(tokens: MermaidThemeTokens): Record<string, string> {
  return {
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
    themeVariables: createMermaidThemeVariables(tokens),
    fontFamily: tokens.fontFamily,
    flowchart: {
      htmlLabels: true,
      wrappingWidth: 180
    }
  }
}
