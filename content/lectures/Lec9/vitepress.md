# Лекция 9. Сравнительный анализ СУБД в системном дизайне

Эта лекция посвящена одному из ключевых решений в системном дизайне: как выбрать базу данных. После архитектурных
паттернов из предыдущей лекции мы переходим к вопросу хранения состояния. Сервис, правильно спроектированный по
границам и зависимостям, все равно должен где-то сохранять данные. Выбор хранилища определяет производительность,
отказоустойчивость, стоимость эксплуатации и набор компромиссов, с которыми команда будет жить годами.

Материал написан как самостоятельная статья. Если вы пропустили лекцию, начните отсюда: после чтения вы должны понимать,
почему одна БД не может быть лучшей во всем, как работает теорема CAP, по каким измерениям сравнивать СУБД, какие классы
баз данных существуют и когда каждый из них уместен, как выглядит polyglot persistence на практике и какие trade-offs
стоят за каждым выбором.

::: tip Главная идея лекции
Выбор СУБД - это не поиск "самой крутой" технологии. Это поиск наименее болезненного компромисса. Системный аналитик
отличается от программиста тем, что сознательно выбирает, с какой частью ограничений его команда готова мириться.
:::

::: tip Как работать с примерами
Примеры кода показывают прикладные решения на стороне приложения: как выбрать шард, как реализовать cache-aside, как
маршрутизировать запросы между primary и replica. Kotlin-вкладки там, где код можно запустить, имеют отдельную
Playground-версию с `main` и демонстрационным выводом.
:::

## Сквозной сценарий

Возьмем интернет-магазин, который растет. В начале у стартапа одна PostgreSQL на managed-сервисе. Все работает: заказы,
каталог товаров, сессии пользователей, аналитика - все в одной базе. Потом магазин вырастает: каталог нужно искать
полнотекстово, аналитические запросы начинают тормозить транзакции, корзины и сессии требуют миллисекундного отклика,
а данные о кликах льются потоком в 100 тыс. событий в секунду.

```mermaid
flowchart LR
    Start["Один PostgreSQL"] --> Growth["Рост нагрузки"]
    Growth --> Poly["Polyglot persistence"]
    Poly --> PG[("PostgreSQL\nзаказы, ACID")]
    Poly --> Redis[("Redis\nсессии, кэш")]
    Poly --> ES[("Elasticsearch\nпоиск каталога")]
    Poly --> CH[("ClickHouse\nаналитика кликов")]
```

Так появляется polyglot persistence: разные типы данных живут в разных хранилищах, каждое из которых оптимизировано под
свой класс нагрузки. Но это не бесплатно: нужно синхронизировать данные, мониторить несколько систем и понимать trade-offs
каждой из них. Именно этому посвящена лекция.

## Worked example: одна БД на все задачи

### Ситуация

Стартап запускает интернет-магазин. Команда из трех разработчиков выбирает PostgreSQL - надежную, знакомую, с хорошей
экосистемой. В одной базе хранятся заказы, каталог товаров, сессии пользователей, корзины, история кликов для аналитики
и полнотекстовый индекс для поиска.

### Наивное решение

Все таблицы в одной PostgreSQL. Поиск по каталогу через `LIKE '%query%'` или `ts_vector`. Аналитика через тяжелые
`GROUP BY` по таблице кликов. Сессии в таблице с TTL через cron job. Корзина как JSON-колонка в таблице пользователей.

### Что ломается

При росте до 100 тыс. пользователей в день:
- аналитический запрос за год блокирует connection pool на 30 секунд, и транзакции заказов начинают таймаутить;
- полнотекстовый поиск через `ts_vector` не дает релевантность уровня Elasticsearch и тормозит на 500 тыс. товаров;
- таблица сессий разрастается до миллионов строк, VACUUM не успевает, bloat растет;
- запись 100 тыс. событий/сек в таблицу кликов вызывает WAL pressure и тормозит основные транзакции.

### Улучшение

Разделить хранилища по типу нагрузки:
- заказы остаются в PostgreSQL (нужен ACID, сложные транзакции);
- сессии и корзины переезжают в Redis (нужна микросекундная задержка, TTL);
- полнотекстовый поиск каталога уходит в Elasticsearch (синхронизация через CDC);
- аналитика кликов уходит в ClickHouse (колоночное хранение, сжатие, быстрые агрегации).

### Почему это работает

Каждый класс СУБД оптимизирован под определенный тип нагрузки. PostgreSQL отлична для транзакций с ACID, но плоха
для append-only аналитики. Redis отличен для кэша и сессий, но не годится для сложных JOIN. ClickHouse сжимает данные
в 10 раз и агрегирует терабайты за секунды, но плох для UPDATE и точечных выборок. Выбирая правильный инструмент для
каждой задачи, мы получаем систему, где каждая часть работает в зоне своей оптимальности.

## Цели

После этой статьи вы должны уметь:

- объяснять, почему полиглотное хранение стало стандартом индустрии;
- формулировать теорему CAP и показывать, как она ограничивает выбор;
- различать ACID и BASE и объяснять, когда каждый подход уместен;
- применять 12 измерений фреймворка выбора СУБД к конкретной задаче;
- отличать OLTP от OLAP и объяснять, почему их нельзя эффективно совместить;
- различать репликацию, партицирование и шардирование;
- характеризовать основные классы СУБД: реляционные, key-value, документные, колоночные, графовые, временные ряды;
- объяснять сильные стороны и trade-offs конкретных представителей каждого класса;
- проектировать выбор хранилищ для типичных бизнес-сценариев;
- понимать роль managed services и инфраструктурного контекста в выборе БД;
- различать ops complexity разных решений и соотносить их с компетенциями команды;
- читать сводную матрицу trade-offs и применять её к новым задачам.

## Почему нельзя выбрать одну БД на все

### Эволюция подходов к хранению данных

```mermaid
flowchart LR
    Era1["1970–2000\nМонолитная RDBMS\nOracle, DB2"] --> Era2["2000–2010\nNoSQL революция\nBigtable, Dynamo"]
    Era2 --> Era3["2010–н.в.\nPolyglot persistence\nкаждой задаче — своя БД"]
```

В эпоху монолитных приложений одна реляционная база действительно решала почти все задачи. Oracle или DB2 работали на
мощном сервере, масштабировались вертикально, а объемы данных и нагрузки были скромными по сегодняшним меркам.

Когда Google и Amazon столкнулись с масштабами, которые не помещались в одну реляционную БД, появились Bigtable (2006)
и Dynamo (2007). Они пожертвовали частью реляционной модели ради горизонтального масштабирования и доступности. Так
родилось движение NoSQL - не как замена SQL, а как ответ на конкретные ограничения.

Сегодня стандартом является polyglot persistence: в одной системе живут несколько хранилищ, каждое из которых оптимально
для своего класса задач. Это не усложнение ради моды - это инженерный ответ на то, что у каждой БД есть фундаментальные
ограничения, которые невозможно обойти.

### Теорема CAP

Теорема CAP (Brewer, 2000) утверждает: распределенная система не может одновременно обеспечить все три свойства:

- **Consistency** (согласованность) - все узлы видят одинаковые данные в один момент времени;
- **Availability** (доступность) - каждый запрос получает ответ, даже если часть узлов недоступна;
- **Partition tolerance** (устойчивость к разделению) - система продолжает работать при потере связи между узлами.

```mermaid
flowchart TD
    CAP["Теорема CAP"] --> CP["CP: Consistency + Partition tolerance"]
    CAP --> AP["AP: Availability + Partition tolerance"]
    CAP --> CA["CA: Consistency + Availability"]
    CP --> CPex["Банковские транзакции\nHBase, MongoDB (strong read)"]
    AP --> APex["Лента соцсети, лайки\nCassandra, DynamoDB"]
    CA --> CAex["Единственный узел\n(нет network partition)\nТрадиционный PostgreSQL"]
```

В реальной сети partition всегда возможен. Поэтому на практике выбор сводится к CP (жертвуем доступностью ради
согласованности) или AP (жертвуем согласованностью ради доступности).

Банкомат, который показывает баланс, должен быть CP: лучше отказать в обслуживании, чем показать устаревший баланс и
позволить потратить деньги дважды. Лента новостей в соцсети может быть AP: лучше показать пост с задержкой в 2 секунды,
чем выдать ошибку.

::: warning CAP - это не выбор из трех вариантов
Теорема CAP часто упрощается до "выбери два из трех". На практике компромисс более тонкий: система может быть
CP для критичных операций (платежи) и AP для некритичных (рекомендации) одновременно. Разные части одного
приложения могут иметь разные гарантии.

Расширение PACELC уточняет: даже без partition (нормальная работа) приходится выбирать между Latency и Consistency.
Cassandra, например, в нормальном режиме выбирает низкую задержку (EL), а DynamoDB позволяет настраивать
(strong reads дороже и медленнее, eventual reads дешевле и быстрее).
:::

### ACID vs BASE

Два подхода к гарантиям данных представляют спектр, а не бинарный выбор.

**ACID** - классические гарантии транзакционных БД:

- **Atomicity** - транзакция выполняется целиком или не выполняется вовсе;
- **Consistency** - данные переходят из одного допустимого состояния в другое;
- **Isolation** - параллельные транзакции не видят промежуточных состояний друг друга;
- **Durability** - после commit данные сохраняются даже при сбое.

**BASE** - подход распределенных систем:

- **Basically Available** - система почти всегда доступна;
- **Soft state** - состояние может меняться без внешнего воздействия (из-за синхронизации);
- **Eventually consistent** - через конечное время все узлы придут к согласованному состоянию.

