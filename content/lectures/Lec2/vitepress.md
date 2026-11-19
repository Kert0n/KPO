---
requires:
  - lecture: 1
    reason: "DIP и направление зависимостей между модулями"
---

# Лекция 2. Внедрение зависимостей

Нужно проверить, что заказ на 100 рублей передаётся в оплату с правильной суммой. Но при создании
`OrderService` открывается соединение с базой, а при вызове метода запрос уходит платёжному провайдеру.
Как проверить расчёт на ноутбуке без доступа к этим системам?

База и платёжный шлюз — зависимости сервиса. Чтобы выбрать их учебные или рабочие реализации при запуске,
передадим готовые объекты в сервис. Такой приём называется внедрением зависимостей (Dependency Injection, DI).

::: tip Главная идея лекции
DIP говорит, от чего должен зависеть код. DI показывает, как передать эту зависимость в объект. DI-контейнер
автоматизирует сборку графа объектов, но не отменяет ответственность за дизайн.
:::

::: tip Как работать с Kotlin-примерами
В Kotlin-вкладках статический код оставлен коротким. Если включен Playground, некоторые примеры запускаются как
отдельные маленькие программы: можно менять реализацию зависимости, порядок вызовов и lifecycle, чтобы увидеть проблему в выводе.
:::

## Сквозной сценарий

Учебный пример `Car` и `Engine` намеренно маленький: он убирает шум фреймворков и показывает саму связь. Но держите в
голове реальное приложение. В нем `OrderService` должен сохранить заказ, списать оплату, отправить событие
и получить текущее время. Если сервис сам создает `PostgresOrderRepository`, `StripePaymentGateway`, `SystemClock` и
`KafkaPublisher`, он становится трудно тестируемым и плохо переносимым между production, staging и локальным запуском.

```mermaid
flowchart LR
    Root["Composition Root<br/>main / startup / DI module"]
    Repository["OrderRepository implementation"]
    Gateway["PaymentGateway implementation"]
    Clock["Clock implementation"]
    Publisher["EventPublisher implementation"]
    Service["OrderService"]

    Repository --> Service
    Gateway --> Service
    Clock --> Service
    Publisher --> Service
    Root --> Repository
    Root --> Gateway
    Root --> Clock
    Root --> Publisher
    Root --> Service
```

Стрелки из `Composition Root` показывают, кто создаёт экземпляры. Стрелки от репозитория, шлюза, часов и издателя событий к сервису
показывают, какие объекты получает его конструктор.

## Разбор на примере машины и сервиса заказов {#worked-example-микромодель-и-production-аналог}

### Ситуация

`Car` нужен `Engine`, а `OrderService` нужны repository, payment gateway, clock и event publisher. Масштаб разный, но
вопрос один: кто выбирает конкретную реализацию зависимости?

### Наивное решение

`Car` создает `GasEngine`, а `OrderService` создает `PostgresOrderRepository` и `StripePaymentGateway` прямо в
конструкторе. Код быстро запускается, но класс теперь знает и бизнес-правило, и инфраструктуру.

### Что ломается

Хотим дважды запустить один и тот же тест. Шлюз оплаты запрашивает сеть, а база сохраняет заказ после первого запуска.
Чтобы проверить правило с локальным хранилищем и тестовым шлюзом, приходится менять сам сервис.

### Улучшение

Передадим хранилище и шлюз через конструктор. Выберем реализации там, где запускается приложение.
Это место сборки называют *Composition Root*. В маленькой программе его роль обычно выполняет `main`.

### Почему это работает

DI не делает код "более объектно-ориентированным" автоматически. Он делает границу выбора явной: бизнес-класс описывает,
что ему нужно, а верхний уровень приложения решает, чем это будет реализовано в production, тесте или локальном запуске.

## Цели

После этой статьи вы должны уметь:

- отличать DIP, DI и DI-контейнер;
- видеть скрытую зависимость от конкретного класса;
- объяснять, почему интерфейс сам по себе не гарантирует слабую связанность;
- выбирать constructor injection как вариант по умолчанию;
- понимать риски setter, property и interface injection;
- объяснять, почему Service Locator часто превращается в антипаттерн;
- понимать роль Composition Root;
- различать transient, singleton и scoped lifecycle;
- видеть, почему DI упрощает unit-тестирование.

## Проблема

Представим класс `Car`. Ему нужен двигатель. Если `Car` сам создает `GasEngine`, то он знает слишком много: не только о
том, что двигатель должен уметь запускаться, но и о конкретной реализации. Такая связь мешает заменить двигатель на
электрический, тестовый или любой другой.

```mermaid
flowchart LR
    Car["Car"] --> Engine["Engine interface"]
    Car -. "создает" .-> GasEngine["GasEngine"]
    GasEngine -. "implements" .-> Engine
```

На диаграмме может казаться, что `Car` зависит от интерфейса. Но если внутри класса написано создание конкретной
реализации, фактическая зависимость остается на `GasEngine`. Интерфейс здесь есть, но точка выбора реализации спрятана
не там, где ее удобно контролировать.

Главный вопрос лекции: где должен создаваться объект-зависимость и как передать его в класс, который этой зависимостью
пользуется?

## DIP и DI

DIP, DI и DI-контейнер часто звучат рядом, но отвечают на разные вопросы.

| Понятие      | Отвечает на вопрос               | Пример                                      |
|--------------|----------------------------------|---------------------------------------------|
| DIP          | От чего должен зависеть код?     | `Car` зависит от `Engine`, а не `GasEngine` |
| DI           | Как объект получает зависимость? | `Engine` передается в конструктор           |
| DI-контейнер | Кто собирает граф объектов?      | Контейнер создает `Car`, `Engine`, сервисы  |

```mermaid
flowchart TD
    DIP["DIP"] --> Rule["Зависеть от абстракций"]
    DI["DI"] --> Method["Передать зависимость извне"]
    Container["DI-контейнер"] --> Assembly["Собрать объектный граф"]
```

