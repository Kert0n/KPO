---
title: "Hello World: Kotlin Playground"
---

# Hello World: Kotlin Playground

Kotlin Playground превращает Kotlin-блок в небольшой редактор прямо внутри конспекта: код можно менять, запускать и смотреть вывод без локальной установки Kotlin или JDK. Это удобно для коротких архитектурных примеров, где важна не только подсветка, но и проверяемое поведение.

Выбранный язык запоминается для всех примеров и сохраняется при переходе между страницами. Тумблер `Playground` появляется в верхней панели только когда выбран Kotlin: он отключает интерактивный режим для Kotlin-примеров и оставляет обычный подсвеченный код без инициализации редактора.

::: multi-code "Hello World" {default=kotlin playground=kotlin}

```kotlin
fun main() {
    println("Hello, architecture!")
}
```

```csharp
Console.WriteLine("Hello, architecture!");
```

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, architecture!");
    }
}
```

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, architecture!")
}
```

:::