| Свойство | ACID | BASE |
|---|---|---|
| Когда нужен | Финансы, инвентарь, критичные бизнес-операции | Социальные фичи, аналитика, кэш, рекомендации |
| Цена | Блокировки, координация, ограниченная масштабируемость | Сложность в коде приложения, возможные аномалии чтения |
| Пример БД | PostgreSQL, MySQL, Oracle | Cassandra, DynamoDB, Redis |
| Масштабирование | Сложнее горизонтально | Проще горизонтально |

::: multi-code "Транзакционная граница: Unit of Work" {default=kotlin}

```kotlin
interface UnitOfWork {
    fun <T> transaction(block: () -> T): T
}

class OrderService(
    private val unitOfWork: UnitOfWork,
    private val orders: OrderRepository,
    private val inventory: InventoryRepository
) {
    fun placeOrder(productId: String, quantity: Int) = unitOfWork.transaction {
        inventory.reserve(productId, quantity)
        orders.create(productId, quantity)
    }
}
```

```kotlin playground
interface UnitOfWork {
    fun <T> transaction(block: () -> T): T
}

class LoggingUnitOfWork : UnitOfWork {
    override fun <T> transaction(block: () -> T): T {
        println("BEGIN")
        return try {
            val result = block()
            println("COMMIT")
            result
        } catch (error: RuntimeException) {
            println("ROLLBACK: ${error.message}")
            throw error
        }
    }
}

class OrderRepository {
    fun create(productId: String, quantity: Int): String {
        println("  INSERT order: $productId x $quantity")
        return "order-1"
    }
}

class InventoryRepository {
    private val stock = mutableMapOf("keyboard" to 5)

    fun reserve(productId: String, quantity: Int) {
        val available = stock.getValue(productId)
        require(available >= quantity) { "not enough stock: $available < $quantity" }
        stock[productId] = available - quantity
        println("  UPDATE inventory: $productId reserved $quantity, left ${stock[productId]}")
    }
}

class OrderService(
    private val unitOfWork: UnitOfWork,
    private val orders: OrderRepository,
    private val inventory: InventoryRepository
) {
    fun placeOrder(productId: String, quantity: Int): String = unitOfWork.transaction {
        inventory.reserve(productId, quantity)
        orders.create(productId, quantity)
    }
}

fun main() {
    val service = OrderService(
        LoggingUnitOfWork(),
        OrderRepository(),
        InventoryRepository()
    )

    println("=== Successful order ===")
    println("Result: ${service.placeOrder("keyboard", 3)}")

    println("\n=== Failed order (not enough stock) ===")
    runCatching { service.placeOrder("keyboard", 5) }
}
```

```csharp
public interface IUnitOfWork
{
    T Transaction<T>(Func<T> block);
}

public sealed class OrderService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly OrderRepository _orders;
    private readonly InventoryRepository _inventory;

    public OrderService(
        IUnitOfWork unitOfWork,
        OrderRepository orders,
        InventoryRepository inventory)
    {
        _unitOfWork = unitOfWork;
        _orders = orders;
        _inventory = inventory;
    }

    public string PlaceOrder(string productId, int quantity) =>
        _unitOfWork.Transaction(() =>
        {
            _inventory.Reserve(productId, quantity);
            return _orders.Create(productId, quantity);
        });
}
```

```java
import java.util.function.Supplier;

interface UnitOfWork {
    <T> T transaction(Supplier<T> block);
}

final class OrderService {
    private final UnitOfWork unitOfWork;
    private final OrderRepository orders;
    private final InventoryRepository inventory;

    OrderService(UnitOfWork unitOfWork, OrderRepository orders, InventoryRepository inventory) {
        this.unitOfWork = unitOfWork;
        this.orders = orders;
        this.inventory = inventory;
    }

    String placeOrder(String productId, int quantity) {
        return unitOfWork.transaction(() -> {
            inventory.reserve(productId, quantity);
            return orders.create(productId, quantity);
        });
    }
}
```

```go
package main

type UnitOfWork interface {
    Transaction(fn func() (string, error)) (string, error)
}

type OrderService struct {
    UoW       UnitOfWork
    Orders    OrderRepository
    Inventory InventoryRepository
}

func (s OrderService) PlaceOrder(productID string, quantity int) (string, error) {
    return s.UoW.Transaction(func() (string, error) {
        if err := s.Inventory.Reserve(productID, quantity); err != nil {
            return "", err
        }
        return s.Orders.Create(productID, quantity)
    })
}
```

:::

Unit of Work гарантирует: если резервирование товара прошло, а создание заказа упало, все откатится. Без ACID-транзакции
пришлось бы писать компенсирующую логику в приложении - saga, outbox, retry. Это возможно, но значительно сложнее.

## Фреймворк выбора: 12 измерений архитектуры

Каждый параметр ниже - это ось компромисса. Ни одна СУБД не побеждает по всем 12 осям одновременно. Задача архитектора -
определить, какие оси критичны для конкретного проекта, и выбрать БД, которая оптимальна именно в этих измерениях.

| № | Критерий | Ключевой вопрос |
|---|---|---|
| 1 | Workload | Данные вставляются или агрегируются? |
| 2 | Read/Write Ratio | Что преобладает: чтение или запись? |
| 3 | Latency (P99) | Допустима ли хвостовая задержка > 100 мс? |
| 4 | Consistency | Допустимо ли прочитать устаревшую версию? |
| 5 | Transactions | Критичны ли атомарные многообъектные изменения? |
| 6 | Query Patterns | Какой тип запросов доминирует? |
| 7 | Data Model | Как структурированы бизнес-данные? |
| 8 | Scale | Будет ли рост в 10x-100x? |
| 9 | HA & Failover | Что страшнее: потеря данных или простой? |
| 10 | Ops Complexity | Есть ли в команде эксперты по этой БД? |
| 11 | Licensing & Lock-in | Сможете ли мигрировать к другому вендору? |
| 12 | Ecosystem | Как БД вписывается в текущий стек? |

### 1. Тип нагрузки (Workload) - OLTP vs OLAP vs HTAP

Первая развилка: данные обрабатываются транзакционно (по одной операции) или аналитически (массово).

| Критерий | OLTP | OLAP |
|---|---|---|
| Пример | Оформить заказ, списать остаток | Отчет продаж за год, тренды по регионам |
| Данные | Актуальные, операционные | Исторические, агрегированные |
| Запросы | Короткие, точечные, много параллельных | Тяжелые, сканируют терабайты, мало параллельных |
| Индексы | B-Tree для точечного поиска | Колоночное хранение для быстрого сканирования |
| Главный риск | Потерять платеж или продать отсутствующий товар | Медленный отчет или устаревшая аналитика |
| Типичный выбор | PostgreSQL, MySQL, SQL Server | ClickHouse, BigQuery, Snowflake |

```mermaid
flowchart LR
    User["Пользователь"] --> App["Сервисы магазина"]
    App --> OLTP[("OLTP\nPostgreSQL")]
    OLTP -->|"CDC / ETL"| OLAP[("OLAP\nClickHouse")]
    Analyst["Аналитик"] --> OLAP
```

HTAP (Hybrid Transactional/Analytical Processing) пытается совместить оба типа нагрузки в одной системе. На практике
это сложно: транзакционная нагрузка требует строковых блокировок, а аналитическая - полного сканирования без блокировок.
Большинство проектов приходит к разделению: OLTP-база для операций и отдельное аналитическое хранилище, связанные через
CDC (Change Data Capture) или ETL.

::: multi-code "CQRS: разделение модели чтения и записи" {default=kotlin}

```kotlin
data class CreateOrderCommand(val productId: String, val quantity: Int, val customerId: String)
data class OrderSummaryQuery(val customerId: String)

data class OrderSummary(val orderId: String, val productName: String, val total: Int)

interface CommandHandler {
    fun handle(command: CreateOrderCommand): String
}

interface QueryHandler {
    fun handle(query: OrderSummaryQuery): List<OrderSummary>
}
```

```kotlin playground
data class CreateOrderCommand(val productId: String, val quantity: Int, val customerId: String)
data class OrderSummaryQuery(val customerId: String)
data class OrderSummary(val orderId: String, val productName: String, val total: Int)

interface CommandHandler {
    fun handle(command: CreateOrderCommand): String
}

interface QueryHandler {
    fun handle(query: OrderSummaryQuery): List<OrderSummary>
}

class InMemoryCommandHandler : CommandHandler {
    private var counter = 0
    override fun handle(command: CreateOrderCommand): String {
        val id = "order-${++counter}"
        println("WRITE to OLTP: $id for ${command.customerId}")
        return id
    }
}

class InMemoryQueryHandler : QueryHandler {
    override fun handle(query: OrderSummaryQuery): List<OrderSummary> {
        println("READ from OLAP: orders for ${query.customerId}")
        return listOf(OrderSummary("order-1", "Keyboard", 2))
    }
}

fun main() {
    val commands: CommandHandler = InMemoryCommandHandler()
    val queries: QueryHandler = InMemoryQueryHandler()

    val orderId = commands.handle(CreateOrderCommand("kb-1", 2, "customer-42"))
    println("Created: $orderId")

    val summary = queries.handle(OrderSummaryQuery("customer-42"))
    println("Summary: $summary")
}
```

```csharp
public sealed record CreateOrderCommand(string ProductId, int Quantity, string CustomerId);
public sealed record OrderSummaryQuery(string CustomerId);
public sealed record OrderSummary(string OrderId, string ProductName, int Total);

public interface ICommandHandler
{
    string Handle(CreateOrderCommand command);
}

public interface IQueryHandler
{
    IReadOnlyList<OrderSummary> Handle(OrderSummaryQuery query);
}
```

