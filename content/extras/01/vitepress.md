---
title: Песочница
order: 1
---

# Песочница

Это место для практики, а не отдельная лекция. Сюда удобно переносить короткие фрагменты из материала, менять правила и смотреть, как меняется поведение.

## Runnable Kotlin Playground

Включите Playground на блоке ниже, измените лимит или входные данные и запустите код снова.

::: multi-code "Проверка правила скидки"

```kotlin
data class Order(val total: Int, val customerTier: String)

fun hasDiscount(order: Order): Boolean {
    return order.total >= 10_000 || order.customerTier == "pro"
}
```

```kotlin playground
data class Order(val total: Int, val customerTier: String)

fun hasDiscount(order: Order): Boolean {
    return order.total >= 10_000 || order.customerTier == "pro"
}

fun main() {
    val orders = listOf(
        Order(total = 7_500, customerTier = "basic"),
        Order(total = 12_000, customerTier = "basic"),
        Order(total = 3_000, customerTier = "pro")
    )

    for (order in orders) {
        println("$order -> discount=${hasDiscount(order)}")
    }
}
```

```csharp
public sealed record Order(int Total, string CustomerTier);

static bool HasDiscount(Order order)
{
    return order.Total >= 10_000 || order.CustomerTier == "pro";
}
```

```java
record Order(int total, String customerTier) {}

static boolean hasDiscount(Order order) {
    return order.total() >= 10_000 || order.customerTier().equals("pro");
}
```

```go
type Order struct {
    Total        int
    CustomerTier string
}

func HasDiscount(order Order) bool {
    return order.Total >= 10_000 || order.CustomerTier == "pro"
}
```

:::

## шаблон для эксперимента

1. Скопируйте код из лекции.
2. Измените одно правило: порог, условие, формат сообщения или стратегию выбора.
3. Запустите пример.
4. Вернитесь к лекции и проверьте, какая идея стала понятнее.

::: warning Важно
Не пытайтесь перенести сюда большой проект целиком. Песочница полезнее, когда пример остается коротким и проверяет одну мысль.
:::
