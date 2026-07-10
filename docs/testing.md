# Проверки

`npm run check` выполняет ESLint, architecture boundaries, format check, TypeScript checks, content contract и unit tests.

`npm run verify` дополнительно один раз собирает сайт, проверяет build output и performance budget, компилирует runnable Kotlin examples и запускает browser tests против готового `dist`.

Быстрые browser-команды:

```sh
npm run build
npm run test:ui:prebuilt     # Chromium, существующий dist
npm run test:ui              # одна сборка + Chromium
KPO_UI_WORKERS=2 npm run test:ui:prebuilt
npm run test:ui:smoke -- --project=firefox-smoke
npm run test:visual          # visual matrix, существующий dist
```

По умолчанию используются четыре worker’а. Каждый test получает новый BrowserContext, Kotlin как язык и выключенный Playground. `playground.spec.ts` и visual Playground case включают его явно. Browser tests не компилируют Kotlin: техническая компиляция `kotlin playground` остаётся Gradle gate.

Visual baselines находятся в `tests/ui/__screenshots__`. Каноническая среда — Linux Chromium из `mcr.microsoft.com/playwright:v1.61.1-noble`, совпадающий с visual job. Для обновления запустите вручную workflow `Generate Linux visual baselines`, скачайте artifact и замените каталог baseline. Локальный `--update-snapshots` пригоден только для диагностики: macOS-снимки не коммитятся. Шрифты загружаются до снимка, animations и caret нормализуются, last-updated маскируется.

`test-results/timings.json` содержит время suite/spec/test и список сценариев дольше пяти секунд. Trace, screenshot и video сохраняются только при ошибке.

Для Kotlin compilation нужен JDK 21. На Unix запускается `tooling/kotlin-snippets/gradlew`, на Windows — `gradlew.bat`; CI предоставляет JDK автоматически.
