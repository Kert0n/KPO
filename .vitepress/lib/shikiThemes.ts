import type { ThemeRegistrationRaw } from 'shiki'
import { darkCode, lightCode, type CodePalette } from './palette'

/**
 * Кастомные Shiki-темы, собранные из общей палитры.
 * VitePress принимает такие объекты в markdown.theme и сам генерирует
 * пары --shiki-light/--shiki-dark на каждом токене.
 */

function buildTheme(name: string, type: 'light' | 'dark', c: CodePalette): ThemeRegistrationRaw {
  return {
    name,
    type,
    colors: {
      'editor.background': c.bg,
      'editor.foreground': c.fg
    },
    settings: [
      { settings: { foreground: c.fg, background: c.bg } },
      {
        scope: [
          'keyword',
          'keyword.operator.new',
          'keyword.operator.expression',
          'storage.type',
          'storage.modifier',
          'constant.language',
          'variable.language'
        ],
        settings: { foreground: c.keyword }
      },
      {
        scope: ['string', 'string.quoted', 'punctuation.definition.string'],
        settings: { foreground: c.string }
      },
      {
        scope: ['constant.numeric', 'constant.character'],
        settings: { foreground: c.number }
      },
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: c.comment, fontStyle: 'italic' }
      },
      {
        scope: [
          'entity.name.function',
          'support.function',
          'meta.function-call entity.name.function',
          'meta.method-call entity.name.function'
        ],
        settings: { foreground: c.function }
      },
      {
        scope: [
          'meta.annotation',
          'storage.type.annotation',
          'punctuation.definition.annotation',
          'meta.attribute',
          'support.attribute'
        ],
        settings: { foreground: c.annotation }
      },
      {
        scope: [
          'variable.other.property',
          'variable.other.object.property',
          'variable.other.member',
          'entity.name.variable.field'
        ],
        settings: { foreground: c.field }
      },
      {
        scope: ['constant.other', 'variable.other.constant', 'entity.name.constant'],
        settings: { foreground: c.constant }
      },
      {
        scope: ['entity.name.type', 'entity.name.class', 'entity.name.namespace', 'support.type', 'support.class'],
        settings: { foreground: c.type }
      }
    ]
  }
}

export const kpoLight = buildTheme('kpo-intellij-light', 'light', lightCode)
export const kpoDark = buildTheme('kpo-darcula', 'dark', darkCode)