```java
record CreateOrderCommand(String productId, int quantity, String customerId) {}
record OrderSummaryQuery(String customerId) {}
record OrderSummary(String orderId, String productName, int total) {}

interface CommandHandler {
    String handle(CreateOrderCommand command);
}

interface QueryHandler {
    List<OrderSummary> handle(OrderSummaryQuery query);
}
```

```go
package main

type CreateOrderCommand struct {
    ProductID  string
    Quantity   int
    CustomerID string
}

type OrderSummaryQuery struct {
    CustomerID string
}

type OrderSummary struct {
    OrderID     string
    ProductName string
    Total       int
}

type CommandHandler interface {
    Handle(cmd CreateOrderCommand) (string, error)
}

type QueryHandler interface {
    Handle(q OrderSummaryQuery) ([]OrderSummary, error)
}
```

:::

CQRS (Command Query Responsibility Segregation) - архитектурное следствие разделения OLTP и OLAP. Команды пишут в
транзакционную БД, запросы читают из оптимизированной read-модели. Между ними - механизм синхронизации (CDC, events,
ETL).

### 2. Коэффициент чтения/записи (Read/Write Ratio)

- **95% чтения** - подходят read replicas, кэш (Redis), CDN для статики. PostgreSQL с несколькими репликами
  справляется отлично.
- **95% записи** - нужны хранилища, оптимизированные под append-only: LSM-деревья (Cassandra, ClickHouse, RocksDB).
  B-Tree обновления на месте фрагментируют диск при высокой конкуренции записей.

| Структура | Чтение | Запись | Где используется |
|---|---|---|---|
| B-Tree | Быстрое (O(log n), sorted) | Медленнее (random I/O, split) | PostgreSQL, MySQL, SQL Server |
| LSM-Tree | Медленнее (merge read) | Очень быстрое (sequential I/O) | Cassandra, ClickHouse, RocksDB, LevelDB |

Если система пишет данные значительно чаще, чем читает (логирование, IoT-телеметрия, clickstream), LSM-дерево выигрывает
за счет последовательной записи на диск. Если система преимущественно читает (каталог товаров, справочники), B-Tree дает
предсказуемо быстрый поиск по индексу.

### 3. Требования к задержке (Latency)

Критична не средняя задержка, а хвостовая - P99 и P999. Если средняя задержка 5 мс, но P99 = 2 сек, каждый сотый
пользователь ждет 2 секунды.

```mermaid
flowchart LR
    Budget["Бюджет задержки: 200 мс"] --> Network["Сеть: 10 мс"]
    Network --> App["Приложение: 20 мс"]
    App --> DB["БД: 100 мс"]
    DB --> Serial["Сериализация: 10 мс"]
    Serial --> Remains["Запас: 60 мс"]
```

| Требование P99 | Подходящий класс | Пример |
|---|---|---|
| < 1 мс | In-memory (RAM only) | Redis, Memcached |
| 1-10 мс | In-memory с персистентностью или SSD | Redis с AOF, ScyllaDB |
| 10-100 мс | SSD-оптимизированные | PostgreSQL, MongoDB на NVMe |
| 100+ мс | Дисковые, distributed | BigQuery, HBase |

### 4. Модель согласованности (Consistency Model)

| Модель | Гарантия | Пример применения | Цена |
|---|---|---|---|
| Linearizability (сильная) | Все видят одно значение в каждый момент | Банковский баланс, бронирование | Высокая задержка, низкая доступность при partition |
| Sequential | Все видят операции в одном порядке | Чат-сообщения | Координация между узлами |
| Causal | Причинно-связанные операции видны в правильном порядке | Комментарии (ответ после оригинала) | Tracking dependencies |
| Eventual | Через конечное время все узлы сойдутся | Лайки, счетчики просмотров | Временные аномалии |

::: multi-code "Маршрутизация чтения: primary vs replica" {default=kotlin}

```kotlin
enum class ReadConsistency { STRONG, EVENTUAL }

class ConnectionRouter(
    private val primary: String,
    private val replicas: List<String>
) {
    private var roundRobin = 0

    fun route(consistency: ReadConsistency): String = when (consistency) {
        ReadConsistency.STRONG -> primary
        ReadConsistency.EVENTUAL -> {
            val replica = replicas[roundRobin % replicas.size]
            roundRobin++
            replica
        }
    }
}
```

```kotlin playground
enum class ReadConsistency { STRONG, EVENTUAL }

class ConnectionRouter(
    private val primary: String,
    private val replicas: List<String>
) {
    private var roundRobin = 0

    fun route(consistency: ReadConsistency): String = when (consistency) {
        ReadConsistency.STRONG -> primary
        ReadConsistency.EVENTUAL -> {
            val replica = replicas[roundRobin % replicas.size]
            roundRobin++
            replica
        }
    }
}

fun main() {
    val router = ConnectionRouter(
        primary = "pg-primary:5432",
        replicas = listOf("pg-replica-1:5432", "pg-replica-2:5432")
    )

    println("Balance check (strong): ${router.route(ReadConsistency.STRONG)}")
    println("Product catalog (eventual): ${router.route(ReadConsistency.EVENTUAL)}")
    println("Product catalog (eventual): ${router.route(ReadConsistency.EVENTUAL)}")
    println("Payment confirm (strong): ${router.route(ReadConsistency.STRONG)}")
}
```

```csharp
public enum ReadConsistency { Strong, Eventual }

public sealed class ConnectionRouter
{
    private readonly string _primary;
    private readonly IReadOnlyList<string> _replicas;
    private int _roundRobin;

    public ConnectionRouter(string primary, IReadOnlyList<string> replicas)
    {
        _primary = primary;
        _replicas = replicas;
    }

    public string Route(ReadConsistency consistency) => consistency switch
    {
        ReadConsistency.Strong => _primary,
        ReadConsistency.Eventual => _replicas[_roundRobin++ % _replicas.Count],
        _ => _primary
    };
}
```

```java
enum ReadConsistency { STRONG, EVENTUAL }

final class ConnectionRouter {
    private final String primary;
    private final List<String> replicas;
    private int roundRobin = 0;

    ConnectionRouter(String primary, List<String> replicas) {
        this.primary = primary;
        this.replicas = replicas;
    }

    String route(ReadConsistency consistency) {
        return switch (consistency) {
            case STRONG -> primary;
            case EVENTUAL -> replicas.get(roundRobin++ % replicas.size());
        };
    }
}
```

```go
package main

type ReadConsistency int

const (
    Strong ReadConsistency = iota
    Eventual
)

type ConnectionRouter struct {
    Primary    string
    Replicas   []string
    roundRobin int
}

func (r *ConnectionRouter) Route(consistency ReadConsistency) string {
    if consistency == Strong {
        return r.Primary
    }
    replica := r.Replicas[r.roundRobin%len(r.Replicas)]
    r.roundRobin++
    return replica
}
```

:::

Этот паттерн позволяет приложению явно выбирать уровень согласованности. Баланс пользователя читаем с primary
(сильная согласованность), каталог товаров - с реплики (eventual, зато быстрее и не нагружает primary).

### 5. Транзакции (ACID vs BASE)

Нужны ли распределенные транзакции? Если бизнес-операция затрагивает данные в одной БД, достаточно локальной
ACID-транзакции. Если операция проходит через несколько сервисов или баз:

| Подход | Атомарность | Задержка | Доступность | Сложность |
|---|---|---|---|---|
| XA (двухфазный коммит) | Полная | Высокая (ждем все участники) | Падает (координатор = SPOF) | Протокол сложный, debug тяжелый |
| Saga | Eventual (компенсация) | Низкая (асинхронные шаги) | Высокая | Компенсирующая логика, idempotency |
| Transaction Outbox | Eventual (reliable) | Низкая | Высокая | Отдельный publisher, polling или CDC |

Для большинства CRUD-операций достаточно локального ACID (Unit of Work из примера выше). Распределенные транзакции -
тема [Лекции 10](/lectures/10) про межсервисное взаимодействие.

### 6. Паттерны запросов (Query Patterns)

| Паттерн запроса | Лучший класс БД | Пример |
|---|---|---|
| Точечный поиск по PK | Key-Value | `GET user:42` |
| Диапазонное сканирование | RDBMS, sorted KV | `WHERE created_at > '2024-01-01'` |
| Сложные JOIN (3+ таблиц) | RDBMS | `SELECT ... JOIN orders JOIN products JOIN customers` |
| Полнотекстовый поиск | Search engine | "красные кроссовки Nike размер 42" |
| Обход графа на 3-5 шагов | Graph DB | "друзья друзей, купившие X" |
| Агрегации по терабайтам | Columnar / OLAP | `SELECT region, SUM(revenue) GROUP BY region` |
| Временной ряд с окнами | Time-series DB | `SELECT avg(cpu) WHERE time > now() - 1h GROUP BY 5m` |

::: warning Если запрос содержит 3+ JOIN - NoSQL не подходит
Документные и key-value базы оптимизированы для чтения единого агрегата. Если бизнес-логика требует частых соединений
между коллекциями, реляционная модель будет значительно эффективнее. `$lookup` в MongoDB или ручное соединение в
приложении - это всегда медленнее и сложнее, чем нативный JOIN с оптимизатором.
:::

### 7. Модель данных (Data Model)

