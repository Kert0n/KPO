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

## Major-версии

Major-обновление принимается только когда все прямые peer-контракты его поддерживают. В конфигурации временно зафиксированы два ограничения:

- следующая major-версия `markdown-it-mathjax3` отложена, пока VitePress 1.6.4 требует `markdown-it-mathjax3 ^4`;
- следующая major-версия TypeScript отложена, пока `typescript-eslint` 8.63 поддерживает TypeScript только до версии 6.0 включительно.

Эти ограничения относятся к version updates и не должны скрывать security updates. При обновлении VitePress или `typescript-eslint` соответствующее правило нужно удалить и прогнать полный gate.

## Security overrides

`overrides` в `package.json` закрывают уязвимости транзитивных зависимостей, которые нельзя поднять
обычным обновлением. Каждый override снимается, как только родительский пакет сам перейдёт на
исправленную версию:

- `mermaid → katex 0.18.9` — mermaid 12.1.0 требует `katex ^0.16.47`, а GHSA-238p-pmpm-9mq7 исправлена
  только с 0.18.2; mermaid вызывает katex лишь через `renderToString` для формул в диаграммах;
- `gray-matter → js-yaml → argparse 2.0.1` — GHSA-hp3w-g68c-fv3c в `sprintf-js` не исправлена ни в
  одной версии; js-yaml 3 использует argparse только в своей CLI, а argparse 2 не зависит от sprintf-js.

## Как разбирать пакет PR

1. Зафиксировать SHA `master` и heads всех PR.
2. Собрать единый кандидат от актуального `master`, разрешив lockfile через package manager, а не ручным объединением JSON.
3. Проверить `npm ls` на `invalid` и несовпадающие версии парных пакетов, например `vitest` и `@vitest/coverage-v8`.
4. Исправлять миграционные ошибки в конфигурации или коде; не ослаблять assertions и quality gates.
5. После зелёного локального прогона отправить integration PR и дождаться required checks.
6. Удалить закрытые Dependabot-ветки после merge.

В июле 2026 года пакет обновлений потребовал перехода с TypeScript 5.9.3 на максимально поддерживаемый 6.0.3 и удаления устаревшего `baseUrl`. Попытки TypeScript 7 и MathJax plugin 5 были отклонены как несовместимые с текущими peer-контрактами; одиночное visual-падение при обновлении `setup-node` рассматривалось как потенциальная нестабильность и перепроверялось в общем кандидате без автоматической замены snapshot.