DIP (Dependency Inversion Principle, принцип инверсии зависимостей) описывает направление зависимостей в исходном коде.
Сервису заказа нужен контракт «принять оплату». Адаптер конкретного провайдера реализует этот контракт.
Сервис и адаптер зависят от одного соглашения, которое выражает потребности сервиса.

DI описывает передачу объекта. В конструктор `Car(engine: GasEngine)` двигатель уже внедряется извне,
но тип параметра по-прежнему связывает машину с бензиновым двигателем. Сигнатура `Car(engine: Engine)`
сохраняет тот же способ передачи и позволяет выбрать другую реализацию.

DI-контейнер собирает объекты по правилам, заданным приложением. Ручной вызов `Car(GasEngine())` в точке
сборки даёт тот же результат.

## Первый пример

Цель здесь — менять тип двигателя при сборке машины. Для этого `Car` достаточно знать операцию запуска из контракта `Engine`.

:::: multi-code "Car зависит от Engine"

```kotlin
interface Engine {
    fun start(): String
}

class Car(private val engine: Engine) {
    fun drive(): String = "Car: ${engine.start()}"
}
```

```kotlin playground
interface Engine {
    fun start(): String
}

class GasEngine : Engine {
    override fun start() = "gas engine started"
}

class ElectricEngine : Engine {
    override fun start() = "electric engine started"
}

class Car(private val engine: Engine) {
    fun drive(): String = "Car: ${engine.start()}"
}

fun main() {
    val gasCar = Car(GasEngine())
    val electricCar = Car(ElectricEngine())

    println(gasCar.drive())
    println(electricCar.drive())
}
```

```csharp
public interface IEngine
{
    string Start();
}

public sealed class Car
{
    private readonly IEngine engine;

    public Car(IEngine engine)
    {
        this.engine = engine;
    }

    public string Drive() => $"Car: {engine.Start()}";
}
```

```java
interface Engine {
    String start();
}

final class Car {
    private final Engine engine;

    Car(Engine engine) {
        this.engine = engine;
    }

    String drive() {
        return "Car: " + engine.start();
    }
}
```

```go
type Engine interface {
    Start() string
}

type Car struct {
    engine Engine
}

func NewCar(engine Engine) Car {
    return Car{engine: engine}
}

func (c Car) Drive() string {
    return "Car: " + c.engine.Start()
}
```

::::

В Kotlin Playground можно поменять `GasEngine()` на `ElectricEngine()` или добавить третий двигатель. Класс `Car` при
этом не меняется. Это и есть практическая польза зависимости от абстракции.

## Скрытая связь

Теперь рассмотрим вариант, который выглядит почти правильно, но нарушает идею. Поле имеет тип `Engine`, однако объект
создается внутри класса.

:::: multi-code "Скрытая зависимость"

```kotlin
class Car {
    private val engine: Engine = GasEngine()

    fun drive(): String = "Car: ${engine.start()}"
}
```

```kotlin playground
interface Engine {
    fun start(): String
}

class GasEngine : Engine {
    override fun start() = "gas engine started"
}

class ElectricEngine : Engine {
    override fun start() = "electric engine started"
}

class Car {
    private val engine: Engine = GasEngine()

    fun drive(): String = "Car: ${engine.start()}"
}

fun main() {
    val car = Car()
    println(car.drive())
    println("Try to switch to ElectricEngine without editing Car: impossible.")
}
```

```csharp
public sealed class Car
{
    private readonly IEngine engine = new GasEngine();

    public string Drive() => $"Car: {engine.Start()}";
}
```

```java
final class Car {
    private final Engine engine = new GasEngine();

    String drive() {
        return "Car: " + engine.start();
    }
}
```

```go
type Car struct {
    engine Engine
}

func NewCar() Car {
    return Car{engine: GasEngine{}}
}
```

::::

Проблема не в самом операторе создания объекта. Проблема в месте, где он используется. Если `Car` сам выбирает
`GasEngine`, то выбор реализации зашит в высокоуровневый класс. Чтобы поменять двигатель, придется менять `Car`.

## Способы DI

Зависимость нужно как-то передать в объект. Все способы решают одну задачу, но отличаются по моменту, когда зависимость
становится доступной, и по тому, насколько явно она видна в API класса. Выбор способа определяет, можно ли создать
объект в невалидном состоянии и насколько просто будет подставить тестовую реализацию.

| Способ                | Когда использовать                          | Риск                                               |
|-----------------------|---------------------------------------------|----------------------------------------------------|
| Constructor injection | Обязательные зависимости                    | Длинный список параметров требует проверки обязанностей |
| Method injection      | Зависимость нужна только для одной операции | Повторяется параметр, если сервис нужен везде             |
| Setter injection      | Опциональная или поздняя зависимость        | Объект может быть использован до настройки         |
| Property injection    | Иногда во фреймворках                       | Скрытая обязательность, null-состояния             |
| Interface injection   | Legacy/редкий случай                        | Зависимость плохо видна из API                     |

Практическое правило простое: если зависимость обязательна для нормальной работы объекта, начинайте с конструктора.

## Конструктор

Constructor injection - вариант по умолчанию. Сигнатура конструктора перечисляет обязательные зависимости. В языках, допускающих
`null` или `nil`, при необходимости добавьте проверку значения на границе создания объекта.

```mermaid
flowchart LR
    Root["Composition Root"] --> GasEngine["GasEngine"]
    Root --> Car["Car(engine)"]
    GasEngine --> Engine["Engine interface"]
    Car --> Engine
```

У этого способа есть полезный побочный эффект: если конструктор требует слишком много зависимостей, это заметно. Часто
такой класс нарушает SRP и делает слишком много.

:::: multi-code "Constructor injection"

```kotlin
class Car(private val engine: Engine) {
    fun start(): String = engine.start()
}

val car = Car(GasEngine())
```

