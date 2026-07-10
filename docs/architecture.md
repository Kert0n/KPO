# Архитектура KPO

Ключевые решения зафиксированы в [ADR](adr/).

KPO — статический VitePress-конспект. Контент находится в `content/`, build-time код — в `.vitepress/lib` и `.vitepress/markdown`, Vue-тема — в `.vitepress/theme`.

`.vitepress/shared` содержит модели, которые могут использоваться и сборкой, и темой. Theme не должна импортировать build-time модули, а Markdown plugins не должны импортировать Vue-компоненты или theme models.

Все публичные страницы описываются Content Catalog. Он строит sidebar, nav, rewrites, Ask AI contexts, PDF routes, sitemap и список маршрутов browser-тестов.
