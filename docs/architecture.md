# Архитектура KPO

Ключевые решения зафиксированы в [ADR](adr/).

KPO — статический VitePress-конспект. Контент находится в `content/`, build-time код — в `.vitepress/lib` и `.vitepress/markdown`, Vue-тема — в `.vitepress/theme`.

`.vitepress/shared` содержит модели, которые могут использоваться и сборкой, и темой. Theme не должна импортировать build-time модули, а Markdown plugins не должны импортировать Vue-компоненты или theme models.

Все публичные страницы описываются Content Catalog. Он строит sidebar, nav, rewrites, Ask AI contexts, PDF routes, sitemap и список маршрутов browser-тестов.

`shared/core/markdownStructure.ts` — единый classifier Markdown token’ов. Ask AI context extraction, Ask AI anchors и HTML content wrappers используют одинаковые виды блоков; fence внутри `multi-code` не становится отдельным Ask AI block.

DOM lifecycle находится в composables:

- `composables/ask-ai` — selection, context loading/abort, action generation, floating geometry и clipboard fallback;
- `composables/mermaid` — renderer generation, viewport/observers, zoom и theme config;
- `composables/code` — tabs, active language, Shiki DOM adapter и Kotlin Playground instance.

CSS импортируется в фиксированном порядке: tokens, VitePress adapters, content, components, print. Селекторы `.VP*`, `.vp-doc` и `.DocSearch-*` разрешены только в `styles/adapters`. `npm run check:architecture` проверяет CSS и import boundaries.
