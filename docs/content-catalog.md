# Content Catalog

`.vitepress/shared/content/contentCatalog.ts` is the only source of page routes,
ordering and channel inclusion. It discovers public `vitepress.md` files and
applies the policy from `contentPolicy.ts`.

Page titles use frontmatter `title`, then the first H1, then a section fallback.
Ordering uses numeric frontmatter `order`, then the number in the directory
name. Routes and section order values must be unique.

Each page explicitly opts into navigation, sidebar, search, Ask AI, PDF, UI
sweep and sitemap channels. `_template`, `_internal` and service pages never
enter public channels. Service fixtures may participate only in the internal UI
sweep.

To add a lecture or extra, create its numbered directory and `vitepress.md`.
The catalog automatically supplies rewrites, sidebar entries, Ask AI context,
PDF export, UI coverage and sitemap metadata. Override `order` in frontmatter
when filesystem numbering must not control presentation order.

## Additional readings

`/extras/02` is generated from the same catalog. Every lecture or extra that
contains a recognized H2 reading section is included automatically; no loader
or component change is required for a new numbered page. Service pages,
templates and index pages are excluded.

Use the canonical heading and top-level Markdown bullets whose first element is
an external HTTP(S) link:

```md
## Дополнительное чтение

### Архитектура

- [Название источника](https://example.com/article) — необязательное пояснение
```

Links before the first H3 are placed in the `Материалы` group. Notes may
continue on an indented next line. The compatible H2
`Источники для дальнейшего чтения` is supported for existing material, but new
pages should use `Дополнительное чтение`.

The content gate rejects recognized sections that are empty, contain empty H3
groups, malformed links, non-HTTP(S) URLs or duplicate recognized sections. A
diagnostic includes the source path and line so a newly copied template cannot
silently disappear from the index.
