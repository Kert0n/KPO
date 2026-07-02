import type MarkdownIt from 'markdown-it'
import { mermaidPlugin } from './mermaid'
import { langOnlyPlugin, multiCodePlugin } from './multiCode'

/**
 * Единая точка подключения всех markdown-расширений конспекта.
 * config.mts вызывает одну функцию — состав расширений и их порядок
 * задокументированы здесь.
 */
export function applyMarkdownExtensions(md: MarkdownIt): void {
  // Блоки кода по отступу в 4 пробела отключены: в конспекте много
  // вставленного текста (цитаты слайдов, транскрипты), где случайный
  // отступ превращал прозу в непереносимый моноширинный блок,
  // вылезающий за экран на мобильных. Код оформляется только fence-ами.
  md.block.ruler.disable('code')

  md.use(multiCodePlugin)
  md.use(langOnlyPlugin)
  md.use(mermaidPlugin)
}
