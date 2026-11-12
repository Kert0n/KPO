# Обновление зависимостей

Dependabot запускается раз в неделю для npm, Gradle wrapper и GitHub Actions. Минорные и patch-обновления npm объединяются в один PR, а GitHub Actions — в отдельный групповой PR. Это позволяет проверять совместное дерево зависимостей и уменьшает число конкурирующих изменений `package-lock.json` и workflow-файлов.

## Обязательная проверка

Кандидат обновления должен устанавливаться обычным `npm ci`, без `--force` и `--legacy-peer-deps`. Перед merge выполняются:

```sh
npm ci
npm run format:check:tracked
npm run typecheck
npm run lint
npm run workflow:check
npm run test:fixture-isolation
npm run test:coverage
npm run content:check
npm run build
npm run budgets:check
npm run test:ui
npm run test:characterization:prebuilt
npm run kotlin:check
```

`npm install` и `npm ci` восстанавливают Husky pre-commit hook через lifecycle-скрипт `prepare`.
Hook запускает lint-staged и форматирует только staged-файлы, не затрагивая исключения из
`.prettierignore`. Если hooks были отключены локально, перед push необходимо вручную выполнить:

```sh
npm run format:tracked
npm run format:check:tracked
```

Pull request Dependabot проходит тот же строгий `format:check:tracked`, что и остальные PR.
Formatting gate нельзя обходить через отключение шага, расширение `.prettierignore` или ослабление
workflow assertions: сначала исправляется сам candidate tree.

Visual baseline не обновляется только потому, что изменился toolchain. Сначала проверяется actual/diff artifact и воспроизводимость; изменение baseline допустимо лишь при подтверждённом изменении интерфейса.

## Пины: что держим и когда снимать

Major-обновление принимается только когда все прямые peer-контракты его поддерживают, а
`overrides` в `package.json` закрывают проблемы транзитивных зависимостей, которые нельзя поднять
обычным обновлением. Каждый пин ниже держится до конкретного условия; ignore в Dependabot
относятся к version updates и не скрывают security updates.

| Что держим                                 | Где              | Почему                                                                                                                                                       | Когда снимать                                                       |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `markdown-it` и `@types/markdown-it` на 14 | `dependabot.yml` | VitePress 1.6.4 отдаёт плагинам инстанс markdown-it 14; типы 15 с ним не совпадают                                                                           | VitePress перейдёт на markdown-it 15                                |
| `@types/markdown-it` не 14.2.0             | `dependabot.yml` | 14.2.0 собран криво: `lib/*.d.mts` и `dist/index.cjs.d.ts` расходятся, typecheck падает                                                                      | выйдет версия новее 14.2.0                                          |
| `markdown-it-mathjax3` на 4                | `dependabot.yml` | VitePress 1.6.4 требует `markdown-it-mathjax3 ^4`                                                                                                            | VitePress перейдёт на 5                                             |
| TypeScript на 6                            | `dependabot.yml` | `typescript-eslint` 8.72.2 поддерживает TypeScript `<6.1`                                                                                                    | `typescript-eslint` разрешит TypeScript 7                           |
| `vitepress → vite 6.4.6`                   | `overrides`      | VitePress 1.6.4 просит `vite ^5.4.14` (последняя 5.x — 5.4.21), а vitest 5 требует `^6.4`; override держит одну поддерживаемую копию vite для сайта и тестов | выйдет стабильная VitePress 2 со своим vite 6+                      |
| `markdown-it → mdurl 2.0.0`                | `overrides`      | Встроенные типы mdurl 2.1.0 расходятся с @types/mdurl 2: ESM и CommonJS MarkdownIt становятся несовместимыми, typecheck падает                               | выйдет mdurl новее 2.1.0; проверить совместимость типов полным gate |
| `minimatch 7–10 → 11.0.1`                  | `overrides`      | GHSA-g3hv-75wg-m249 исправлена с 11.0.1, а ESLint 10 и typescript-eslint 8.72.2 требуют minimatch 10; override применяется только к уязвимым версиям 7–10    | все потребители minimatch 10 сами потребуют 11.0.1+                 |
| `gray-matter → js-yaml → argparse 2.0.1`   | `overrides`      | GHSA-hp3w-g68c-fv3c в `sprintf-js` не исправлена ни в одной версии; js-yaml 3 использует argparse только в CLI, а argparse 2 не зависит от sprintf-js        | gray-matter перейдёт на js-yaml 4                                   |

Помнить про пины не нужно: за ними следит автоматика.

