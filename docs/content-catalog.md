# Content Catalog

Каталог строится из `content/**/vitepress.md`.

- `title`: frontmatter, затем H1.
- `order`: frontmatter, затем число в имени каталога.
- public lectures и extras попадают в sidebar, Ask AI, sitemap и UI sweep.
- extras по умолчанию входят в PDF; для исключения добавьте `pdf: false` во frontmatter.
- `_template`, `_internal` и service pages не публикуются как учебный контент.

При добавлении lecture или extra не нужно вручную менять nav, sidebar, PDF route list или Playwright route list.
