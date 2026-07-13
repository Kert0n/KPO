import MarkdownIt from 'markdown-it'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { multiCodePlugin } from '../multiCode'

function render(source: string): string {
  const md = new MarkdownIt()
  md.use(multiCodePlugin)
  return md.render(source)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('multiCodePlugin', () => {
  it('emits author default and initial language for valid default', () => {
    const html = render(`
::: multi-code "Example" {default=go}
\`\`\`kotlin
fun main() {}
\`\`\`
\`\`\`go
package main
\`\`\`
:::
`)

    expect(html).toContain('author-default-lang="go"')
    expect(html).toContain('initial-lang="go"')
    expect(html).toContain('langs="kotlin,go"')
    expect(html).toContain('kpo-content-block--multi-code')
    expect(html).toContain('kpo-wide-block--code')
  })

  it('warns on invalid default and uses first language', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const html = render(`
::: multi-code "Example" {default=go}
\`\`\`kotlin
fun main() {}
\`\`\`
:::
`)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('default="go" не найден среди языков блока')
    )
    expect(html).not.toContain('author-default-lang')
    expect(html).toContain('initial-lang="kotlin"')
  })

  it('hard-disables playground with playground=off', () => {
    const html = render(`
::: multi-code "Example" {playground=off}
\`\`\`kotlin
fun main() {}
\`\`\`
:::
`)

    expect(html).toContain(':allow-playground="false"')
  })

  it('keeps an illustrative Kotlin action visible but does not provide runnable code', () => {
    const html = render(`
::: multi-code "Illustrative"
\`\`\`kotlin
class ExternalFrameworkType
\`\`\`
\`\`\`java
class ExternalFrameworkType {}
\`\`\`
:::
`)

    expect(html).toContain(':allow-playground="true"')
    expect(html).not.toContain('playground-code=')
  })

  it('warns about duplicate language blocks', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    render(`
::: multi-code "Example"
\`\`\`kotlin
fun one() {}
\`\`\`
\`\`\`kotlin
fun two() {}
\`\`\`
:::
`)

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('повторный блок языка "kotlin"'))
  })

  it('uses kotlin playground fence as hidden interactive source', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const html = render(`
::: multi-code "Example"
\`\`\`kotlin
class User
\`\`\`
\`\`\`kotlin playground
fun main() {
  println("interactive")
}
\`\`\`
\`\`\`go
package main
\`\`\`
:::
`)

    expect(html).toContain('langs="kotlin,go"')
    expect(html).toContain('playground-code=')
    expect(html).not.toContain('println(&quot;interactive&quot;)')
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('повторный блок языка "kotlin"'))
  })

  it('does not collect following fences after the container closes', () => {
    const html = render(`
::: multi-code "Example"
\`\`\`kotlin
fun main() {}
\`\`\`
:::

\`\`\`mermaid
flowchart LR
    A --> B
\`\`\`
`)

    expect(html).toContain('langs="kotlin"')
    expect(html).not.toContain('langs="kotlin,mermaid"')
  })
})