```kotlin playground
interface Engine {
    fun start(): String
}

class GasEngine : Engine {
    override fun start() = "real engine started"
}

class StubEngine(private val result: String) : Engine {
    override fun start() = result
}

class Car(private val engine: Engine) {
    fun start(): String = "Car: ${engine.start()}"
}

fun main() {
    val productionCar = Car(GasEngine())
    val testCar = Car(StubEngine("ready for test"))

    println(productionCar.start())
    println(testCar.start())
}
```

```csharp
public sealed class Car
{
    private readonly IEngine engine;

    public Car(IEngine engine)
    {
        this.engine = engine;
    }

    public string Start() => engine.Start();
}

// Сборка выполняется в точке входа приложения.
public static class Program
{
    public static void Main()
    {
        var car = new Car(new GasEngine());
        System.Console.WriteLine(car.Start());
    }
}
```

```java
final class Car {
    private final Engine engine;

    Car(Engine engine) {
        this.engine = engine;
    }

    String start() {
        return engine.start();
    }
}

class App {
    public static void main(String[] args) {
        var car = new Car(new GasEngine());
        System.out.println(car.start());
    }
}
```

```go
type Car struct {
    engine Engine
}

func NewCar(engine Engine) Car {
    return Car{engine: engine}
}

func assembleCar() Car {
    return NewCar(GasEngine{})
}
```

::::

В Playground первая машина выводит `Car: real engine started`. Вторая получает заглушку `StubEngine` с заранее заданным ответом `ready for test`. Для обеих подходит один метод `Car.start`.

## Метод

Method injection подходит, когда зависимость нужна только для одной операции. В этом случае нет смысла хранить ее в
поле: достаточно передать объект параметром метода.

:::: multi-code "Method injection"

```kotlin
class TripPlanner {
    fun plan(route: String, weather: WeatherProvider): String {
        return "$route: ${weather.forecast()}"
    }
}
```

```kotlin playground
interface WeatherProvider {
    fun forecast(): String
}

class SunnyWeather : WeatherProvider {
    override fun forecast() = "sunny, normal route"
}

class StormWeather : WeatherProvider {
    override fun forecast() = "storm, choose safe route"
}

class TripPlanner {
    fun plan(route: String, weather: WeatherProvider): String {
        return "$route -> ${weather.forecast()}"
    }
}

fun main() {
    val planner = TripPlanner()

    println(planner.plan("Campus to library", SunnyWeather()))
    println(planner.plan("Campus to library", StormWeather()))
}
```

```csharp
public sealed class TripPlanner
{
    public string Plan(string route, IWeatherProvider weather)
    {
        return $"{route}: {weather.Forecast()}";
    }
}
```

```java
final class TripPlanner {
    String plan(String route, WeatherProvider weather) {
        return route + ": " + weather.forecast();
    }
}
```

```go
type TripPlanner struct{}

func (TripPlanner) Plan(route string, weather WeatherProvider) string {
    return route + ": " + weather.Forecast()
}
```

::::

Метод хорош, если зависимость не является частью устойчивого состояния объекта. Если каждый метод класса требует один и
тот же сервис, лучше вернуться к конструктору.

## Setter

Setter injection позволяет создать объект, а зависимость назначить позже. Это полезно для действительно опциональных
зависимостей или runtime-перенастройки. Но для обязательных зависимостей это опасно: объект существует в неполном
состоянии.

```mermaid
sequenceDiagram
    participant App
    participant Car
    App->>Car: new Car()
    App->>Car: start()
    Car-->>App: error: engine is not configured
    App->>Car: setEngine(engine)
    App->>Car: start()
```

:::: multi-code "Setter injection"

```kotlin
class Car {
    private var engine: Engine? = null

    fun setEngine(engine: Engine) {
        this.engine = engine
    }
}
```

```kotlin playground
interface Engine {
    fun start(): String
}

class GasEngine : Engine {
    override fun start() = "gas engine started"
}

class Car {
    private var engine: Engine? = null

    fun setEngine(engine: Engine) {
        this.engine = engine
    }

    fun start(): String {
        val configured = engine ?: return "error: engine is not configured"
        return "Car: ${configured.start()}"
    }
}

fun main() {
    val car = Car()

    println(car.start())

    car.setEngine(GasEngine())
    println(car.start())
}
```

```csharp
public sealed class Car
{
    private IEngine? engine;

    public void SetEngine(IEngine engine)
    {
        this.engine = engine;
    }
}
```

```java
final class Car {
    private Engine engine;

    void setEngine(Engine engine) {
        this.engine = engine;
    }
}
```

```go
type Car struct {
    engine Engine
}

func (c *Car) SetEngine(engine Engine) {
    c.engine = engine
}
```

::::

Если зависимость обязательна, setter заставляет писать защитный код и помнить порядок вызовов. Поэтому setter injection
лучше оставлять для зависимостей, отсутствие которых действительно допустимо.

## Свойство (property injection)

Property injection — разновидность мутабельной инъекции, как и setter. Зависимость назначается через свойство после
создания объекта. Риск тот же: объект может быть создан и использован до настройки. Оба варианта (setter и property)
стоит применять только когда зависимость действительно необязательная или этого требует фреймворк.

::: only csharp
В C# property injection иногда встречается во фреймворках, но обязательные зависимости лучше оставлять в конструкторе:
`public OrderService(IRepository repository)`.
:::

::: only kotlin
В Kotlin похожий стиль через `lateinit var` компилируется, но переносит ошибку в runtime: если свойство не назначили,
объект упадет при первом обращении.
:::

::: only java
В Java обязательные зависимости обычно выражают через конструктор и `final`-поля. Аннотационная injection-магия удобна
во фреймворках, но если по конструктору не видно обязательных зависимостей, класс сложнее понять и протестировать.
:::

## Interface Injection

Interface injection - более редкий вариант. Объект реализует специальный интерфейс, через который контейнер или внешний
код передает зависимость.

