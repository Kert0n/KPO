# Markdown Contract

The public Markdown DSL remains `multi-code`, `only`, Mermaid fences, Kotlin
Playground fences and `{playground=off}`. The shared classifier in
`.vitepress/shared/core/markdownStructure.ts` recognizes code, multi-code,
Mermaid, headings, paragraphs, images, lists, blockquotes and tables.

Ask AI extraction, Ask AI anchors, content wrappers, Mermaid rendering and
multi-code traversal consume that classifier. A `multi-code` container is one
Ask AI block: its inner fences are retained in the block Markdown but do not
produce duplicate top-level context blocks.

Block IDs are compatibility identifiers. They remain a function of the
one-based source line, classified block kind and stable hash of the original
Markdown. Changing the classifier or normalization must not rewrite IDs for
existing content. The characterization snapshots protect both IDs and the
complete representative prompt.

`default` is a protected author override, not a way to select the first fence.
Kotlin-first examples put the Kotlin fence first and omit `default=kotlin`.
The precedence is: protected author `default`, then the persisted reader
language after hydration, then the natural first fence. Once the reader clicks
that block, its author override is released and it follows the shared persisted
language across navigation.
Published Ask AI IDs are retained through a semantic compatibility manifest.
The key is source identity, block kind, canonical content and duplicate index.
For `multi-code`, container title, `default`, `playground`, delimiter length
and source line are presentation details and do not change the ID. A real code
or prose edit receives a new content-derived ID instead of being hidden by the
manifest.

Ask AI context caching uses the absolute source path as its key. A changed
`mtime` replaces that path's entry, so repeated edits do not accumulate stale
path-plus-time cache records.

Only `kotlin playground` fences in public catalog pages are runnable Kotlin.
Ordinary Kotlin fences are illustrative, and `{playground=off}` is a hard
exclusion. `npm run kotlin:extract` records the source line and generated file
for all 64 runnable snippets; Gradle 9.5.0 compiles them with JDK 21 and the same
Kotlin 2.4.0 version used by the browser Playground.
