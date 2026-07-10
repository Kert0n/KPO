# ADR 0001: единый Content Catalog

Статус: принято.

Все публичные страницы описываются `.vitepress/shared/content/contentCatalog.ts`. Навигация, sidebar, rewrites, Ask AI, PDF, sitemap и UI sweep получают маршруты из него, а не поддерживают свои списки.

Это сохраняет существующие URL, учитывает frontmatter `order` и автоматически включает публичные дополнения, включая `/extras/02`, в PDF и UI sweep.
