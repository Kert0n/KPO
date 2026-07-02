import type MarkdownIt from 'markdown-it'

/**
 * Fence-блоки ```mermaid превращаются в клиентский компонент
 * <MermaidDiagram>: библиотека mermaid тяжёлая и работает только
 * в браузере, поэтому рендер происходит после монтирования, а код
 * диаграммы передаётся пропом в URL-кодировке.
 */
export function mermaidPlugin(md: MarkdownIt): void {
  const defaultFence = md.renderer.rules.fence!

  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]

    if (token.info.trim() === 'mermaid') {
      return `<MermaidDiagram code="${encodeURIComponent(token.content)}"></MermaidDiagram>\n`
    }

    return defaultFence(tokens, index, options, env, self)
  }
}