```mermaid
flowchart TD
    Question["Какая форма данных?"] --> Tabular{"Стабильная табличная структура?"}
    Tabular -->|"да"| RDBMS["RDBMS\nPostgreSQL, MySQL"]
    Tabular -->|"нет"| Nested{"Вложенные документы?"}
    Nested -->|"да"| DocDB["Document DB\nMongoDB, Couchbase"]
    Nested -->|"нет"| Relations{"Важны связи между объектами?"}
    Relations -->|"да"| GraphDB["Graph DB\nNeo4j, JanusGraph"]
    Relations -->|"нет"| Simple{"Простой ключ-значение?"}
    Simple -->|"да"| KV["Key-Value\nRedis, DynamoDB"]
    Simple -->|"нет"| TimeBased{"Данные с временной осью?"}
    TimeBased -->|"да"| TSDB["Time-series\nInfluxDB, TimescaleDB"]
    TimeBased -->|"нет"| Columnar["Columnar\nClickHouse, BigQuery"]
```

Модель данных - не про "что модно", а про то, как бизнес-данные реально организованы. Если товар в каталоге имеет
вложенные характеристики, которые различаются у разных категорий (у электроники - вольтаж, у одежды - размер),
документная модель подходит лучше, чем десятки nullable-колонок в реляционной таблице.

### 8. Масштабирование (Scaling)

**Вертикальное** (scale up) - добавить CPU, RAM, SSD на один сервер. Просто, но есть физический потолок.

**Горизонтальное** (scale out) - распределить данные по нескольким серверам. Сложно, но теоретически безгранично.

```mermaid
flowchart LR
    App["Application"] --> Router["Shard router"]
    Router --> ShardA[("Shard A\ncustomers 1-1M")]
    Router --> ShardB[("Shard B\ncustomers 1M-2M")]
    Router --> ShardC[("Shard C\ncustomers 2M-3M")]
    ShardA --> ReplicaA[("Replica A")]
    ShardB --> ReplicaB[("Replica B")]
    ShardC --> ReplicaC[("Replica C")]
```

| СУБД | Горизонтальное масштабирование |
|---|---|
| PostgreSQL | Сложно (нужен Citus или ручное шардирование) |
| MySQL | Средне (Vitess, ProxySQL) |
| Cassandra | Из коробки (consistent hashing, vnodes) |
| MongoDB | Из коробки (config server + mongos router) |
| ClickHouse | Из коробки (distributed tables) |
| Redis | Cluster mode (hash slots) |

::: warning Цена шардирования
Шардирование усложняет JOIN между шардами, распределенные транзакции, миграции данных, бэкапы, rebalancing и
расследование инцидентов. Если проект можно надежно вести на одной PostgreSQL с индексами, репликами и мониторингом,
это часто лучше преждевременного распределения данных.
:::

::: details Connection pooling: масштабирование до шардирования
Прежде чем шардировать, стоит проверить, не упираетесь ли вы в лимит соединений. PostgreSQL создает отдельный
процесс на каждое соединение. При 1000 одновременных запросах это 1000 процессов и гигабайты RAM. Connection pooler
(PgBouncer, PgCat) держит пул из 20-50 реальных соединений и мультиплексирует тысячи клиентских.
Часто это снимает проблему производительности без шардирования.
:::

::: multi-code "Выбор шарда по идентификатору клиента" {default=kotlin}

```kotlin
data class Shard(val name: String, val endpoint: String)

class ShardRouter(private val shards: List<Shard>) {
    fun route(customerId: Long): Shard {
        val index = Math.floorMod(customerId.hashCode(), shards.size)
        return shards[index]
    }
}
```

```kotlin playground
data class Shard(val name: String, val endpoint: String)

class ShardRouter(private val shards: List<Shard>) {
    fun route(customerId: Long): Shard {
        val index = Math.floorMod(customerId.hashCode(), shards.size)
        return shards[index]
    }
}

fun main() {
    val router = ShardRouter(
        listOf(
            Shard("shard-a", "postgres-a:5432"),
            Shard("shard-b", "postgres-b:5432"),
            Shard("shard-c", "postgres-c:5432")
        )
    )

    for (id in listOf(101L, 102L, 103L, 204L, 305L, 999L)) {
        val shard = router.route(id)
        println("customer=$id -> ${shard.name} (${shard.endpoint})")
    }
}
```

```csharp
public sealed record Shard(string Name, string Endpoint);

public sealed class ShardRouter
{
    private readonly IReadOnlyList<Shard> _shards;

    public ShardRouter(IReadOnlyList<Shard> shards) => _shards = shards;

    public Shard Route(long customerId)
    {
        var index = (int)(Math.Abs(customerId.GetHashCode()) % _shards.Count);
        return _shards[index];
    }
}
```

```java
import java.util.List;

record Shard(String name, String endpoint) {}

final class ShardRouter {
    private final List<Shard> shards;

    ShardRouter(List<Shard> shards) {
        this.shards = shards;
    }

    Shard route(long customerId) {
        int index = Math.floorMod(Long.hashCode(customerId), shards.size());
        return shards.get(index);
    }
}
```

```go
package main

type Shard struct {
    Name     string
    Endpoint string
}

type ShardRouter struct {
    Shards []Shard
}

func (r ShardRouter) Route(customerID int64) Shard {
    index := int(customerID % int64(len(r.Shards)))
    if index < 0 {
        index = -index
    }
    return r.Shards[index]
}
```

:::

В реальном проекте вместо простого modulo используют consistent hashing (минимизирует перераспределение при добавлении
узлов) или lookup-таблицу размещения. Но идея та же: приложение или router должны одинаково решать, где лежит агрегат.

### 9. Высокая доступность (HA) и отказоустойчивость

Два ключевых параметра:

- **RPO** (Recovery Point Objective) - сколько данных допустимо потерять при падении. RPO = 0 означает, что ни одна
  подтвержденная транзакция не может быть потеряна.
- **RTO** (Recovery Time Objective) - сколько времени система может быть недоступна.

| Система | RPO | RTO | Как достигается |
|---|---|---|---|
| PostgreSQL (sync replica) | 0 | Секунды (failover) | Синхронная репликация |
| PostgreSQL (async replica) | Секунды | Секунды | Асинхронная репликация, возможна потеря |
| Redis (single master) | Секунды | Секунды | AOF каждую секунду, потеря при crash |
| Cassandra | 0 (quorum write) | 0 (masterless) | Кворумная запись на N узлов |
| Google Spanner | 0 | 0 | TrueTime, синхронная глобальная репликация |

Синхронная репликация дает RPO = 0, но увеличивает задержку каждой записи (ждем подтверждения от реплики). Асинхронная
репликация быстрее, но при падении master теряются неотправленные транзакции.

### 10. Сложность администрирования (Ops Complexity)

| Уровень | Пример | Что нужно знать | Когда оправдано |
|---|---|---|---|
| Managed (2 клика) | AWS RDS, Cloud SQL | Консоль облака, SQL | Стартап, малая команда |
| Semi-managed | Aiven Kafka, Atlas MongoDB | Базовое администрирование + специфика | Средняя команда |
| Self-hosted | PostgreSQL на bare metal | Linux, networking, backup, monitoring | Большая команда, compliance |
| Complex distributed | HBase, Cassandra cluster | Hadoop/HDFS, ZooKeeper, capacity planning | Только при реальных big data объемах |

::: warning Ops complexity должна соответствовать компетенциям команды
Если команда из 3 backend-разработчиков решает развернуть самостоятельный кластер Cassandra, стоимость поддержки
быстро превысит бюджет. Managed-сервис дороже в прямых затратах, но дешевле в человеко-часах и инцидентах.
:::

### 11. Лицензирование и вендор-лок (Licensing & Lock-in)

| Тип | Примеры | Плюсы | Риски |
|---|---|---|---|
| Open Source (Apache 2.0, MIT) | PostgreSQL, ClickHouse | Свобода, нет лицензий, сообщество | Самоподдержка |
| AGPL / SSPL | MongoDB, Elasticsearch | Открытый код, ограничения на SaaS | Нельзя предоставлять как managed service |
| Enterprise | Oracle, MS SQL Server | SLA, поддержка, юридическая защита | Дорогие лицензии |
| Cloud-native | DynamoDB, BigQuery, Cosmos DB | Zero ops, автоскейлинг | Vendor lock: миграция = переписывание |

::: details Практический пример vendor lock
DynamoDB предоставляет отличный developer experience и автоскейлинг. Но его модель данных (partition key + sort key +
GSI) и SDK специфичны для AWS. Если через 3 года компания решит уйти из AWS, придется не просто сменить connection
string, а переписать схему данных, запросы и иногда бизнес-логику.
:::

### 12. Экосистема и интеграции

- **Коннекторы данных**: интеграция с Kafka (CDC), Spark, Airflow, Flink;
- **Мониторинг**: Grafana dashboards, Prometheus exporters, встроенные метрики;
- **GUI и инструменты**: DataGrip, DBeaver, pgAdmin, Studio 3T;
- **ORM и драйверы**: зрелость драйверов для вашего стека (JDBC, Entity Framework, GORM).

| СУБД | Kafka-коннектор | Grafana dashboard | Зрелость драйверов (JVM / .NET / Go) |
|---|---|---|---|
| PostgreSQL | Debezium CDC | Да (плагин) | Отличная |
| ClickHouse | Kafka engine (встроен) | Да (плагин) | Хорошая (JDBC, clickhouse-go) |
| MongoDB | Kafka Connector (Confluent) | Community plugin | Отличная |
| Cassandra | Kafka Connector | Community plugin | Хорошая |
| Redis | Redis Streams / Pub-Sub | Да (плагин) | Отличная |
| Elasticsearch | Kafka Connector (Confluent) | Нативная интеграция | Хорошая |

