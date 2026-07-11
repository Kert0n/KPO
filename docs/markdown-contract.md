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

Ask AI context caching uses the absolute source path as its key. A changed
`mtime` replaces that path's entry, so repeated edits do not accumulate stale
path-plus-time cache records.
