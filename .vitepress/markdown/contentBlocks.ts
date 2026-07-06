import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { askAiBlockAttribute } from './askAiAnchors'

const TABLE_CLOSE = '</div>\n'
const CODE_CLOSE = '</div>\n'
const IMAGE_CLOSE = '</div>\n'

export function contentBlocksPlugin(md: MarkdownIt): void {
  markSpecialContentTokens(md)

  const defaultFence = md.renderer.rules.fence!
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]
    if (token.meta?.kpoInsideMultiCode || token.info.trim() === 'mermaid') {
      return defaultFence(tokens, index, options, env, self)
    }

    return codeOpen(token) + defaultFence(tokens, index, options, env, self) + CODE_CLOSE
  }

  const defaultTableOpen = md.renderer.rules.table_open ?? renderToken
  const defaultTableClose = md.renderer.rules.table_close ?? renderToken

  md.renderer.rules.table_open = (tokens, index, options, env, self) => {
    return tableOpen(tokens[index]) + defaultTableOpen(tokens, index, options, env, self)
  }

  md.renderer.rules.table_close = (tokens, index, options, env, self) => {
    return defaultTableClose(tokens, index, options, env, self) + TABLE_CLOSE
  }

  const defaultParagraphOpen = md.renderer.rules.paragraph_open ?? renderToken
  const defaultParagraphClose = md.renderer.rules.paragraph_close ?? renderToken

  md.renderer.rules.paragraph_open = (tokens, index, options, env, self) => {
    const prefix = tokens[index].meta?.kpoImageOnlyParagraph ? imageOpen(tokens[index]) : ''
    return prefix + defaultParagraphOpen(tokens, index, options, env, self)
  }

  md.renderer.rules.paragraph_close = (tokens, index, options, env, self) => {
    const suffix = tokens[index].meta?.kpoImageOnlyParagraph ? IMAGE_CLOSE : ''
    return defaultParagraphClose(tokens, index, options, env, self) + suffix
  }
}

function tableOpen(token: Token): string {
  return `<div class="kpo-content-block kpo-content-block--table kpo-content-block--wide" data-kpo-content-kind="table"${askAiBlockAttribute(token)}>\n`
}

function codeOpen(token: Token): string {
  return `<div class="kpo-content-block kpo-content-block--code kpo-content-block--wide"${askAiBlockAttribute(token)}>\n`
}

function imageOpen(token: Token): string {
  return `<div class="kpo-content-block kpo-content-block--image kpo-content-block--wide"${askAiBlockAttribute(token)}>\n`
}

function markSpecialContentTokens(md: MarkdownIt): void {
  md.core.ruler.push('kpo_content_blocks', (state) => {
    let multiCodeDepth = 0

    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index]

      if (token.type === 'container_multi-code_open') {
        multiCodeDepth += 1
      } else if (token.type === 'container_multi-code_close') {
        multiCodeDepth = Math.max(0, multiCodeDepth - 1)
      } else if (token.type === 'fence' && multiCodeDepth > 0) {
        token.meta = { ...token.meta, kpoInsideMultiCode: true }
      } else if (token.type === 'paragraph_open' && isImageOnlyParagraph(state.tokens, index)) {
        token.meta = { ...token.meta, kpoImageOnlyParagraph: true }

        const closeIndex = findParagraphClose(state.tokens, index)
        if (closeIndex !== -1) {
          state.tokens[closeIndex].meta = {
            ...state.tokens[closeIndex].meta,
            kpoImageOnlyParagraph: true
          }
        }
      }
    }
  })
}

function isImageOnlyParagraph(tokens: Token[], openIndex: number): boolean {
  const inline = tokens[openIndex + 1]
  if (inline?.type !== 'inline') return false

  const meaningfulChildren = (inline.children ?? []).filter((child) => {
    return child.type !== 'text' || child.content.trim() !== ''
  })

  if (meaningfulChildren.length !== 1) return false
  return meaningfulChildren[0].type === 'image'
}

function findParagraphClose(tokens: Token[], openIndex: number): number {
  for (let index = openIndex + 1; index < tokens.length; index += 1) {
    if (tokens[index].type === 'paragraph_close') return index
  }

  return -1
}

function renderToken(
  tokens: Token[],
  index: number,
  options: MarkdownIt.Options,
  _env: unknown,
  self: MarkdownIt.Renderer
): string {
  return self.renderToken(tokens, index, options)
}