При прочих равных выбирайте то, что проще подключить к существующей инфраструктуре. Apache Druid требует настройки
отдельных ETL-пайплайнов для загрузки данных, тогда как ClickHouse читает из Kafka "из коробки".

## Инфраструктурный контекст: где живет база данных

База данных не существует в вакууме. Она работает на конкретной инфраструктуре, и выбор этой инфраструктуры - часть
решения о хранении данных.

```mermaid
flowchart LR
    Bare["Bare metal\nМакс. контроль\nМакс. сложность"] --> Container["Docker / K8s\nПортируемость\nСредняя сложность"]
    Container --> Managed["Managed service\nМинимальный Ops\nВендор-лок"]
    Managed --> Serverless["Serverless DB\nZero Ops\nМакс. вендор-лок"]
```

**Docker для локальной разработки** - стандартная практика. PostgreSQL в контейнере стартует за секунды и дает всей
команде одинаковое окружение:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: shop
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Managed database** (AWS RDS, Cloud SQL, Yandex Managed PostgreSQL) берет на себя бэкапы, failover, обновления и
мониторинг. Команда платит деньгами, но экономит человеко-часы на администрирование.

**Kubernetes и StatefulSet** позволяют запустить БД в кластере с persistent volume. Подходит для сред, где managed
service недоступен или слишком дорог. Но stateful-workload в K8s требует понимания PersistentVolumeClaim, storage class
и backup-стратегий.

::: only go
Go компилируется в статический бинарник без runtime. Docker-образы для Go-сервисов получаются минимальными (`FROM
scratch`, ~10 MB). Но БД в контейнере все равно использует свой image (postgres:16 ~400 MB). Маленький бинарник сервиса
не влияет на размер БД.
:::

## Обзор классов СУБД

### Реляционные (RDBMS)

Реляционные базы данных - самый зрелый и универсальный класс. Строгая схема, SQL, ACID-транзакции, мощные оптимизаторы
запросов и десятилетия проверенных практик делают их default-выбором для большинства CRUD-приложений.

#### PostgreSQL

Самая функционально богатая open-source RDBMS.

| Сильная сторона | Что дает |
|---|---|
| Расширяемость (GiST, GIN, BRIN) | Индексы для геоданных, полнотекстового поиска, массивов |
| JSONB | Документная модель внутри реляционной БД |
| Оконные функции | Аналитика без отдельной OLAP-системы на малых объемах |
| MVCC | Читатели не блокируют писателей |
| Расширения | PostGIS (гео), TimescaleDB (time-series), pgvector (embeddings) |

**Trade-off**: автовакуум (VACUUM) создает нагрузку при массовых обновлениях. Для 1 млн INSERT/сек PostgreSQL не
оптимален - WAL pressure и bloat management становятся проблемой.

**Когда выбирать**: банковские ядра, ERP, e-commerce заказы, любой CRUD с транзакциями и сложными запросами.

#### MySQL (InnoDB)

Проще в репликации, быстрее на простых primary key lookups.

| Сильная сторона | Что дает |
|---|---|
| Простота репликации | Master-slave, Group Replication "из коробки" |
| Скорость чтения | Оптимизирован для simple reads по PK |
| Экосистема | Огромное количество инструментов и хостингов |

**Trade-off**: JSON-поддержка и аналитические функции слабее, чем в PostgreSQL. Блокировки на уровне строк при
большом конкурентном обновлении могут стать узким местом.

**Когда выбирать**: read-heavy приложения, CMS, блоги, витрины данных.

::: only kotlin
В Kotlin/JVM для PostgreSQL часто используют Exposed (type-safe SQL DSL) или jOOQ, для MySQL - тоже jOOQ или
Spring Data JPA. Выбор ORM/DSL влияет на то, насколько удобно работать с расширениями (JSONB, arrays).
:::

::: only csharp
В .NET для PostgreSQL используется Npgsql + Entity Framework Core (или Dapper для raw SQL). Для MySQL - Pomelo
или MySqlConnector. EF Core абстрагирует различия, но при тюнинге приходится работать с провайдер-специфичными API.
:::

::: only java
В Java для PostgreSQL и MySQL основные варианты: JDBC напрямую, Spring Data JPA (Hibernate), jOOQ или MyBatis.
Spring Data абстрагирует провайдер, но postgres-специфичные фичи (JSONB, arrays) требуют нативных запросов.
:::

::: only go
В Go стандартный `database/sql` работает с обоими через драйверы (`pgx` для PostgreSQL, `go-sql-driver/mysql`).
Для более высокоуровневой работы используют sqlc (генерация кода из SQL) или GORM (ORM).
:::

### In-Memory / Key-Value

Хранилища, которые держат данные в оперативной памяти. Дают микросекундные и миллисекундные задержки, но ограничены
объемом RAM.

#### Redis

In-memory система структур данных. Не просто кэш - полноценное хранилище с богатой моделью.

| Структура данных | Применение |
|---|---|
| Strings | Кэш, счетчики, токены |
| Hashes | Профили пользователей, сессии |
| Sets | Теги, уникальные посетители |
| Sorted Sets | Лидерборды, приоритетные очереди |
| Streams | Event log, pub/sub с историей |

**Персистентность**: RDB (периодические снимки) или AOF (журнал операций). При crash без AOF теряются данные с
последнего снимка.

**Trade-off**: ограничен объемом RAM. При рестарте без персистентности данные теряются. Cluster mode усложняет
операции с несколькими ключами (multi-key operations работают только в пределах одного hash slot).

**Когда выбирать**: сессии, кэш, распределенные блокировки (Redlock), rate limiting, real-time лидерборды.

::: multi-code "Cache-aside для продукта" {default=kotlin}

```kotlin
data class Product(val id: String, val name: String, val price: Int)

class ProductService(
    private val cache: MutableMap<String, Product>,
    private val repository: ProductRepository
) {
    fun getProduct(id: String): Product =
        cache[id] ?: repository.findById(id).also { cache[id] = it }

    fun invalidate(id: String) {
        cache.remove(id)
    }
}
```

```kotlin playground
data class Product(val id: String, val name: String, val price: Int)

class ProductRepository {
    private var callCount = 0

    fun findById(id: String): Product {
        callCount++
        println("  DB query #$callCount for product=$id")
        return Product(id, "Mechanical Keyboard", 8900)
    }
}

class ProductService(
    private val cache: MutableMap<String, Product>,
    private val repository: ProductRepository
) {
    fun getProduct(id: String): Product {
        val cached = cache[id]
        if (cached != null) {
            println("  cache HIT for product=$id")
            return cached
        }
        println("  cache MISS for product=$id")
        val product = repository.findById(id)
        cache[id] = product
        return product
    }

    fun invalidate(id: String) {
        cache.remove(id)
        println("  cache INVALIDATED for product=$id")
    }
}

fun main() {
    val service = ProductService(mutableMapOf(), ProductRepository())

    println("First call:")
    println("  result: ${service.getProduct("kb-1")}")

    println("\nSecond call (cached):")
    println("  result: ${service.getProduct("kb-1")}")

    println("\nAfter invalidation:")
    service.invalidate("kb-1")
    println("  result: ${service.getProduct("kb-1")}")
}
```

```csharp
public sealed record Product(string Id, string Name, int Price);

public sealed class ProductService
{
    private readonly IDictionary<string, Product> _cache;
    private readonly ProductRepository _repository;

    public ProductService(IDictionary<string, Product> cache, ProductRepository repository)
    {
        _cache = cache;
        _repository = repository;
    }

    public Product GetProduct(string id)
    {
        if (_cache.TryGetValue(id, out var cached))
            return cached;

        var product = _repository.FindById(id);
        _cache[id] = product;
        return product;
    }

    public void Invalidate(string id) => _cache.Remove(id);
}
```

```java
import java.util.Map;

record Product(String id, String name, int price) {}

final class ProductService {
    private final Map<String, Product> cache;
    private final ProductRepository repository;

    ProductService(Map<String, Product> cache, ProductRepository repository) {
        this.cache = cache;
        this.repository = repository;
    }

    Product getProduct(String id) {
        var cached = cache.get(id);
        if (cached != null) return cached;

        var product = repository.findById(id);
        cache.put(id, product);
        return product;
    }

    void invalidate(String id) {
        cache.remove(id);
    }
}
```

```go
package main

type Product struct {
    ID    string
    Name  string
    Price int
}

type ProductRepository interface {
    FindByID(id string) Product
}

type ProductService struct {
    Cache      map[string]Product
    Repository ProductRepository
}

func (s ProductService) GetProduct(id string) Product {
    if p, ok := s.Cache[id]; ok {
        return p
    }
    p := s.Repository.FindByID(id)
    s.Cache[id] = p
    return p
}

func (s ProductService) Invalidate(id string) {
    delete(s.Cache, id)
}
```

:::

::: warning Инвалидирование кэша - самая сложная часть
Положить значение в кэш просто. Понять, когда оно устарело - сложно. Если пользователь обновил цену товара, а кэш
вернул старую цену другому пользователю, это бизнес-баг. Типичные стратегии: TTL (время жизни), write-through
(обновлять кэш при записи в БД), event-driven invalidation (слушать события об изменении).
:::

#### DynamoDB (AWS)

Полностью управляемый key-value / document store от AWS.

**Сильные стороны**: автоматическое партицирование, гарантированные single-digit миллисекундные задержки, нулевое
администрирование, автоскейлинг.

**Trade-off**: дорого при большой нагрузке. Модель данных жестко привязана к partition key + sort key. Нет JOIN.
Максимум 2 типа вторичных индексов (GSI/LSI). Лимит 400 KB на item, 10 GB на партицию.

