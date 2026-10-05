# КПО — конспект курса

Интерактивный сайт курса «Конструирование программного обеспечения» на VitePress: 14
лекций-компаньонов, вводная страница, заключение и раздел «Дополнения» с песочницей для практики,
сводным списком дополнительного чтения и дополнительными темами.

Примеры на Kotlin, C#, Java и Go с общим переключателем языка, Kotlin Playground, Mermaid-диаграммы,
MathJax, адаптивные таблицы, Ask AI и PDF-версия курса.

- **Сайт:** https://kert0n.github.io/KPO/
- **PDF:** https://kert0n.github.io/KPO/kpo-course.pdf

## Как читать

Начните с [`/intro`](https://kert0n.github.io/KPO/intro): там описаны возможности сайта. Затем
проходите лекции по порядку. Каждая лекция самостоятельна, так что нужную тему можно открыть
напрямую. Для экспериментов используйте [песочницу](https://kert0n.github.io/KPO/extras/01): туда
удобно переносить код из лекций и запускать Kotlin-версии в Playground.

## Как помочь курсу

Нашли ошибку или знаете, как объяснить понятнее? Пришлите pull request: как это сделать, описано
в [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Быстрый старт

Нужен Node 24 или новее.

```sh
npm ci
npm run dev
```

## Документация

- [`CONTRIBUTING.md`](CONTRIBUTING.md) — как предложить правку: от опечатки до нового раздела;
- [`docs/authoring.md`](docs/authoring.md) — структура контента, новые лекции и extras, шпаргалка по
  Markdown;
- [`docs/development.md`](docs/development.md) — команды, тесты, PDF-экспорт, CI и публикация на
  GitHub Pages;
- [`docs/architecture.md`](docs/architecture.md) — архитектура сайта: слои `.vitepress/shared` /
  theme, правила владения lifecycle и `dispose()`;
- [`docs/content-catalog.md`](docs/content-catalog.md) — единый каталог контента: routes, порядок,
  inclusion policies, из которых выводятся nav/sidebar/PDF/Ask AI;
- [`docs/dependency-maintenance.md`](docs/dependency-maintenance.md) — сопровождение зависимостей и
  Dependabot.

## Лицензия

Проект распространяется по GNU General Public License v3.0 or later (`GPL-3.0-or-later`). См.
[LICENSE](./LICENSE).
