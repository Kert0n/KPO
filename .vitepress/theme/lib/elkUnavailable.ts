/**
 * Заглушка вместо elkjs. Mermaid 12 всегда кладёт в сборку ленивый чанк ELK
 * (~1,5 МБ), хотя сайт рисует диаграммы только раскладкой dagre (см.
 * createMermaidConfig). Alias в .vitepress/config.mts подменяет elkjs этим
 * модулем, а build-time lint (lintMermaidCode) не пускает в контент
 * `layout: elk` и `flowchart-elk`, так что layout() здесь не вызывается.
 */
export default class ElkUnavailable {
  layout(): Promise<never> {
    return Promise.reject(
      new Error('ELK layout is not bundled on this site; Mermaid diagrams use dagre')
    )
  }
}
