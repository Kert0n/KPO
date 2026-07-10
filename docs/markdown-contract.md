# Markdown contract

KPO сохраняет стандартный Markdown VitePress и добавляет:

- `::: multi-code` для примеров на нескольких языках;
- `::: only <language>` и `<LangOnly>`;
- fenced Mermaid;
- `kotlin playground` для явно запускаемых Kotlin-примеров.

Только fenced block `kotlin playground` проходит Kotlin compilation в CI. Обычные code blocks — иллюстративные и не обязаны быть самостоятельными программами.
