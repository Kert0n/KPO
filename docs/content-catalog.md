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
