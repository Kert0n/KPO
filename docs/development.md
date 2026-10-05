# Разработка и публикация

Команды, тесты, PDF-экспорт и CI. Для правок учебного текста это не нужно: см.
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Требования

- Node >=24;
- npm;
- Chromium browsers для Playwright UI tests;
- JDK 21 для `npm run kotlin:check`.

Файл `.node-version` содержит `24`. Скрипты `prebuild`, `pretest` и `pretest:ui` проверяют
major-версию Node перед локальными проверками.

## Команды

```sh
npm ci
npm run dev
npm run typecheck
npm run test
npm run audit
npm run build
npm run test:ui
npm run pdf
```

Дополнительные команды:

```sh
npm run preview
npm run dev:host
npm run preview:host
npm run pdf:published
```

## Тесты

Unit-тесты покрывают markdown pipeline и чистые модели темы:

```sh
npm run test
```

TypeScript, security audit, unit-тесты и сборка объединены в полный локальный gate:

```sh
npm run verify
npm run verify:full
npm run format:tracked
npm run format:check:tracked
```

Browser- и visual-регрессии Playwright проверяют только служебные fixture-страницы; учебные лекции
и extras проверяются отдельными content-gates:

```sh
npm run build
npm run test:ui
npm run content:check
```

Перед публикацией используйте полный прогон:

```sh
npm exec --yes --package=node@24 -- npm run test
npm exec --yes --package=node@24 -- npm run verify
npm exec --yes --package=node@24 -- npm run test:ui
```

## Форматирование и pre-commit

После `npm install` или `npm ci` Husky устанавливает pre-commit hook: lint-staged запускает Prettier
только для staged-файлов и повторно добавляет их в commit. Файлы из `.prettierignore`, включая
`content/`, CSS и PDF-артефакты, hook не изменяет. PDF во время commit не строится: это делает Pages
deploy после успешного push в `master`. В pull request форматирование проверяется строго через
`format:check:tracked`.

## PDF export

`npm run pdf` собирает сайт, поднимает локальный `vitepress preview` и экспортирует курс в
игнорируемый Git файл `output/pdf/kpo-course.pdf`. `npm run pdf:published` использует опубликованный
сайт `https://kert0n.github.io/KPO/`.

Экспорт реализован собственным Playwright-скриптом `scripts/export-pdf.mjs`. Он:

- экспортирует явный список публичных route в стабильном порядке;
- не включает главную страницу, служебные страницы, скрытые template folders и черновики;
- ждет Mermaid и MathJax;
- падает, если на странице появился `.kpo-mermaid__error`;
- сохраняет отдельные страницы в `output/pdf/pages/`;
- объединяет итоговый файл через `pdf-lib`.

Для визуальной проверки PDF удобно поставить Poppler:

```sh
brew install poppler
pdfinfo output/pdf/kpo-course.pdf
mkdir -p output/pdf/preview
pdftoppm -png -f 1 -l 5 output/pdf/kpo-course.pdf output/pdf/preview/page
```

Все локально сгенерированные PDF, включая `output/pdf/kpo-course.pdf`, отдельные страницы и
preview-файлы, игнорируются через `.gitignore`.

## CI и публикация на GitHub Pages

При push в `master` workflow `.github/workflows/quality.yml` нормализует tracked-файлы в
изолированном CI workspace, выполняет все quality gates, собирает сайт и загружает проверенный
`production-dist`. Если Prettier что-то изменил, список файлов появляется в Job Summary, но CI не
создаёт скрытый commit и не переписывает историю `master`.

Набор gates зависит от изменённых путей:

| Профиль                                | Quality        | Kotlin | Build | Browser/visual |
| -------------------------------------- | -------------- | ------ | ----- | -------------- |
| Только учебный контент                 | Content checks | Да     | Да    | Пропускаются   |
| Код, конфигурация или service fixtures | Полный набор   | Да     | Да    | Полный набор   |

В pull request required checks сохраняют прежние имена `quality`, `kotlin-playground`, `build` и
`browser`, поэтому защита ветки не требует отдельной настройки.

Workflow `.github/workflows/deploy.yml` запускается только после успешных Quality gates для push в
`master`, скачивает тот же `production-dist`, экспортирует из него PDF и публикует оба результата
одним GitHub Pages deployment. Если экспорт PDF завершился ошибкой, новая версия сайта также не
публикуется, а предыдущая остаётся доступна. Pull request и ручной запуск Quality gates остаются
строгими: неотформатированный tracked-файл приводит к ошибке до merge.

Репозиторий должен называться `KPO`, потому что в `.vitepress/config.mts` задан `base: '/KPO/'`.

## Code review: CodeRabbit

К репозиторию подключён CodeRabbit (конфигурация по умолчанию, профиль CHILL). Автоматических ревью
нет: у репозитория меньше 10 звёзд, а PR от Dependabot бот пропускает сам. Ревью запускается
комментарием `@coderabbitai review` и только для смысловых PR: изменения кода сайта, скриптов, CI и
содержательные правки текста. Обновления зависимостей и правки опечаток не ревьюятся: это долго и
расходует квоту (на текущем плане около одного включённого ревью в час).

Один запуск проверяет меньше 100 файлов, изменённых с прошлого ревью, поэтому большой PR пушится
порциями (150 файлов можно отправить двумя пушами по 75) с вызовом ревью после каждой. Правила для студентов
описаны в [`CONTRIBUTING.md`](../CONTRIBUTING.md#coderabbit).

## Зависимости

Порядок обновления npm, Gradle и GitHub Actions, правила совместимости major-версий и разбор
конфликтов Dependabot описаны в [`dependency-maintenance.md`](dependency-maintenance.md).
