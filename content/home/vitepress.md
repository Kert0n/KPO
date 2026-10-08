---
layout: KpoHome
sidebar: false
---

:::: multi-code "Первые темы курса"

```kotlin
fun main() {
    val topics = listOf("SOLID", "DI", "Тесты")
    for ((index, topic) in topics.withIndex()) {
        println("Лекция ${index + 1}: $topic")
    }
}
```

```kotlin playground
fun main() {
    val topics = listOf("SOLID", "DI", "Тесты")
    for ((index, topic) in topics.withIndex()) {
        println("Лекция ${index + 1}: $topic")
    }
}
```

```csharp
var topics = new[] { "SOLID", "DI", "Тесты" };
for (var i = 0; i < topics.Length; i++)
{
    Console.WriteLine($"Лекция {i + 1}: {topics[i]}");
}
```

```java
import java.util.List;

public class Main {
    public static void main(String[] args) {
        var topics = List.of("SOLID", "DI", "Тесты");
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
    topics := []string{"SOLID", "DI", "Тесты"}
    for i, topic := range topics {
        fmt.Printf("Лекция %d: %s\n", i+1, topic)
    }
}
```

::::