**Когда выбирать**: быстрое прототипирование на AWS, системы где key-value доступ покрывает 95% запросов.

### Документные (Document-oriented)

Хранят данные как вложенные документы (JSON/BSON). Подходят, когда агрегат читается и пишется целиком, а схема
может различаться между документами.

#### MongoDB

Самая популярная документная БД. Гибкая схема, мощный агрегационный конвейер, встроенный шардинг.

| Сильная сторона | Что дает |
|---|---|
| Гибкая схема | Разные товары могут иметь разные поля |
| Вложенные документы (до 16 MB) | Агрегат хранится целиком, без JOIN |
| Aggregation Pipeline | Трансформации и аналитика внутри БД |
| Шардирование | Hash-based или range-based из коробки |

**Trade-off**: ACID-транзакции на нескольких документах есть с версии 4.0, но значительно медленнее, чем в RDBMS.
`$lookup` (аналог JOIN) работает только в рамках одного шарда и тормозит на больших коллекциях.

**Когда выбирать**: e-commerce каталог с гетерогенными товарами, CMS с гибким контентом, прототипы с часто
меняющейся схемой.

#### Couchbase

Архитектура "memory-first" с встроенным кэш-слоем и SQL-подобным языком N1QL.

**Сильные стороны**: данные сначала попадают в RAM (быстрый доступ), потом на диск. Поддержка мобильной
синхронизации через Couchbase Lite. N1QL для привычных SQL-запросов по документам.

**Trade-off**: меньшее сообщество, чем у MongoDB. Настройка кластера (Buckets, vBuckets, Rebalance) сложнее.

**Когда выбирать**: мобильные приложения с offline-режимом, профили пользователей с географией.

::: multi-code "Репозиторий: реляционный vs документный" {default=kotlin}

```kotlin
interface ProductRepository {
    fun findById(id: String): Map<String, Any>?
    fun save(id: String, data: Map<String, Any>)
}

class RelationalProductRepository : ProductRepository {
    override fun findById(id: String): Map<String, Any>? =
        null // SELECT p.*, ps.key, ps.value FROM products p JOIN product_specs ps ...

    override fun save(id: String, data: Map<String, Any>) {
        // INSERT INTO products ... ; INSERT INTO product_specs ...
    }
}

class DocumentProductRepository : ProductRepository {
    override fun findById(id: String): Map<String, Any>? =
        null // db.products.findOne({ _id: id })

    override fun save(id: String, data: Map<String, Any>) {
        // db.products.replaceOne({ _id: id }, data, { upsert: true })
    }
}
```

```kotlin playground
interface ProductRepository {
    fun findById(id: String): Map<String, Any>?
    fun save(id: String, data: Map<String, Any>)
}

class RelationalProductRepository : ProductRepository {
    private val products = mutableMapOf<String, Map<String, Any>>()

    override fun findById(id: String): Map<String, Any>? {
        println("  SQL: SELECT p.*, ps.* FROM products p JOIN specs ps ON p.id = ps.product_id WHERE p.id = '$id'")
        return products[id]
    }

    override fun save(id: String, data: Map<String, Any>) {
        println("  SQL: INSERT INTO products ... + INSERT INTO product_specs ...")
        products[id] = data
    }
}

class DocumentProductRepository : ProductRepository {
    private val collection = mutableMapOf<String, Map<String, Any>>()

    override fun findById(id: String): Map<String, Any>? {
        println("  Mongo: db.products.findOne({ _id: '$id' })")
        return collection[id]
    }

    override fun save(id: String, data: Map<String, Any>) {
        println("  Mongo: db.products.replaceOne({ _id: '$id' }, data)")
        collection[id] = data
    }
}

fun main() {
    val electronics = mapOf(
        "name" to "Laptop",
        "voltage" to "220V",
        "specs" to mapOf("ram" to "16GB", "ssd" to "512GB")
    )

    println("=== Relational (normalized, JOIN needed) ===")
    val relational: ProductRepository = RelationalProductRepository()
    relational.save("laptop-1", electronics)
    relational.findById("laptop-1")

    println("\n=== Document (nested, no JOIN) ===")
    val document: ProductRepository = DocumentProductRepository()
    document.save("laptop-1", electronics)
    document.findById("laptop-1")
}
```

```csharp
public interface IProductRepository
{
    IDictionary<string, object>? FindById(string id);
    void Save(string id, IDictionary<string, object> data);
}

public sealed class RelationalProductRepository : IProductRepository
{
    public IDictionary<string, object>? FindById(string id) => null;
    // SELECT p.*, ps.key, ps.value FROM products p JOIN product_specs ps ...
    public void Save(string id, IDictionary<string, object> data) { }
    // INSERT INTO products ... ; INSERT INTO product_specs ...
}

public sealed class DocumentProductRepository : IProductRepository
{
    public IDictionary<string, object>? FindById(string id) => null;
    // db.products.findOne({ _id: id })
    public void Save(string id, IDictionary<string, object> data) { }
    // db.products.replaceOne({ _id: id }, data, { upsert: true })
}
```

```java
import java.util.Map;

interface ProductRepository {
    Map<String, Object> findById(String id);
    void save(String id, Map<String, Object> data);
}

final class RelationalProductRepository implements ProductRepository {
    public Map<String, Object> findById(String id) { return null; }
    // SELECT p.*, ps.* FROM products p JOIN product_specs ps ...
    public void save(String id, Map<String, Object> data) { }
    // INSERT INTO products ... ; INSERT INTO product_specs ...
}

final class DocumentProductRepository implements ProductRepository {
    public Map<String, Object> findById(String id) { return null; }
    // db.products.findOne({ _id: id })
    public void save(String id, Map<String, Object> data) { }
    // db.products.replaceOne({ _id: id }, data)
}
```

```go
package main

type ProductRepository interface {
    FindByID(id string) (map[string]any, error)
    Save(id string, data map[string]any) error
}

// RelationalProductRepository: SELECT p.*, ps.* FROM products p JOIN product_specs ps ...
type RelationalProductRepository struct{}

func (r RelationalProductRepository) FindByID(id string) (map[string]any, error) { return nil, nil }
func (r RelationalProductRepository) Save(id string, data map[string]any) error  { return nil }

// DocumentProductRepository: db.products.findOne({ _id: id })
type DocumentProductRepository struct{}

func (d DocumentProductRepository) FindByID(id string) (map[string]any, error) { return nil, nil }
func (d DocumentProductRepository) Save(id string, data map[string]any) error  { return nil }
```

:::

Реляционная модель нормализует данные: товар в одной таблице, характеристики в другой, категории в третьей. Чтение
требует JOIN. Документная модель хранит агрегат целиком: товар со всеми характеристиками в одном документе. Чтение -
один запрос, но обновление связанных данных (переименование категории) требует обновления множества документов.

### Ширококолоночные (Wide-column)

Проектируются под конкретные паттерны запросов. Данные организуются не как строки, а как семейства колонок с
partition key. Масштабируются горизонтально "из коробки".

#### Cassandra

Мастер-мастер архитектура, нет единой точки отказа, линейная масштабируемость.

| Сильная сторона | Что дает |
|---|---|
| Masterless (ring topology) | Нет SPOF, любой узел принимает запись |
| LSM-Tree | Очень быстрая запись (sequential I/O) |
| Линейное масштабирование | Добавление узла удваивает пропускную способность |
| Tunable consistency | Для каждого запроса можно выбрать ONE, QUORUM, ALL |

**Trade-off**: нет транзакций, нет JOIN, CQL сильно ограничен (нет GROUP BY, нет подзапросов). Модель данных
проектируется "от запросов" - сначала определяете, какие запросы нужны, потом проектируете таблицы.

**Когда выбирать**: IoT-телеметрия (миллионы записей/сек), трекинг (GPS-координаты), логирование, любая нагрузка
с предсказуемым паттерном записи и чтения по partition key.

#### ScyllaDB

Переписанная на C++ версия Cassandra с использованием ядерного планировщика Seastar.

**Сильные стороны**: совместимость с Cassandra API (CQL), но 10x лучший P99 за счет userspace scheduling,
отсутствия GC pauses и CPU pinning.

**Trade-off**: дороже (Enterprise лицензия), требует тонкой настройки NUMA и CPU affinity.

#### HBase

Работает поверх HDFS (Hadoop Distributed File System). Хранит миллиарды строк на дешевых дисках.

**Trade-off**: высокая задержка при random reads (HDFS не оптимизирован для point lookups). Требует ZooKeeper.
Подходит для batch-обработки, а не для real-time. В real-time сценариях Cassandra значительно быстрее.

### Колоночные / OLAP

Хранят данные по колонкам, а не по строкам. Это дает феноменальное сжатие (однотипные данные сжимаются лучше) и
быстрые агрегации (читаем только нужные колонки).

#### ClickHouse

Open-source колоночная СУБД для аналитики. Создана в Яндексе.

| Сильная сторона | Что дает |
|---|---|
| Сжатие до 10:1 | Терабайты данных на дешевых дисках |
| Векторные вычисления (SIMD) | COUNT/SUM/AVG на миллиардах строк за секунды |
| MergeTree engine | Автоматическое слияние данных, партицирование по дате |
| SQL-совместимость | Привычный синтаксис для аналитиков |
| Kafka engine | Потоковая загрузка из Kafka |

**Trade-off**: UPDATE и DELETE очень тяжелые (через мержи). Администрирование непростое: ZooKeeper/Keeper для
репликации, ручное управление партициями, сложные бэкапы. Не подходит для точечных выборок - оптимизирован для
сканирования колонок.