Идея выглядит так: если класс реализует `EngineAware`, то ему можно вызвать `setEngine(engine)`. Проблема в том, что
зависимость хуже видна из основного API. По конструктору может казаться, что класс ни от чего не зависит, хотя после
создания контейнер должен дополнительно пройтись по специальным интерфейсам.

Этот подход исторически встречался в некоторых контейнерах и фреймворках, но для учебного и прикладного дизайна его
нужно воспринимать как исключение. Если зависимость обязательна, конструктор обычно честнее.

::: only go
В Go интерфейс реализуется неявно: типу достаточно иметь методы с нужными сигнатурами. Поэтому сама идея "реализовать
специальный интерфейс ради внедрения" там выглядит иначе и встречается реже, чем простая передача зависимости в
конструктор-функцию.
:::

## Composition Root

Composition Root - место, где приложение собирает объектный граф. В консольной программе это обычно `main`. В web
приложении - startup/bootstrap/configuration. Важно, что бизнес-классы не должны знать, кто именно их собрал.

```mermaid
flowchart TD
    Main["main / startup"] --> Register["Регистрация реализаций"]
    Register --> Resolve["Сборка графа"]
    Resolve --> App["Запуск приложения"]
    App --> Domain["Доменный код без знания о контейнере"]
```

Composition Root отвечает за выбор конкретных реализаций. Вот как выглядит ручная сборка для `OrderService` из
сквозного сценария:

```kotlin
fun main() {
    val repository: OrderRepository = PostgresOrderRepository(connectionString)
    val gateway: PaymentGateway = StripePaymentGateway(apiKey)
    val clock: Clock = SystemClock()
    val publisher: EventPublisher = KafkaPublisher(brokerUrl)

    val service = OrderService(repository, gateway, clock, publisher)
    // запуск HTTP-сервера, передающего service в handlers
}
```

В тесте тот же `OrderService` собирается с другими реализациями:

```kotlin
val service = OrderService(
    InMemoryOrderRepository(),
    FakePaymentGateway(),
    FixedClock(Instant.parse("2025-01-15T10:00:00Z")),
    SpyEventPublisher()
)
```

Главная граница: контейнер или ручная сборка остаются наверху. Доменный код получает уже готовые зависимости.

::: only kotlin
В Kotlin без фреймворка composition root часто выглядит как обычная функция `main`, которая создает реализации и
передает их в конструкторы. В серверных фреймворках эту роль выполняет код запуска, который подключает описания зависимостей. Например, в Koin объявим часы общим объектом, а их потребителя будем создавать заново при каждом запросе:

```kotlin
class ReceiptClock(val clock: Clock)

val appModule = module {
    single<Clock> { SystemClock() }
    factory { ReceiptClock(get()) }
}

fun main() {
    val app = startKoin { modules(appModule) }
    val first = app.koin.get<ReceiptClock>()
    val second = app.koin.get<ReceiptClock>()
    check(first !== second && first.clock === second.clock)
}
```

`single` = singleton, `factory` = transient, `get()` = автоматический resolve по типу. Доменный объект при этом не
должен импортировать контейнер — он по-прежнему получает зависимости через конструктор.

Для ленивой инициализации Kotlin предлагает делегат `by lazy`:

```kotlin
val heavyService: HeavyService by lazy { HeavyService(config) }
```

Значение вычисляется при первом обращении к свойству и сохраняется этим делегатом. Два владельца с отдельными делегатами могут создать два экземпляра. Такая локальная ленивость сама по себе не задаёт общую область контейнера.
:::

::: only csharp
В ASP.NET Core зависимости обычно регистрируют в `Program.cs`. Фрагмент показывает регистрации сервиса заказа и четырёх его зависимостей. Параметры подключения адаптеров задаются отдельно.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<IOrderRepository, PostgresOrderRepository>();
builder.Services.AddScoped<IPaymentGateway, StripePaymentGateway>();
builder.Services.AddScoped<IEventPublisher, KafkaPublisher>();
builder.Services.AddTransient<OrderService>();

var app = builder.Build();
```

Контроллеры и сервисы получают зависимости через конструкторы — контейнер рекурсивно собирает граф. Важно не передавать
`IServiceProvider` в доменную модель как скрытый Service Locator.
:::

::: only java
В Spring роль composition root частично берет на себя application context: `@Configuration`, `@Bean`, component scanning.
Но это не отменяет дизайна. Если бизнес-класс дергает `ApplicationContext.getBean(...)`, он снова становится зависимым
от контейнера, а не только от своего контракта.
:::

::: only go
В Go чаще встречается manual wiring: функция `main` создает реализации и передает их в конструкторы вроде
`NewOrderService(repo, gateway, clock, publisher)`. Это многословнее контейнера, зато зависимости видны как обычный код и проще
отлаживаются.

Для необязательных настроек и зависимостей в Go применяют **functional options**. Здесь сервер получает готовый журнал по умолчанию, а вызывающий код может передать свой.

```go
type Server struct {
    logger Logger
    timeout time.Duration
}

type Option func(*Server)

func WithLogger(l Logger) Option {
    return func(s *Server) { s.logger = l }
}

func WithTimeout(d time.Duration) Option {
    return func(s *Server) { s.timeout = d }
}

