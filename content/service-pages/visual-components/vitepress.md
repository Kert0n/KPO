---
title: Visual Component Fixtures
sidebar: false
search: false
outline: false
lastUpdated: false
---

# Visual Component Fixtures

This page is intentionally hidden from navigation. It contains stable markup fixtures for layout, markdown extensions,
language switchers, Mermaid, tables, images and Kotlin Playground behavior.

## Code Switchers Without Author Defaults

:::: multi-code "Fixture switcher one"

```kotlin
val value = "one"
```

```kotlin playground
val value = "one"
```

```csharp
var value = "one";
```

```java
var value = "one";
```

```go
value := "one"
```

::::

:::: multi-code "Fixture switcher two"

```kotlin
val value = "two"
```

```csharp
var value = "two";
```

```java
var value = "two";
```

```go
value := "two"
```

::::

:::: multi-code "Fixture switcher three"

```kotlin
val value = "three"
```

```csharp
var value = "three";
```

```java
var value = "three";
```

```go
value := "three"
```

::::

## Author Default

:::: multi-code "Fixture author default" {default=go}

```kotlin
val selected = "kotlin"
```

```csharp
var selected = "csharp";
```

```java
var selected = "java";
```

```go
selected := "go"
```

::::

## Playground

:::: multi-code "Fixture Kotlin Playground"

```kotlin
fun answer(): Int = 42
```

```kotlin playground
fun answer(): Int = 42

fun main() {
    println(answer())
}
```

```csharp
int Answer() => 42;
```

```java
int answer() {
    return 42;
}
```

```go
func answer() int {
    return 42
}
```

::::