**Когда выбирать**: хранилище событий, трекинг кликов, метрики производительности, аналитические дашборды.

#### BigQuery (Google Cloud)

Полностью бессерверный: нет кластеров, нет серверов, нет настройки. Платите за объем обработанных данных.

**Trade-off**: vendor lock (GCP). При частых ad-hoc запросах стоимость может превысить бюджет. Задержка первого
запроса выше, чем у ClickHouse (cold start).

**Когда выбирать**: аналитика без DevOps-ресурсов, нерегулярные тяжелые запросы, Data Science исследования.

#### Druid / Apache Pinot

Ориентированы на потоковые данные с sub-second латентностью запросов. Загружают данные из Kafka почти в реальном
времени.

**Когда выбирать**: real-time дашборды для мониторинга рекламных кампаний, gaming analytics.

**Trade-off**: требуют много RAM, сложны в настройке сегментов и TTL.

### Графовые (Graph)

Оптимизированы для запросов по отношениям между объектами. Вместо JOIN по foreign key - прямой обход ребер графа.

#### Neo4j

Нативная графовая БД с ACID-транзакциями.

| Сильная сторона | Что дает |
|---|---|
| Index-free adjacency | Обход соседей за O(1), не зависит от размера графа |
| Язык Cypher | Декларативный и читаемый язык запросов к графам |
| ACID-транзакции | Безопасная запись в граф |

**Trade-off**: горизонтальное масштабирование (Enterprise кластер) дорогое. Аналитика на графах с > 1 млрд
вершин становится медленной. Не подходит для обычного CRUD.

**Когда выбирать**: системы рекомендаций ("друзья друзей, купившие X"), антифрод (поиск связанных аккаунтов через
общие телефоны/карты), социальные сети, knowledge graphs.

#### JanusGraph

Распределенный граф поверх Cassandra или HBase. Масштабируется горизонтально.

**Trade-off**: нет ACID, нет нативного языка запросов (использует Apache Gremlin). Запросы медленнее, чем в Neo4j.
Но масштабируется там, где Neo4j упирается в лимиты одного узла.

### Временные ряды (Time-series)

Оптимизированы для данных с временной осью: метрики, телеметрия, IoT-показания, финансовые котировки.

#### InfluxDB

Push-модель: приложение отправляет метрики в InfluxDB.

**Сильные стороны**: TTL (автоматическое удаление старых данных), continuous queries (автоагрегация), удобный
query language (InfluxQL / Flux).

**Когда выбирать**: бизнес-метрики, статистика продаж по часам, IoT-данные с политикой хранения.

#### Prometheus / VictoriaMetrics

Pull-модель: Prometheus сам собирает метрики с endpoints приложений.

**Сильные стороны**: нативная интеграция с Kubernetes (service discovery), PromQL для запросов, алерты.
VictoriaMetrics - форк с лучшим сжатием и long-term storage.

**Когда выбирать**: мониторинг инфраструктуры (CPU, RAM, 5xx errors), Kubernetes-среды.

#### TimescaleDB

Расширение PostgreSQL для временных рядов. Полный SQL, JOIN между time-series и справочными таблицами.

**Сильные стороны**: привычный PostgreSQL + hypertables для автоматического партицирования по времени. Можно
писать: "Покажи среднюю температуру датчика по городам за неделю" одним SQL с JOIN на таблицу городов.

**Trade-off**: потребляет больше диска, чем InfluxDB. Зато не нужно учить новый язык запросов.

### Поисковые и векторные (Search & Vector)

#### Elasticsearch / OpenSearch

Распределенный поисковый движок на основе Apache Lucene. Инвертированный индекс позволяет находить документы по
словам за O(1) - в отличие от `LIKE '%query%'`, который сканирует все строки. OpenSearch - open-source форк
Elasticsearch после смены лицензии на SSPL.

| Возможность | Что дает |
|---|---|
| Инвертированный индекс | Полнотекстовый поиск за миллисекунды |
| Анализаторы (stemming, synonyms) | Поиск "кроссовки" находит "кроссовка", "кросс" |
| Фасетная фильтрация | Каталог товаров с фильтрами (цвет, размер, бренд) |
| Fuzzy search | Толерантность к опечаткам ("клавиатра" → "клавиатура") |

**Когда выбирать**: поиск по каталогу товаров, логи (ELK stack), автодополнение, fuzzy search.

**Trade-off**: не является primary database - нужна синхронизация с основным хранилищем (обычно через CDC).
Нет ACID-транзакций. Eventual consistency между шардами. Потребляет много RAM для индексов.

#### Vector databases (pgvector, Milvus, Qdrant)

Хранят эмбеддинги (числовые представления текста, изображений, аудио) и выполняют similarity search.

**Когда выбирать**: RAG (retrieval-augmented generation), рекомендации по похожести, semantic search.

**Trade-off**: молодая категория. pgvector удобен тем, что работает внутри PostgreSQL (не нужна отдельная система),
но менее производителен на больших объемах, чем специализированные решения.

### Embedded databases

Встраиваются в процесс приложения как библиотека. Нет отдельного сервера, данные в файле.

#### SQLite

Самая распространенная embedded БД в мире. Полный SQL, ACID, нулевое администрирование.

**Когда выбирать**:
- мобильные приложения (единственная доступная БД на устройстве);
- desktop-приложения (настройки, документы, локальные каталоги);
- тесты (поднять БД за миллисекунды без Docker);
- IoT и edge (автономная работа без сети);
- прототипы и CLI-утилиты.

**Не подходит**: как единственная БД для многопользовательского backend с высокой конкуренцией записей.

### Distributed SQL (NewSQL)

Пытаются совместить SQL с горизонтальным распределением. Представители: CockroachDB, YugabyteDB, Google Spanner, TiDB.

```mermaid
flowchart LR
    App["Application"] --> SQL["SQL endpoint"]
    SQL --> Node1[("Node 1")]
    SQL --> Node2[("Node 2")]
    SQL --> Node3[("Node 3")]
    Node1 <--> Node2
    Node2 <--> Node3
    Node3 <--> Node1
```

**Обещание**: SQL + ACID + горизонтальное масштабирование + автоматический failover.

**Реальность**: распределенные транзакции имеют цену (сетевые round-trips, консенсус). Latency выше, чем у
single-node PostgreSQL. Rebalancing при добавлении узлов нагружает кластер. Наблюдаемость и дебаг сложнее.

**Когда рассматривать**: географически распределенные приложения (пользователи на нескольких континентах),
объемы данных, которые не помещаются на один узел, требование zero-downtime при добавлении мощности. Не стоит
брать в маленький проект без реальных симптомов масштабирования.

## Синтез: прикладные примеры и Trade-offs

### Интернет-магазин (E-commerce)

```mermaid
flowchart TD
    Client["Клиент"] --> API["API Gateway"]
    API --> Orders["Order Service"]
    API --> Catalog["Catalog Service"]
    API --> Cart["Cart Service"]
    Orders --> PG[("PostgreSQL\nзаказы, ACID")]
    Catalog --> ES[("Elasticsearch\nполнотекстовый поиск")]
    Cart --> Redis[("Redis\nкорзина, сессии")]
    PG -->|"CDC"| ES
    PG -->|"ETL"| CH[("ClickHouse\nаналитика")]
```

| Компонент | БД | Почему | Жертва |
|---|---|---|---|
| Заказы | PostgreSQL | ACID, транзакции, SERIALIZABLE | Сложность горизонтального масштабирования |
| Каталог (поиск) | Elasticsearch | Быстрый full-text, фасеты, ранжирование | Нет транзакций, eventual consistency |
| Сессии и корзина | Redis | Микросекундный доступ, TTL | Ограничен RAM, риск потери при crash |
| Аналитика | ClickHouse | Сжатие, агрегации за секунды | Сложный Ops, плохие UPDATE |

**Главный trade-off**: синхронизация между PostgreSQL и Elasticsearch. Если CDC задерживается, пользователь
ищет товар, которого уже нет, или не находит только что добавленный. Приходится мириться с eventual consistency
в поиске.

### Биллинг (Billing)

Строгий аудит, деньги, транзакции. Здесь компромиссов с согласованностью быть не может.

**Решение**: PostgreSQL с уровнем изоляции SERIALIZABLE.

**Главный trade-off**: жертвуем горизонтальным масштабированием. При росте до 100 млн пользователей придется
подключать шардирование (Citus) или переходить на distributed SQL - оба варианта добавляют сложность.

### IoT-платформа

Лавина данных: миллионы записей в секунду с датчиков. Потеря нескольких точек некритична.

```mermaid
flowchart LR
    Sensors["Датчики\n1M events/sec"] --> Kafka["Apache Kafka\nбуфер"]
    Kafka --> CH[("ClickHouse\nхранение + агрегация")]
    CH --> Grafana["Grafana\nдашборды"]
```

**Решение**: Kafka как буфер (принимает данные с любой скоростью) + ClickHouse для хранения и агрегации.

**Главный trade-off**: администрирование ClickHouse требует специалистов. Мержи, бэкапы, ZooKeeper/Keeper -
если команда не готова, лучше Managed ClickHouse или TimescaleDB (проще, но медленнее на больших объемах).

### Антифрод (Fraud Detection)

Запросы глубиной 3-5 связей: чей номер телефона, какие аккаунты, какие карты, какие еще операции.
Скорость критична: < 100 мс на решение.

```mermaid
flowchart LR
    Tx["Транзакция"] --> Check["Fraud check"]
    Check --> Neo[("Neo4j")]
    Neo --> Phone["Номер телефона\n→ другие аккаунты"]
    Phone --> Card["Карта\n→ другие операции"]
    Card --> Decision{"Fraud?"}
```