- **Реестр** `scripts/dependency-pins.mts` записывает для каждого пина, где он живёт, и проверку
  условия снятия по npm-реестру.
- **Еженедельная проверка** — задача `dependency-pins` в `.github/workflows/maintenance.yml`, по
  понедельникам. Когда условие выполнилось, она открывает issue «Можно снять пин: …» с меткой
  «пин можно снять» и фактом, на котором основан вывод. Повторно, пока issue открыт, не открывает.
  Состояние всех пинов видно в summary запуска; вручную —
  `node --experimental-strip-types scripts/dependency-pins.mts report`.
- **Тест** `scripts/__tests__/dependency-pins.test.ts` падает, если `overrides` в `package.json` или
  ignore-правила npm в `.github/dependabot.yml` расходятся с реестром, или если таблица выше
  расходится с ним по составу. Новый пин нельзя завести, не написав, когда его снимать.

Чтобы добавить пин, в одном PR измените конфигурацию, добавьте запись в реестр с проверкой и строку
в таблицу. Снятый пин так же в одном PR удаляется из всех трёх мест, с полным gate. История:
override `mermaid → katex 0.18.9` снят в октябре 2026, когда mermaid 12.2.0 сам перешёл на
`katex ^0.18`. Override `@xmldom/xmldom 0.9.12` снят 12 ноября 2026 года
([issue #136](https://github.com/Kert0n/KPO/issues/136)): MathJax 3 разрешает
`speech-rule-engine ^4.0.6`, а `speech-rule-engine 4.1.5` сам требует
`@xmldom/xmldom ^0.9.12`.

## Как разбирать пакет PR

1. Зафиксировать SHA `master` и heads всех PR.
2. Собрать единый кандидат от актуального `master`, разрешив lockfile через package manager, а не ручным объединением JSON.
3. Проверить `npm ls` на `invalid` и несовпадающие версии парных пакетов, например `vitest` и `@vitest/coverage-v8`.
4. Исправлять миграционные ошибки в конфигурации или коде; не ослаблять assertions и quality gates.
5. После зелёного локального прогона отправить integration PR и дождаться required checks.
6. Удалить закрытые Dependabot-ветки после merge.

В июле 2026 года пакет обновлений потребовал перехода с TypeScript 5.9.3 на максимально поддерживаемый 6.0.3 и удаления устаревшего `baseUrl`. Попытки TypeScript 7 и MathJax plugin 5 были отклонены как несовместимые с текущими peer-контрактами; одиночное visual-падение при обновлении `setup-node` рассматривалось как потенциальная нестабильность и перепроверялось в общем кандидате без автоматической замены snapshot.

## Проверка релизов 12 ноября 2026

- [Issue #136](https://github.com/Kert0n/KPO/issues/136): условие снятия xmldom override
  выполнено; в lockfile обновлена цепочка MathJax 3 → speech-rule-engine 4.1.5 → xmldom 0.9.12.
- [Issue #103](https://github.com/Kert0n/KPO/issues/103): стабильная VitePress по-прежнему
  1.6.4, `next` — 2.0.0-alpha.21. Ждём стабильную 2.x для исправления восстановления прокрутки;
  обновление hash при прокрутке upstream по-прежнему не планирует.
- Новее проблемной `@types/markdown-it 14.2.0` стабильного выпуска нет; остаёмся на 14.1.2.
- `typescript-eslint 8.72.2` поддерживает TypeScript `<6.1.0`; TypeScript 7.0.2 пока отложен.
- VitePress 1.6.4 сохраняет контракты markdown-it 14 и markdown-it-mathjax3 4;
  переходы на 15 и 5 отложены. Vite обновлён в поддерживаемой ветке 6.4 до 6.4.6.
- Kotlin обновлён до 2.4.21, доступной как `latestStable` в
  [Kotlin Playground API](https://api.kotlinlang.org/versions); Gradle — до 9.9.1
  с проверкой SHA-256 дистрибутива.
- Добавлен временный override minimatch 11.0.1 для
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
  Реестр проверяет все три родительских пакета перед снятием override.
- Сохранён mdurl 2.0.0 через scoped override: новый 2.1.0 приносит встроенные типы,
  несовместимые с ESM/CJS-декларациями `@types/markdown-it 14.1.2`. Условие повторной проверки
  записано в реестр пинов.
- Проверка доступности Kotlin API в maintenance переведена на `/versions` актуального
  `api.kotlinlang.org`: прежний `play.kotlinlang.org/api/compiler/latest` возвращает 404.
