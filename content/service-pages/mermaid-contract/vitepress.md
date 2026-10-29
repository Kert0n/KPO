---
title: Mermaid Contract Fixture
description: Internal fixture for Mermaid label layout across browser engines.
sidebar: false
noindex: true
askAi: false
search: false
outline: false
lastUpdated: false
---

# Mermaid Contract Fixture

This internal page holds diagrams whose node labels are long enough to wrap: Cyrillic text, explicit `<br/>`
line breaks and labels that wrap on their own. The browser tests check that no label is clipped by its node in
any engine and at any diagram scale. The diagrams reproduce the ones reported in issue #127.

## Bottom-to-top pyramid

```mermaid
flowchart BT
    Unit["Много unit-тестов<br/>быстрые, локальные, точные"] --> Integration["Меньше интеграционных<br/>проверяют связи"]
    Integration --> System["Еще меньше системных<br/>проверяют продукт целиком"]
    System --> E2E["Немного e2e<br/>дорогие пользовательские сценарии"]
```

## Wide fan-out that is scaled down to fit

```mermaid
flowchart TD
    Tradeoff["Тесты всегда балансируют критерии"] --> Trivial["Тривиальные тесты<br/>быстрые и устойчивые<br/>но плохо ловят баги"]
    Tradeoff --> Brittle["Хрупкие тесты<br/>могут ловить баги<br/>но падают от рефакторинга"]
    Tradeoff --> Functional["Функциональные тесты<br/>хорошо ловят баги<br/>но дают медленную обратную связь"]
    Tradeoff --> Valuable["Ценные unit-тесты<br/>важная логика<br/>быстро<br/>без привязки к реализации"]
```

## Mixed shapes

```mermaid
flowchart TD
    Controller["Humble controller<br/>принимает запрос и вызывает сервис"] --> Service["Domain service<br/>сложная логика без тяжелого окружения"]
    Controller --> Db[(Repository)]
    Controller --> Http[External client]
    Service --> Rules[Бизнес-правила]
```

## Edge labels

```mermaid
flowchart LR
    Client["Клиент"] -->|"запрос с длинной подписью на ребре, которая переносится"| Api["Сервис"]
    Api -->|"ответ"| Client
```