**Решение**: Neo4j для хранения связей в памяти. Cypher-запрос обходит граф за миллисекунды.

**Главный trade-off**: Neo4j не умеет автоматически перешардироваться. При 10 млрд транзакций придется
"разрезать" граф по временным окнам (старые данные в архив) или переходить на JanusGraph (медленнее, но
масштабируется).

### Аналитика кликов (Clickstream Analytics)

100 тыс. событий/сек. Глубокие срезы по датам, UTM-меткам, устройствам, регионам.

**Решение**: ClickHouse (self-hosted, если есть экспертиза) или BigQuery (если бюджет позволяет, а команда маленькая).

**Главный trade-off**: в ClickHouse нужно проектировать ORDER BY (сортировочный ключ) так, чтобы он покрывал
частые запросы. Неправильный ключ = полное сканирование вместо pruning. В BigQuery этой проблемы нет, но каждый
запрос стоит денег (плата за обработанные байты).

### Сводная таблица Trade-offs

| Бизнес-кейс | Основная БД | Где выигрываем | Чем платим |
|---|---|---|---|
| E-commerce заказы | PostgreSQL | Консистентность, ACID | Сложность шардирования |
| E-commerce каталог | Elasticsearch | Скорость full-text поиска | Eventual consistency |
| Биллинг | PostgreSQL | Финансовая безопасность | Ограниченный масштаб записи |
| IoT-логи | ClickHouse | Скорость агрегаций, сжатие | Ops complexity, плохие UPDATE |
| Антифрод (граф) | Neo4j | Скорость обхода связей | Дорогой горизонтальный скейлинг |
| Аналитика кликов | ClickHouse / BigQuery | Сжатие (CH) или Zero Ops (BQ) | Тюнинг (CH) или цена запросов (BQ) |
| Сессии и кэш | Redis | Микросекундные задержки | Ограничен RAM, риск потери |
| IoT на устройстве | SQLite | Нет сети, нет сервера | Не масштабируется на backend |
| Мониторинг | Prometheus + VictoriaMetrics | Pull-модель, K8s native | Не для бизнес-данных |

## Как начинать выбор

```mermaid
flowchart TD
    Start["Новый проект"] --> Simple{"Можно начать с PostgreSQL?"}
    Simple -->|"да"| PG["PostgreSQL + мониторинг"]
    Simple -->|"нет, особые требования"| Analyze["Определить топ-3 критичных измерения"]
    PG --> Monitor["Мониторить метрики"]
    Monitor --> Bottleneck{"Появилось узкое место?"}
    Bottleneck -->|"нет"| Stay["Оставить как есть"]
    Bottleneck -->|"да"| Migrate["Вынести нагрузку в специализированную БД"]
    Analyze --> Match["Найти класс БД по этим измерениям"]
    Match --> POC["PoC с реальной нагрузкой"]
    POC --> Decision["Решение на основе данных"]
```

| Сценарий | Начальный выбор | Почему | Когда пересматривать |
|---|---|---|---|
| CRUD backend | PostgreSQL | Транзакции, SQL, зрелость, расширения | Чтение или запись стали узким местом |
| Быстрый кэш | Redis | TTL, микросекундный доступ | Проблемы консистентности или инвалидирования |
| Гибкие документы | MongoDB | Гибкая схема, агрегат целиком | Нужны JOIN и строгие транзакции |
| Мобильное приложение | SQLite | Встроенный файл, offline | Нужна синхронизация между устройствами |
| Аналитика | ClickHouse или BigQuery | Колоночное хранение, агрегации | Нужны UPDATE или point lookups |
| Граф связей | Neo4j | Обход на 3+ шагов за миллисекунды | Данные > 1 млрд вершин |
| Global high-load | Distributed SQL | Авто-распределение, failover | Только при реальных симптомах |

Главный инженерный принцип: начните просто. PostgreSQL - хороший default для большинства задач. Добавляйте
специализированные хранилища только когда появляются измеримые симптомы: latency, throughput, disk space или
ops burden превышают допустимое. До этого момента простая модель дешевле, надежнее и понятнее.

## Резюме

- Полиглотное хранение (Polyglot Persistence) - стандарт индустрии: разным задачам - разные БД.
- Теорема CAP ограничивает распределенные системы: нельзя одновременно гарантировать C, A и P.
- ACID дает строгие транзакционные гарантии за счет координации. BASE дает доступность за счет eventual consistency.
- 12 измерений фреймворка позволяют системно оценить требования к хранилищу.
- OLTP (транзакции) и OLAP (аналитика) решают разные задачи и требуют разных архитектур.
- B-Tree оптимален для чтения, LSM-Tree - для записи.
- Хвостовая задержка (P99) критичнее средней при проектировании SLA.
- Репликация решает отказоустойчивость и разгрузку чтения. Шардирование решает масштаб данных и записи.
- PostgreSQL - хороший default для большинства CRUD-задач.
- Redis - не просто кэш, а in-memory система структур данных для сессий, лидербордов и блокировок.
- Документные БД подходят, когда агрегат читается целиком и схема гетерогенна.
- Колоночные БД (ClickHouse, BigQuery) оптимальны для аналитических агрегаций.
- Графовые БД уместны при запросах на обход связей глубиной 3+ шагов.
- Time-series БД оптимизированы для данных с временной осью.
- Managed services снижают ops burden за счет vendor lock и прямых затрат.
- Выбор СУБД - это осознанный компромисс, а не поиск "лучшей" технологии.

## Дополнительное чтение

### Фундаментальные концепции

- [Designing Data-Intensive Applications (Kleppmann)](https://dataintensive.net/) - библия проектирования систем хранения данных.
- [CAP theorem explained](https://habr.com/ru/articles/328792/) - разбор теоремы CAP с примерами.
- [Обзор типов СУБД](https://habr.com/ru/companies/amvera/articles/754702/) - карта основных типов баз данных.

### Масштабирование и репликация

- [Шардирование](https://yandex.cloud/ru/docs/glossary/sharding) - обзорное объяснение подхода.
- [Распределенный SQL: альтернатива шардированию](https://habr.com/ru/companies/ruvds/articles/714322/) - разбор NewSQL.

### Отдельные классы СУБД

- [ClickHouse: введение](https://clickhouse.com/docs/ru) - официальная документация на русском.
- [Redis data structures](https://redis.io/docs/data-types/) - структуры данных Redis с примерами.
- [Neo4j Graph Academy](https://graphacademy.neo4j.com/) - бесплатные курсы по графовым БД.

### Практические паттерны

- [CQRS Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs) - Microsoft documentation.
- [Cache-aside pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside) - описание паттерна.
- [Unit of Work и ORM](https://youtu.be/oP_OUiIK4Rc) - про связь Unit of Work с ORM.

## Вопросы для самопроверки

1. Почему в 2010-х годах polyglot persistence стало стандартом вместо одной универсальной БД?
2. Что утверждает теорема CAP и почему на практике выбор сводится к CP или AP?
3. Чем ACID отличается от BASE? Когда уместен каждый подход?
4. Почему хвостовая задержка (P99) важнее средней при проектировании SLA?
5. Чем B-Tree отличается от LSM-Tree? Когда каждый оптимален?
6. Почему OLTP и OLAP нельзя эффективно совместить в одной БД?
7. Что такое CQRS и как он связан с разделением OLTP/OLAP?
8. Когда NoSQL (документная/key-value БД) уместнее реляционной? Когда наоборот?
9. Чем репликация отличается от шардирования? Какие проблемы решает каждый подход?
10. Почему cache invalidation сложнее, чем запись значения в кэш?
11. Что такое RPO и RTO? Как они влияют на выбор стратегии репликации?
12. Чем PostgreSQL лучше MySQL для сложных аналитических запросов? А MySQL лучше PostgreSQL?
13. Почему Redis ограничен объемом RAM и как это влияет на архитектуру?
14. Когда графовая БД дает реальное преимущество перед реляционной?
15. Чем ClickHouse плох для UPDATE/DELETE и почему это не всегда проблема?
16. Почему embedded БД (SQLite) не подходит для многопользовательского backend?
17. Когда Distributed SQL (CockroachDB, Spanner) оправдан, а когда это overengineering?
18. Как vendor lock проявляется при использовании DynamoDB или BigQuery?
19. Почему ops complexity должна соответствовать компетенциям команды?
20. Как начать выбор БД для нового проекта и когда стоит пересмотреть решение?

## Мини-практика

1. **Проектирование хранения для сервиса доставки еды.**
   У сервиса есть: заказы (платежи, статусы), каталог ресторанов с меню (поиск, фильтрация), позиция курьеров
   (GPS-координаты каждые 5 сек), сессии пользователей, аналитика (среднее время доставки по районам за месяц).
   Для каждого компонента выберите класс БД, объясните почему и укажите главный trade-off.

2. **Анализ узкого места.**
   Ваш PostgreSQL обслуживает и транзакции заказов, и поисковые запросы по каталогу. Средняя задержка запроса
   выросла с 10 мс до 200 мс. Аналитические запросы менеджеров блокируют connection pool. Предложите стратегию
   разделения нагрузки: что вынести, куда, как синхронизировать.

3. **Оценка по 12 измерениям.**
   Возьмите систему из вашего опыта (рабочую, учебную или вымышленную). Заполните таблицу 12 измерений для основного
   хранилища. Определите 3 самых критичных измерения. Проверьте, оптимальна ли текущая БД по этим трем осям. Если нет,
   предложите альтернативу с обоснованием.