func NewServer(opts ...Option) *Server {
    s := &Server{logger: defaultLogger, timeout: 30 * time.Second}
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

Каждая опция меняет создаваемый сервер до его возврата вызывающему коду. `WithLogger` передаёт зависимость,
а `WithTimeout` задаёт числовую настройку. Вызов `NewServer()` сохраняет оба значения по умолчанию.
:::

## Service Locator

Service Locator - объект или глобальный механизм, который хранит или создает сервисы. Клиентский код обращается к нему
сам и просит нужную зависимость.

```mermaid
flowchart TD
    OrderService["OrderService"] --> Locator["Service Locator"]
    Payment["PaymentService"] --> Locator
    Notification["NotificationService"] --> Locator
    Locator --> Repository["Repository"]
    Locator --> Email["EmailSender"]
    Locator --> Logger["Logger"]
```

Формально локатор может спрятать конкретную реализацию. `OrderService` не создает `SqlRepository` напрямую, а просит
локатор дать `Repository`. Но появляется другая проблема: `OrderService` теперь зависит от локатора. Если локатор
доступен отовсюду, он становится глобальной точкой, через которую любой класс может достать любой сервис.

## Риск локатора

Главный риск Service Locator - скрытые зависимости. Конструктор класса выглядит простым, но внутри метода может
оказаться вызов `ServiceLocator.resolve(...)`. По API класса уже не видно, что ему нужны репозиторий, валидатор, логгер
или платежный шлюз.

:::: multi-code "Service Locator скрывает зависимости"

```kotlin
class OrderProcessor {
    fun process(orderId: String): String {
        val validator = ServiceLocator.validator
        return validator.validate(orderId)
    }
}
```

```kotlin playground
interface Validator {
    fun validate(orderId: String): String
}

class StrictValidator : Validator {
    override fun validate(orderId: String): String =
        if (orderId.startsWith("ORD-")) "valid: $orderId" else "invalid: $orderId"
}

class AlwaysValidValidator : Validator {
    override fun validate(orderId: String) = "valid in test: $orderId"
}

object ServiceLocator {
    var validator: Validator = StrictValidator()
}

class OrderProcessor {
    fun process(orderId: String): String {
        return ServiceLocator.validator.validate(orderId)
    }
}

fun main() {
    val processor = OrderProcessor()

    println(processor.process("BAD-1"))

    ServiceLocator.validator = AlwaysValidValidator()
    println(processor.process("BAD-1"))

    ServiceLocator.validator = StrictValidator()
    println("Global state restored manually.")
}
```

```csharp
public sealed class OrderProcessor
{
    public string Process(string orderId)
    {
        var validator = ServiceLocator.Resolve<IValidator>();
        return validator.Validate(orderId);
    }
}
```

```java
final class OrderProcessor {
    String process(String orderId) {
        var validator = ServiceLocator.resolve(Validator.class);
        return validator.validate(orderId);
    }
}
```

```go
type OrderProcessor struct{}

func (OrderProcessor) Process(orderID string) string {
    validator := ServiceLocatorValidator()
    return validator.Validate(orderID)
}
```

::::

Playground показывает неприятный эффект: тестовая подмена меняет глобальное состояние. Если забыть вернуть его обратно,
следующий сценарий будет выполняться уже с другой зависимостью. В большом проекте такие ошибки трудно искать.

## Где можно

Service Locator не обязан быть катастрофой, если он ограничен верхним уровнем приложения. Если локатор используется
только в Composition Root для создания объектов, дальше зависимости можно передавать через конструкторы. Тогда по сигнатуре бизнес-класса видно, какие сервисы ему нужны.

```mermaid
flowchart LR
    Locator["Locator / Container"] --> Validator["Validator"]
    Locator --> Repository["Repository"]
    Root["Composition Root"] --> Locator
    Root --> Processor["OrderProcessor(validator, repository)"]
    Processor --> Validator
    Processor --> Repository
```

Разница не в том, есть ли внутри контейнера словарь сервисов. Разница в том, кто к нему обращается. Если к нему
обращается только Composition Root, зависимости остаются явными. Если к нему обращается любой бизнес-класс, зависимости
размазываются по системе.

## DI-контейнер

В `main()` с пятью зависимостями ручная сборка работает отлично. Но представьте production-приложение: 50 сервисов, у
каждого 3-7 зависимостей, часть из них общие. Граф объектов становится лесом, а `main()` превращается в сотню строк
`val x = X(a, b, c)`. DI-контейнер решает эту проблему: он берёт на себя рекурсивную сборку графа по зарегистрированным
правилам.

DI-контейнер автоматизирует сборку объектного графа. Обычно он умеет:

- регистрировать соответствие интерфейса и реализации;
- создавать объекты с учетом их конструкторов;
- рекурсивно собирать зависимости зависимостей;
- управлять временем жизни объектов;
- отдавать готовый корневой объект приложению.

| Подход          | Кто просит зависимость                         | Где видна зависимость         |
|-----------------|------------------------------------------------|-------------------------------|
| DI              | Внешний код передает объекту                   | В конструкторе/методе         |
| Service Locator | Сам объект просит локатор                      | Скрыта внутри метода          |
| DI-контейнер    | Composition Root просит контейнер собрать граф | В регистрации и конструкторах |

У контейнера обычно есть операция получения готового объекта. Приложение может вызвать её в точке сборки. Если передать сам контейнер в бизнес-класс и вызвать там `resolve`, то для этого класса контейнер станет локатором, а список необходимых ему сервисов окажется скрыт.

Для короткого примера оставим сервису одну обязанность — регистрировать заказы в памяти. После регистрации `ORD-1` и `ORD-2` отчёт должен перечислить оба номера.

:::: multi-code "Ручная сборка графа"

```kotlin
val repository: OrderRepository = InMemoryOrderRepository()
val service = OrderService(repository)
```

```kotlin playground
interface OrderRepository {
    fun save(id: String)
    fun all(): List<String>
}

class InMemoryOrderRepository : OrderRepository {
    private val orders = mutableListOf<String>()

    override fun save(id: String) {
        orders += id
    }

    override fun all(): List<String> = orders.toList()
}

class OrderService(private val repository: OrderRepository) {
    fun register(id: String) {
        repository.save(id)
    }

    fun report(): String = repository.all().joinToString(prefix = "orders: ")
}

fun main() {
    val repository: OrderRepository = InMemoryOrderRepository()
    val service = OrderService(repository)

    service.register("ORD-1")
    service.register("ORD-2")

    println(service.report())
}
```

```csharp
IOrderRepository repository = new InMemoryOrderRepository();
var service = new OrderService(repository);
```

```java
OrderRepository repository = new InMemoryOrderRepository();
var service = new OrderService(repository);
```

```go
var repository OrderRepository = NewInMemoryOrderRepository()
service := NewOrderService(repository)
```

::::

В этом фрагменте `main` сам передаёт репозиторий в сервис. При сборке контейнером тот же конструктор получит реализацию по правилам регистрации.

## Lifecycle

При регистрации задают, когда контейнер создаёт новый экземпляр и когда возвращает уже созданный. Если передать объект другому владельцу, тот может удерживать ссылку дольше. Это особенно важно для ресурсов, которые освобождаются при закрытии области.

```mermaid
flowchart TD
    Request["Запрос зависимости"] --> Kind{"Lifecycle"}
    Kind -->|"transient"| New["Создать новый объект"]
    Kind -->|"singleton"| Same["Вернуть общий объект"]
    Kind -->|"scoped"| Scope["Вернуть объект текущей области"]
```

Основные варианты:

| Lifecycle | Что означает                        | Когда подходит                              |
|-----------|-------------------------------------|---------------------------------------------|
| Transient | Новое разрешение зависимости даёт новый экземпляр | Легкие stateless-сервисы                    |
| Singleton | Один экземпляр на регистрацию в контейнере           | Конфигурация, кеши, общие read-only сервисы |
| Scoped    | Один объект на область              | Например, одна область на HTTP-запрос     |

Singleton опасен, если объект хранит изменяемое пользовательское состояние. Transient может быть дорогим, если объект
тяжело создавать. Scoped нужен там, где несколько сервисов в рамках одной операции должны разделять общий контекст.

::: warning Когда singleton удерживает зависимость из короткой области
В ASP.NET Core один экземпляр фонового сервиса может пережить тысячи HTTP-запросов. Если передать ему
scoped `DbContext` через конструктор, проверка областей при её включении отклонит такую сборку.
Без проверки контекст, полученный из корневого контейнера, может остаться общим для разных операций.
Он хранит отслеживаемые изменения и не поддерживает параллельное использование.

Фоновому сервису передают `IServiceScopeFactory`. Для каждой операции он открывает область, получает в ней
`DbContext` и завершает работу с ним до закрытия области. Обратная комбинация допустима — сервис одного
запроса может пользоваться общими часами, зарегистрированными как singleton.
:::

:::: multi-code "Transient и singleton"

```kotlin
// container уже содержит две регистрации Counter.
val a = container.resolve<Counter>("transientCounter")
val b = container.resolve<Counter>("transientCounter")
check(a !== b)

val shared = container.resolve<Counter>("singletonCounter")
check(shared === container.resolve<Counter>("singletonCounter"))
```

```kotlin playground
class Container {
    private val factories = mutableMapOf<String, () -> Any>()

    fun <T : Any> registerTransient(key: String, factory: () -> T) {
        factories[key] = factory
    }

    fun <T : Any> registerSingleton(key: String, factory: () -> T) {
        val instance: T by lazy(factory)
        factories[key] = { instance }
    }

    @Suppress("UNCHECKED_CAST")
    fun <T : Any> resolve(key: String): T {
        return factories.getValue(key)() as T
    }
}

class Counter {
    val id: Int = nextId()

    companion object {
        private var current = 0

        fun nextId(): Int {
            current += 1
            return current
        }
    }
}

fun main() {
    val container = Container()

    container.registerTransient("transientCounter") { Counter() }
    container.registerSingleton("singletonCounter") { Counter() }

    val transientA = container.resolve<Counter>("transientCounter")
    val transientB = container.resolve<Counter>("transientCounter")

    val singletonA = container.resolve<Counter>("singletonCounter")
    val singletonB = container.resolve<Counter>("singletonCounter")

    println("transient ids: ${transientA.id}, ${transientB.id}")
    println("singleton ids: ${singletonA.id}, ${singletonB.id}")
}
```

```csharp
services.AddTransient<ICounter, RandomCounter>();
services.AddSingleton<IClock, SystemClock>();
services.AddScoped<IUnitOfWork, UnitOfWork>();
```

```java
container.registerTransient(Counter.class, Counter::new);
container.registerSingleton(Clock.class, SystemClock::new);
container.registerScoped(UnitOfWork.class, UnitOfWork::new);
```

```go
container.RegisterTransient("counter", NewCounter)
container.RegisterSingleton("clock", NewSystemClock)
container.RegisterScoped("unitOfWork", NewUnitOfWork)
```

::::

В playground transient-объекты получают разные `id`, а singleton возвращает один и тот же объект. Это простая модель
того, что делает реальный контейнер. Вкладки Java и Go показывают условный API, вкладка C# — методы стандартного контейнера .NET.

## DI и тесты

Проверим, какую сумму сервис передал в оплату. Ответ платёжного провайдера и его доступность этой проверке не нужны.
Для этого запуска подставим шлюз, который ведёт сумму списаний по каждому заказу в памяти. Такой упрощённый рабочий аналог называют *fake*. Здесь выделен только шаг оплаты из исходного сценария. Результат двух списаний на 60 и 40 рублей для одного заказа должен быть 100, у другого заказа — 0.

Эта связь подробно раскрывается в [Лекции 3](/lectures/03#тестируемость-кода-и-зависимости). Сейчас важно увидеть
механику: DI не пишут "ради тестов", но хороший DI делает тесты естественным следствием дизайна. Если тесту приходится
поднимать половину приложения, проблема часто не в тестовом фреймворке, а в скрытых зависимостях и неправильно выбранных
границах.

```mermaid
flowchart LR
    Test["Unit test"] --> Service["OrderService"]
    Service --> Port["PaymentGateway interface"]
    Fake["FakePaymentGateway"] --> Port
    Real["HttpPaymentGateway"] --> Port
```

:::: multi-code "Fake для теста"

```kotlin
interface PaymentGateway {
    fun charge(orderId: String, amount: Int)
}

class OrderService(private val payment: PaymentGateway) {
    fun pay(orderId: String, amount: Int) = payment.charge(orderId, amount)
}

class FakePaymentGateway : PaymentGateway {
    private val totals = mutableMapOf<String, Int>()

    fun totalFor(orderId: String): Int = totals[orderId] ?: 0

    override fun charge(orderId: String, amount: Int) {
        totals[orderId] = totalFor(orderId) + amount
    }
}

fun checkPayments() {
    val gateway = FakePaymentGateway()
    val service = OrderService(gateway)

    service.pay("ORD-42", 60)
    service.pay("ORD-42", 40)

    check(gateway.totalFor("ORD-42") == 100)
    check(gateway.totalFor("ORD-43") == 0)
}
```

```kotlin playground
interface PaymentGateway {
    fun charge(orderId: String, amount: Int)
}

class OrderService(private val payment: PaymentGateway) {
    fun pay(orderId: String, amount: Int) = payment.charge(orderId, amount)
}

class FakePaymentGateway : PaymentGateway {
    private val totals = mutableMapOf<String, Int>()

    fun totalFor(orderId: String): Int = totals[orderId] ?: 0

    override fun charge(orderId: String, amount: Int) {
        totals[orderId] = totalFor(orderId) + amount
    }
}

fun main() {
    val gateway = FakePaymentGateway()
    val service = OrderService(gateway)

    service.pay("ORD-42", 60)
    service.pay("ORD-42", 40)

    check(gateway.totalFor("ORD-42") == 100)
    check(gateway.totalFor("ORD-43") == 0)
    println("ORD-42: ${gateway.totalFor("ORD-42")} руб.")
}
```

```csharp
using System.Collections.Generic;
using Xunit;

public interface IPaymentGateway
{
    void Charge(string orderId, int amount);
}

public sealed class OrderService(IPaymentGateway gateway)
{
    public void Pay(string orderId, int amount) => gateway.Charge(orderId, amount);
}

public sealed class FakePaymentGateway : IPaymentGateway
{
    private readonly Dictionary<string, int> totals = new();

    public int TotalFor(string orderId) => totals.GetValueOrDefault(orderId);

    public void Charge(string orderId, int amount) =>
        totals[orderId] = TotalFor(orderId) + amount;
}

public class OrderTests
{
    [Fact]
    public void PaymentsAccumulateForOneOrder()
    {
        var gateway = new FakePaymentGateway();
        var service = new OrderService(gateway);

        service.Pay("ORD-42", 60);
        service.Pay("ORD-42", 40);

        Assert.Equal(100, gateway.TotalFor("ORD-42"));
        Assert.Equal(0, gateway.TotalFor("ORD-43"));
    }
}
```

```java
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

interface PaymentGateway {
    void charge(String orderId, int amount);
}

record OrderService(PaymentGateway gateway) {
    void pay(String orderId, int amount) {
        gateway.charge(orderId, amount);
    }
}

class FakePaymentGateway implements PaymentGateway {
    private final Map<String, Integer> totals = new HashMap<>();

    int totalFor(String orderId) {
        return totals.getOrDefault(orderId, 0);
    }

    public void charge(String orderId, int amount) {
        totals.merge(orderId, amount, Integer::sum);
    }
}

class OrderTest {
    @Test
    void paymentsAccumulateForOneOrder() {
        var gateway = new FakePaymentGateway();
        var service = new OrderService(gateway);

        service.pay("ORD-42", 60);
        service.pay("ORD-42", 40);

        assertEquals(100, gateway.totalFor("ORD-42"));
        assertEquals(0, gateway.totalFor("ORD-43"));
    }
}
```

```go
package order

import "testing"

type PaymentGateway interface {
    Charge(orderID string, amount int)
}

type OrderService struct {
    gateway PaymentGateway
}

func (s OrderService) Pay(orderID string, amount int) {
    s.gateway.Charge(orderID, amount)
}

type FakePaymentGateway map[string]int

func (g FakePaymentGateway) Charge(orderID string, amount int) {
    g[orderID] += amount
}

func TestPaymentsAccumulateForOneOrder(t *testing.T) {
    gateway := make(FakePaymentGateway)
    service := OrderService{gateway: gateway}

    service.Pay("ORD-42", 60)
    service.Pay("ORD-42", 40)

    if gateway["ORD-42"] != 100 || gateway["ORD-43"] != 0 {
        t.Fatalf("unexpected totals: %v", gateway)
    }
}
```

::::

В следующей лекции тестирование будет отдельной темой. Сейчас важно зафиксировать связь: если класс сам создает реальные
зависимости, его трудно тестировать изолированно. Если зависимости внедряются, тест может подставить fake или mock.

## Частые ошибки

- Интерфейс создан, но конкретная реализация все равно создается внутри класса.
- Контейнер передается в доменный сервис и используется как `resolve` внутри бизнес-методов.
- Все зависимости регистрируются как singleton без анализа состояния.
- Setter используется для обязательной зависимости.
- Класс требует слишком много зависимостей, но это маскируется контейнером.
- DI используется как способ спрятать плохую декомпозицию.
- Абстракция вводится без второй реализации, тестовой подмены или реальной точки изменения.
- Service Locator применяется не в Composition Root, а в произвольных местах приложения.

Два примера, которые стоит узнавать в коде:

**Ambient context** — зависимость прячется в статическом свойстве:

```kotlin
class OrderService {
    fun process(orderId: String) {
        val now = TimeProvider.current.now()  // скрытая зависимость
        // ...
    }
}
```

Тест не может подменить `TimeProvider.current` без глобальной мутации. Решение: передать `Clock` через конструктор.

**Constructor over-injection** — у конструктора так много параметров, что стоит проверить обязанности класса. В примере их восемь.

```kotlin
class OrderService(
    private val repo: OrderRepository,
    private val payment: PaymentGateway,
    private val inventory: InventoryService,
    private val pricing: PricingService,
    private val notification: NotificationSender,
    private val audit: AuditLogger,
    private val metrics: MetricsCollector,
    private val featureFlags: FeatureFlagService
)
```

Посмотрите, какие зависимости используются вместе. Если правила цены меняются независимо от рассылки уведомлений,
расчёт можно вынести в отдельный сервис. Само число параметров ещё не обосновывает такое разделение.

## Чеклист

Перед тем как добавить зависимость, задайте себе вопросы:

1. Кто создает зависимость?
2. Видна ли зависимость в API класса?
3. Можно ли заменить реализацию без правки бизнес-класса?
4. Можно ли протестировать класс без реальной инфраструктуры?
5. Не передается ли контейнер внутрь доменной логики?
6. Правильный ли lifecycle выбран?
7. Не слишком ли много зависимостей у класса?

```mermaid
flowchart TD
    Need["Классу нужна зависимость"] --> Required{"Обязательна всегда?"}
    Required -->|"да"| Constructor["Constructor injection"]
    Required -->|"нет"| Operation{"Нужна одной операции?"}
    Operation -->|"да"| Method["Method injection"]
    Operation -->|"нет"| Optional["Setter/property только как optional"]
    Constructor --> Many{"Слишком много зависимостей?"}
    Many -->|"да"| Split["Проверить SRP"]
    Many -->|"нет"| Good["Оставить явно"]
```

## Резюме

- DIP задает направление зависимости: высокоуровневый код зависит от абстракций.
- DI передает зависимость извне, вместо создания внутри класса.
- Constructor injection обычно лучший вариант для обязательных зависимостей.
- Setter и property injection могут оставить объект без обязательной зависимости до первого обращения.
- Service Locator скрывает запрашиваемые сервисы от читателя конструктора. Общий изменяемый локатор дополнительно связывает тесты.
- DI-контейнер полезен в Composition Root, но не должен протекать в доменную логику.
- Lifecycle влияет на поведение программы: transient, singleton и scoped дают разные гарантии.
- DI делает тестирование естественным, потому что реальные реализации можно заменить fake или mock.

## Дополнительное чтение

Материалы закрывают основные варианты передачи зависимостей, Service Locator и жизненный цикл объектов в контейнере.

### DI и Service Locator

- [Martin Fowler, Inversion of Control Containers and the Dependency Injection pattern](https://martinfowler.com/articles/injection.html) — на одном сервисе поиска фильмов сравниваются внедрение и самостоятельный запрос к локатору.

- [Внедрение зависимостей](https://topjava.ru/blog/back-to-basics-dependency-injection) — базовое объяснение dependency injection.
- [Service Locator](https://sergeyteplyakov.blogspot.com/2013/03/di-service-locator.html) — разбор подхода и его последствий для дизайна.
- [Отличие Dependency Injection от Service Locator](https://habr.com/ru/articles/465395/) — сравнение двух способов получения зависимостей.

### Жизненный цикл зависимостей

- [Microsoft Learn, Service lifetimes](https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes) — правила доступа к scoped-сервису и явная область для фоновой операции.

- [Жизненный цикл зависимостей](https://metanit.com/sharp/dotnet/1.3.php) — singleton, scoped и transient на примере .NET.

## Самопроверка

1. Почему `private val engine: Engine = GasEngine()` все еще нарушает DIP?
2. Чем DIP отличается от DI?
3. Почему constructor injection считается вариантом по умолчанию?
4. Когда method injection лучше constructor injection?
5. Чем setter injection опасен для обязательных зависимостей?
6. Почему property injection может скрывать ошибку настройки объекта?
7. Что такое Composition Root?
8. Какие зависимости скрывает даже локатор, переданный через конструктор? Что изменится, если сделать его глобальным?
9. Чем DI-контейнер отличается от прямого Service Locator в бизнес-коде?
10. Получат ли два потребителя одного HTTP-запроса один `DbContext`, если он зарегистрирован как scoped? А два разных запроса?
11. Почему singleton опасен для изменяемого состояния?
12. Как DI помогает писать unit tests?

## Мини-практика

Есть `ReportService`, который внутри создает `FileReportWriter`, `ConsoleLogger` и `SystemClock`.

Нужно:

1. Выделить интерфейсы `ReportWriter`, `Logger`, `Clock`.
2. Переписать `ReportService` на constructor injection.
3. Собрать объект в `main` или другом Composition Root.
4. Добавить fake writer для теста.
5. Объяснить, где в вашем решении DIP, где DI, а где Composition Root.

Стартовый вариант намеренно плохой:

:::: multi-code "Мини-практика: исходный код" {playground=off}

```kotlin
class ReportService {
    private val writer = FileReportWriter()
    private val logger = ConsoleLogger()
    private val clock = SystemClock()
}
```

```csharp
public sealed class ReportService
{
    private readonly FileReportWriter writer = new();
    private readonly ConsoleLogger logger = new();
    private readonly SystemClock clock = new();
}
```

```java
final class ReportService {
    private final FileReportWriter writer = new FileReportWriter();
    private final ConsoleLogger logger = new ConsoleLogger();
    private final SystemClock clock = new SystemClock();
}
```

```go
type ReportService struct {
    writer FileReportWriter
    logger ConsoleLogger
    clock  SystemClock
}
```

::::

Проверьте решение на одном запуске. Пусть `generate("ORD-42")` записывает одну строку вида
`<время> <номер заказа>`. Передайте часы с фиксированным ответом `10:00`, журнал без вывода
и writer, сохраняющий строки в памяти. После вызова список должен содержать ровно одну запись
`10:00 ORD-42`. Затем замените writer в точке сборки на файловый. Код `generate` должен подойти для обоих запусков.

## Переход к следующей лекции

В Playground шлюз в памяти позволил проверить сумму списания по заказу. Другому тесту может понадобиться только
заранее известный ответ или запись отправленных сообщений. [Лекция 3](/lectures/03#тестируемость-кода-и-зависимости)
разбирает, как выбрать двойник под конкретный вопрос и какую проверку сохранить при рефакторинге.
