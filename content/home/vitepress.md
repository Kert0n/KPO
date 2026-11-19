---
layout: KpoHome
sidebar: false
---

:::: multi-code "Темы первых трёх лекций"

```kotlin
fun main() {
    val topics = listOf(
        "Введение в КПО",
        "Внедрение зависимостей",
        "Юнит-тесты",
    )
    for ((index, topic) in topics.withIndex()) {
        println("Лекция ${index + 1}: $topic")
    }
}
```

```kotlin playground
fun main() {
    val topics = listOf(
        "Введение в КПО",
        "Внедрение зависимостей",
        "Юнит-тесты",
        // Добавьте сюда строку "Порождающие паттерны",
    )
    for ((index, topic) in topics.withIndex()) {
        println("Лекция ${index + 1}: $topic")
    }
}
```

```csharp
using System;

var topics = new[]
{
    "Введение в КПО",
    "Внедрение зависимостей",
    "Юнит-тесты"
};
for (var i = 0; i < topics.Length; i++)
{
    Console.WriteLine($"Лекция {i + 1}: {topics[i]}");
}
```

```java
import java.util.List;

public class Main {
    public static void main(String[] args) {
        var topics = List.of(
            "Введение в КПО",
            "Внедрение зависимостей",
            "Юнит-тесты"
        );
        for (int i = 0; i < topics.size(); i++) {
            System.out.println("Лекция " + (i + 1) + ": " + topics.get(i));
        }
    }
}
```

```go
package main

import "fmt"

func main() {
	topics := []string{
		"Введение в КПО",
		"Внедрение зависимостей",
		"Юнит-тесты",
	}
	for i, topic := range topics {
		fmt.Printf("Лекция %d: %s\n", i+1, topic)
	}
}
```

::::
