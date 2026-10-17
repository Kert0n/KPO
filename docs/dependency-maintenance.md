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

| Что держим                                 | Где              | Почему                                                                                                                                                       | Когда снимать                                                    |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `markdown-it` и `@types/markdown-it` на 14 | `dependabot.yml` | VitePress 1.6.4 отдаёт плагинам инстанс markdown-it 14; типы 15 с ним не совпадают                                                                           | VitePress перейдёт на markdown-it 15                             |
| `@types/markdown-it` не 14.2.0             | `dependabot.yml` | 14.2.0 собран криво: `lib/*.d.mts` и `dist/index.cjs.d.ts` расходятся, typecheck падает                                                                      | выйдет версия новее 14.2.0                                       |
| `markdown-it-mathjax3` на 4                | `dependabot.yml` | VitePress 1.6.4 требует `markdown-it-mathjax3 ^4`                                                                                                            | VitePress перейдёт на 5                                          |
| TypeScript на 6                            | `dependabot.yml` | `typescript-eslint` 8.71 поддерживает TypeScript `<6.1`                                                                                                      | `typescript-eslint` разрешит TypeScript 7                        |
| `vitepress → vite 6.4.4`                   | `overrides`      | VitePress 1.6.4 просит `vite ^5.4.14` (последняя 5.x — 5.4.21), а vitest 5 требует `^6.4`; override держит одну поддерживаемую копию vite для сайта и тестов | выйдет стабильная VitePress 2 со своим vite 6+                   |
| `@xmldom/xmldom 0.9.12`                    | `overrides`      | MathJax 3 → `speech-rule-engine` 4.1.4 жёстко требует уязвимую 0.9.10; 4.1.4 — последний выпуск ветки 4.x                                                    | `speech-rule-engine` 4.x или MathJax перейдут на xmldom ≥ 0.9.12 |
| `gray-matter → js-yaml → argparse 2.0.1`   | `overrides`      | GHSA-hp3w-g68c-fv3c в `sprintf-js` не исправлена ни в одной версии; js-yaml 3 использует argparse только в CLI, а argparse 2 не зависит от sprintf-js        | gray-matter перейдёт на js-yaml 4                                |

Снятый пин удаляется и из таблицы, и из конфигурации в одном PR, с полным gate. История: override
`mermaid → katex 0.18.9` снят в октябре 2026, когда mermaid 12.2.0 сам перешёл на `katex ^0.18`.

## Как разбирать пакет PR

1. Зафиксировать SHA `master` и heads всех PR.
2. Собрать единый кандидат от актуального `master`, разрешив lockfile через package manager, а не ручным объединением JSON.
3. Проверить `npm ls` на `invalid` и несовпадающие версии парных пакетов, например `vitest` и `@vitest/coverage-v8`.
4. Исправлять миграционные ошибки в конфигурации или коде; не ослаблять assertions и quality gates.
5. После зелёного локального прогона отправить integration PR и дождаться required checks.
6. Удалить закрытые Dependabot-ветки после merge.

В июле 2026 года пакет обновлений потребовал перехода с TypeScript 5.9.3 на максимально поддерживаемый 6.0.3 и удаления устаревшего `baseUrl`. Попытки TypeScript 7 и MathJax plugin 5 были отклонены как несовместимые с текущими peer-контрактами; одиночное visual-падение при обновлении `setup-node` рассматривалось как потенциальная нестабильность и перепроверялось в общем кандидате без автоматической замены snapshot.
