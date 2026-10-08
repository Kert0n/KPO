# Авторский гид

Как устроен учебный контент и какие возможности Markdown поддерживает сайт. Процесс отправки
правок описан в [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Структура контента

```text
content/home/vitepress.md                    — главная: лейаут KpoHome, в теле только пример для hero
content/intro/vitepress.md                   — как читать курс и пользоваться возможностями сайта
content/conclusion/vitepress.md              — финальная карта повторения и практика
content/lectures/LecN/vitepress.md           — публикуемая страница лекции N
content/lectures/LecN/assets/                — изображения лекции
content/lectures/_template/                  — скрытая заготовка новой лекции
content/extras/index/vitepress.md            — landing page дополнительных материалов
content/extras/01/vitepress.md               — публичная песочница для практики
content/extras/NN/vitepress.md               — дополнительная тема N
content/extras/_template/                    — скрытая заготовка дополнительной темы
content/service-pages/ui-contract/vitepress.md — синтетическая страница для UI-регрессий
content/service-pages/_internal/             — внутренние markdown-документы, не публикуются
```

VitePress собирает страницы только из `content/`. Каждая публичная страница — папка с
`vitepress.md`; root markdown не является учебным контентом сайта. Папки, начинающиеся с `_`, не
попадают в sidebar и дополнительно исключены из сборки через `srcExclude`.

`content/service-pages/ui-contract/vitepress.md` не является учебным контентом: это контрактная
страница для проверки темы. Синтетические кейсы из нее не нужно переносить в лекции ради покрытия
UI.

Sidebar, nav, rewrites, PDF и Ask AI строятся из единого каталога контента, см.
[`content-catalog.md`](content-catalog.md).

## Как добавить лекцию

```sh
cp -R content/lectures/_template content/lectures/Lec15
```

Затем отредактируйте `content/lectures/Lec15/vitepress.md`:

- `title` во frontmatter;
- `order`;
- `requires` и `recommends` во frontmatter — что прочитать до лекции, см.
  [ниже](#что-прочитать-до-лекции);
- H1;
- ссылки, диаграммы и примеры.

Папочная страница получит чистый URL `/lectures/15`. Sidebar, nav и rewrites строятся
автоматически в `.vitepress/lib/content.ts`.

## Как добавить extra

```sh
cp -R content/extras/_template content/extras/NN
```

Затем отредактируйте `content/extras/NN/vitepress.md`:

- `title` во frontmatter;
- `order`;
- H1;
- практические задания и ссылки.

Папочная страница получит URL по номеру каталога. Плоские файлы `extras/NN.md` больше не
поддерживаются: extra должен быть папкой с `vitepress.md`.

## Дополнительное чтение

Раздел `## Дополнительное чтение` в любой лекции или extra автоматически попадает в общий список на
`/extras/02`. Формат ссылок и правила проверки описаны в
[`content-catalog.md`](content-catalog.md#дополнительное-чтение).

## Что прочитать до лекции

Карта курса на главной показывает, на какие лекции опирается каждая лекция. Колонки карты — части
курса, их состав задан константой `COURSE_GROUPS` в `.vitepress/shared/content/courseMap.ts`. Пока
новую лекцию туда не добавили, карта покажет её в колонке «Другие лекции». Зависимости задаются во frontmatter самой лекции:

```yaml
---
requires:
  - lecture: 11
    reason: словарь брокеров, гарантии доставки и consumer
recommends:
  - lecture: 7
    reason: агрегаты, инварианты и доменные события
---
```

- `requires` — без этих лекций текст не понять. Главная разворачивает их по цепочке: если лекция 12
  требует 11, а 11 требует 10, читатель увидит «сначала 10, потом 11».
- `recommends` — лекция объясняет нужное сама, но с этим контекстом читать легче.
- `reason` читатель видит при наведении на лекцию. Без причины можно короче: `requires: [11]`.
- Ссылаться можно только на более ранние лекции, каждую лекцию — один раз. Нарушения останавливают
  `npm run content:check` с путём к файлу.

В `requires` ставьте только то, без чего лекция действительно непонятна: понятие используется без
объяснения или продолжается сценарий прошлой лекции. Ссылка «подробнее см. лекцию 4» обязательной
лекцию не делает — это `recommends` или ничего.

## Возможности Markdown

Все возможности разметки вживую показаны на странице [`/intro`](https://kert0n.github.io/KPO/intro)
сайта, а её исходник [`content/intro/vitepress.md`](../content/intro/vitepress.md) служит образцом:
если не знаете, как оформить блок, найдите похожий там и скопируйте разметку. Ниже краткая
шпаргалка и правила, которые не видны на самой странице.

| Что нужно                       | Разметка                                         |
| ------------------------------- | ------------------------------------------------ |
| Пример на нескольких языках     | `::: multi-code "Заголовок"` … `:::`             |
| Запускаемая версия Kotlin       | fence `kotlin playground` внутри `multi-code`    |
| Блок без Playground             | `::: multi-code "Заголовок" {playground=off}`    |
| Язык блока по умолчанию         | `::: multi-code "Заголовок" {default=go}`        |
| Абзац для одного языка          | `::: only kotlin` … `:::`                        |
| Вставка для языка в предложении | `<LangOnly lang="go">...</LangOnly>`             |
| Диаграмма                       | fence `mermaid`                                  |
| Совет, предупреждение, спойлер  | `::: tip`, `::: warning`, `::: details` … `:::`  |
| Таблица                         | обычная Markdown-таблица, адаптивность автоматом |

### Многоязычные примеры

````md
::: multi-code "Заголовок примера"

```kotlin
data class User(val id: Int, val name: String)
```

```kotlin playground
data class User(val id: Int, val name: String)

fun main() {
    println(User(1, "Ада"))
}
```

```csharp
record User(int Id, string Name);
```

:::
````

- Поддерживаются `kotlin`, `csharp`, `java`, `go` и алиасы `kt`, `cs`. Выбор языка общий для всего
  сайта и хранится в `localStorage` как `kpo:code-language`.
- Первым показывается первый fence блока. Если блок должен начинаться с Kotlin, просто поставьте
  Kotlin первым.
- `kotlin playground` не становится отдельной вкладкой: это запускаемая версия для интерактивного
  режима, чтобы в тексте лекции не было `main` и демонстрационного вывода. Без неё пример не
  запускается: кнопка Playground видна, но неактивна и подсказывает, что запускаемой версии нет.
- `{playground=off}` ставьте для фрагментов, которые не запускаются сами по себе (кусок класса,
  псевдокод).
- Не добавляйте `{default=kotlin}` как boilerplate: `default` означает защищённый авторский override, он
  сильнее сохранённого выбора читателя до первого клика в этом блоке. Используйте его, только когда
  пример действительно лучше читать на другом языке.

### Проверка Kotlin-примеров

Запускаемые fence `kotlin playground` (и алиасы вроде `kt playground`) компилируются в CI
(`npm run kotlin:check`, нужен JDK 21), поэтому сломанный пример не пройдёт проверки. Обычные
Kotlin-fence и блоки с `{playground=off}` не компилируются: это иллюстрации.

### Mermaid

Mermaid рендерится на клиенте в палитре сайта. Build-time lint ловит частые ошибки Mermaid 11,
включая использование classDiagram-стрелок внутри `flowchart`/`graph`.
