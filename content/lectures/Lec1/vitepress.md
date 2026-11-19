# Лекция 1. Введение в КПО

## О чем это?

Конструирование программного обеспечения - это работа не столько над созданием программы, сколько над формой будущей системы: ее
объектами, зависимостями, границами ответственности и, как следствие, **способностью меняться**.

Эта лекция вводит базовые понятия курса:
парадигмы, отношения между типами, интерфейсы, наследование, SOLID, GRASP и практические эвристики простого дизайна.

::: tip Главная идея лекции
Конструирование ПО - это управление стоимостью изменений. Хороший дизайн не делает систему сложной заранее, но оставляет
ей понятные точки расширения там, где изменения действительно вероятны.
:::

::: tip Как работать с примерами
Kotlin-вкладки в многоязычных примерах подготовлены как небольшие запускаемые программы для Playground. Их можно менять
прямо на странице: подставлять другие реализации, ломать инварианты, добавлять новый тип и сразу смотреть, что
происходит в выводе.
:::

## Цели

После этой статьи вы должны уметь:

- отличать простое написание кода от конструирования программного обеспечения;
- объяснять, почему парадигмы программирования полезны именно как ограничения;
- различать наследование, ассоциацию, композицию, агрегацию и реализацию интерфейса;
- выбирать между наследованием, композицией и интерфейсом;
- объяснять смысл SOLID и GRASP без механического заучивания аббревиатур;
- видеть границу между полезной абстракцией и overengineering;
- применять KISS, DRY, YAGNI и бритву Оккама и замечать признаки преждевременного детального проектирования (BDUF).

## Зачем КПО

Курс КПО можно воспринимать как "системный дизайн на минималках": мы не уходим глубоко в каждую отдельную область, а
строим карту местности. На будущих дисциплинах вы подробнее разберете базы данных, клиент-серверные приложения,
распределенные системы, тестирование и DevOps. Здесь важнее увидеть общую траекторию: как от доменной модели и отдельных
классов перейти к приложению, которое можно тестировать, развивать, разворачивать и сопровождать.

```mermaid
flowchart LR
    Domain["Доменная модель"] --> Design["Дизайн классов"]
    Design --> Tests["Тестирование"]
    Tests --> Architecture["Архитектура приложения"]
    Architecture --> Services["Клиент-сервер и сервисы"]
    Services --> Data["Данные"]
    Data --> DevOps["DevOps и Observability"]
```

Практический результат курса - не набор терминов, а инженерная привычка задавать вопросы:

- что в этой задаче действительно меняется;
- от чего зависит мой код;
- можно ли заменить деталь без переписывания бизнес-логики;
- где абстракция помогает, а где она только маскирует простую задачу.

## Сквозная история курса

### Мотивация

Чем больше я программирую, тем глубже убеждаюсь в народной мудрости:
> Нет ничего более постоянного, чем временное.

Это кажется абсурдом, поэтому я приведу пример, на котором, надеюсь, станет понятно, что я имею в виду.

#### Ситуация

К вам приходит начальник и ставит задачу: «Нужно сделать простенькую _временную_ программку, которая
разошлет клиентам смску о чем-нибудь, пусть это будет закрытие одного из магазинов».

#### Наивное решение

Казалось бы, ничего сложного. И мы пишем простую программку в один файл, которая делает именно это. Один запрос к БД и отправка сообщений через библиотеку. Дело в шляпе, ждем премию )

#### Акт 2

Но на следующий день к вам приходит все тот же начальник и говорит: «Тут такое дело, у нас не у всех клиентов заполнен
номер телефона, сам понимаешь, не все заполняют. Короче, нужно отправить еще эмейлы. Спасибо».

И вот мы смотрим на наш простенький SQL и программку в один файл, вздыхаем и понимаем, что все нужно будет переписать с
нуля. Запрос теперь стал сильно сложнее, да и в программке нужно разветвление на способ отправки.
Печально, но к концу дня вы снова справились.

#### Акт 3

- У нас там еще один магазин закрывается - сделай возможность нескольких уведомлений через определенный срок.
- Нам сказали, в базе клиенты из разных городов. Нам нужно уведомлять только тех, что в одном городе. Сроки горят.
  Выручишь?
- Владелец сказал, этим клиентам отправлять ничего нельзя. Исправь.
- Слушай, мне тут такая идея пришла. А что если в уведомлении написать новый ближайший к ним магазин на основе их
  домашнего адреса. Поправь, пожалуйста, там делов на 2 минуты.

#### Мораль

Возможно, вам может показаться, что это слишком абсурдная ситуация, но, я вас уверяю, такое случается сплошь и рядом, как в
бигтехах, так и в маленьких конторах. Наш курс учит проектировать приложения так, чтобы при каждом новом требовании вам
не приходилось писать приложение заново. К сожалению, предугадать все невозможно, но есть устоявшиеся практики,
которые позволяют при минимальных усилиях сильно улучшить процесс.

### Так к чему это?

В дальнейшем в курсе мы часто будем снова и снова возвращаться к одному и тому же движению. Сначала появляется
маленькое приложение:
тип данных, функция, сервис, простой сценарий. Затем приходит изменение: другой способ хранения, новый канал связи,
тестовая подмена, внешнее API, распределенная транзакция или production-инцидент. В этот момент становится видно, где
код был просто написан, а где он был сконструирован.

```mermaid
flowchart LR
    Small["Маленькая задача"] --> Working["Работающий код"]
    Working --> Change["Новое требование"]
    Change --> Friction{"Где возникает трение?"}
    Friction --> Types["Типы и инварианты"]
    Friction --> Dependencies["Зависимости"]
    Friction --> Boundaries["Границы модулей"]
    Friction --> Runtime["Эксплуатация"]
```

## Код и изменения

Работающий код - минимальное требование.

Конструирование ПО отвечает на вопрос: насколько дорого будет внести это изменение?

Посчитайте, какие решения приходится пересматривать одновременно. При добавлении email изменения в выборе канала и отправке ожидаемы. Если заодно приходится менять расчёт даты закрытия магазина, стоит проверить границы модулей.

Архитектура часто не выглядит срочной. Функцию можно показать заказчику быстрее, чем аккуратную границу между доменной
логикой и инфраструктурой. Но долгосрочно именно эти границы определяют, будете ли вы и команда кранчить в ночь с пятницы
на субботу или спать. И будет ли бизнес терять деньги на багах и костылях, которые были написаны в тихую московскую ночь.

## Парадигмы

Парадигма программирования предлагает способ организовать вычисления. Сравним три подхода через ограничения, которые они помогают выразить. Часть ограничений поддерживает язык, часть выбирает сама команда. Например, функцию, которая возвращает новый текст сообщения без изменения входных данных, легко проверить на одном и том же входе.

| Парадигма      | Что ограничивает                                 | Что дает                                       |
|----------------|--------------------------------------------------|------------------------------------------------|
| Структурная    | Произвольный переход потока через `goto`         | Читаемый контроль выполнения                   |
| Функциональная | Изменяемое состояние и побочные эффекты          | Предсказуемость и композицию вычислений        |
| ООП            | Прямую работу с деталями и данными без контракта | Моделирование объектов, отношений и контрактов |

Современные языки в основном мультипарадигмальны. Kotlin, C#, Java и Go позволяют писать императивный код, использовать
объекты, функции, интерфейсы и композицию. Поэтому вопрос не в том, какая парадигма "победила", а в том, какой
инструмент подходит к текущей части задачи.

В Kotlin цепочка `filter` и `map` помогает сначала выбрать адресатов, затем получить тексты сообщений. Объявление `val` запрещает переприсвоить переменную. Содержимое объекта всё ещё может изменяться: вызов `add` у `val recipients = mutableListOf<String>()` добавит элемент.

В C# мультипарадигмальность видна в LINQ, `record`-типах, интерфейсах, async/await и классической объектной модели. Один
и тот же доменный код может сочетать объекты и функциональные преобразования коллекций.

В Java объектная модель исторически центральная, но современные версии языка добавили `record`, `sealed`, Stream API и
lambda-выражения. Это не отменяет ООП, а расширяет способы выражать модель.

В Go есть структуры, методы и интерфейсы. Например, тип с методом `Move() string` удовлетворяет интерфейсу с этой единственной операцией без отдельного объявления `implements`.

::: only kotlin
В Kotlin `sealed interface` помогает компилятору проверить полноту ветвей `when`, а `data class` генерирует сравнение по свойствам первичного конструктора. Для передачи реализации интерфейса другому объекту в языке есть делегирование через `by`.
:::

## Минимум ООП

Для курса нам важно не повторить весь первый год ООП, а зафиксировать минимальную модель:

- класс или структура описывает тип данных;
- объект или значение - конкретный экземпляр типа;
- состояние - данные внутри объекта;
- поведение - операции, которые объект умеет выполнять;
- инвариант - правило, которое должно оставаться истинным;
- публичный контракт - то, что внешний код может ожидать от объекта.

Например, email - не просто строка. Если в домене нужна гарантия, что email содержит `@`, лучше выразить это в отдельном
типе и держать инвариант рядом с данными.

::: details Кто такой ваш инвариант?

После создания объекта и завершения каждой публичной операции его состояние должно удовлетворять правилам типа. Возьмём персонажа в игре. Пока он жив, у него больше нуля хп. Если после удара осталось ноль хп, а персонаж всё ещё жив, наше правило нарушено.
:::

::: multi-code "Минимальный доменный тип"

```kotlin
@JvmInline
value class Email(val value: String) {
    init {
        require("@" in value) { "Invalid email: $value" }
    }
}

data class User(
    val id: String,
    val email: Email
)
```

```kotlin playground
@JvmInline
value class Email(val value: String) {
    init {
        require("@" in value) { "Invalid email: $value" }
    }
}

data class User(
    val id: String,
    val email: Email
)

fun main() {
    val user = User("u-1", Email("alice@example.com"))
    println("Created user: ${user.id}, ${user.email.value}")

    val invalid = runCatching { Email("not-an-email") }
    println("Invalid email accepted: ${invalid.isSuccess}")
    println("Validation error: ${invalid.exceptionOrNull()?.message}")
}
```

```csharp
public readonly record struct Email
{
    public string Value { get; }

    public Email(string value)
    {
        if (!value.Contains('@'))
            throw new ArgumentException($"Invalid email: {value}");

        Value = value;
    }
}

public sealed record User(string Id, Email Email);
```

```java
record Email(String value) {
    Email {
        if (!value.contains("@")) {
            throw new IllegalArgumentException("Invalid email: " + value);
        }
    }
}

record User(String id, Email email) {
}
```

```go
package main

import (
    "fmt"
    "strings"
)

type Email string

func NewEmail(value string) (Email, error) {
    if !strings.Contains(value, "@") {
        return "", fmt.Errorf("invalid email: %s", value)
    }
    return Email(value), nil
}

type User struct {
    ID    string
    Email Email
}
```

:::

Что важно: типы нужны не ради "красивой объектности". Они помогают зафиксировать смысл и защитить бизнес-правила от
случайного нарушения.

Запустите пример с `not-an-email`: Kotlin отклонит значение, а `runCatching` позволит показать ошибку. При чтении повреждённой записи из БД программе тоже нужен обработчик. Проверка одного символа пропустит даже строку `@`, поэтому здесь она иллюстрирует только механизм проверки. В Go вызывающий код может обойти фабрику прямым приведением к `Email`, а в C# значение `default(Email)` обходит конструктор структуры.

## Связи важнее классов

У двух классов могут быть одинаковые поля, но разные обязательства перед остальной программой. Разберём, что означает каждая связь и как проверить её по поведению.

## Отношения между типами

Основные отношения, которые понадобятся уже в первой лекции:

- наследование - тип является частным случаем другого типа;
- ассоциация - объект знает о другом объекте;
- агрегация — целое объединяет части, которые в данной модели могут существовать самостоятельно;
- композиция - объект владеет частью и управляет ее жизненным циклом;
- реализация интерфейса - тип умеет выполнять контракт.

```mermaid
classDiagram
    class User
    class Manager
    class Team
    class Club
    class Player
    class Car
    class Engine
    class Movable {
        <<interface>>
        +move()
    }
    User <|-- Manager
    Player --> Team
    Club o-- Player
    Car *-- Engine
    Movable <|.. Car
```

| Связь | Пример | Что проверить |
|-------|--------|---------------|
| Наследование | `Manager` является `User` | Сохраняются ли гарантии `User`? |
| Ассоциация | `Player` знает свою `Team` | Нужно ли хранить связь между вызовами? |
| Композиция | В модели машины `Car` владеет `Engine` | Есть ли у части ровно один владелец, пока она в его составе? |
| Агрегация | Клуб объединяет игроков | Могут ли игроки продолжить существовать после закрытия клуба? |
| Реализация | `Car` реализует `Movable` | Выполняет ли машина контракт движения? |

## Наследование

Наследование выражает отношение `is-a`: потомок должен быть настоящим частным случаем родителя. Если код ожидает `User`,
он должен корректно работать с `Manager`, не проверяя "а вдруг это особый потомок".

::: warning Наследование не запрещено
Проблема не в самом наследовании, а в ложном наследовании. Если связь не является строгим `is-a`, лучше искать
композицию, агрегацию или интерфейс.
:::

::: multi-code "Наследование"

```kotlin
open class User(
    val id: String,
    val name: String
)

class Manager(
    id: String,
    name: String,
    val department: String
) : User(id, name)
```

```kotlin playground
open class User(
    val id: String,
    val name: String
)

class Manager(
    id: String,
    name: String,
    val department: String
) : User(id, name)

fun main() {
    val manager = Manager("u-1", "Ada", "Platform")
    println("${manager.name}: ${manager.department}")
}
```

```csharp
public class User
{
    public required string Id { get; init; }
    public required string Name { get; init; }
}

public sealed class Manager : User
{
    public required string Department { get; init; }
}
```

```java
class User {
    final String id;
    final String name;

    User(String id, String name) {
        this.id = id;
        this.name = name;
    }
}

class Manager extends User {
    final String department;

    Manager(String id, String name, String department) {
        super(id, name);
        this.department = department;
    }
}
```

```go
type User struct {
    ID   string
    Name string
}

type Manager struct {
    User
    Department string
}
```

:::

```mermaid
classDiagram
    class User {
        +id
        +name
    }
    class Manager {
        +department
    }
    User <|-- Manager
```

::: only go
Вкладка Go показывает встраивание `User`. Поле `Name` доступно через `manager.Name`, однако функции с параметром типа `User` нужно передать `manager.User`. Встраивание не образует отношения подтипов между структурами.
:::

Этот пример учебный. В реальной системе роль «менеджер» часто лучше моделировать правами или
отдельной сущностью `EmployeeProfile`. Наследование стоит выбирать только после вопроса: "можно ли любого потомка
безопасно использовать там, где ждут родителя?"

## Ассоциация

При ассоциации объекты связаны в предметной модели. Здесь игрок хранит ссылку на свою команду между вызовами. Однократной передачи объекта в функцию недостаточно, чтобы заключить, что между экземплярами есть такая постоянная связь.

::: multi-code "Ассоциация"

```kotlin
class Team(val name: String)

class Player(
    val name: String,
    val team: Team
)
```

```kotlin playground
class Team(val name: String)

class Player(
    val name: String,
    val team: Team
)

fun main() {
    val team = Team("Falcons")
    val player = Player("Mira", team)
    println("${player.name}: ${player.team.name}")
}
```

```csharp
public sealed record Team(string Name);

public sealed record Player(string Name, Team Team);
```

```java
record Team(String name) {
}

record Player(String name, Team team) {
}
```

```go
type Team struct {
    Name string
}

type Player struct {
    Name string
    Team *Team
}
```

:::

```mermaid
classDiagram
    class Team {
        +name
    }
    class Player {
        +name
        +team
    }
    Player --> Team
```

Ассоциация полезна, когда объекту нужно знать контекст: игрок знает команду, заказ знает клиента, платеж знает счет.
Опасность возникает, если ассоциаций слишком много: объект начинает знать слишком большую часть системы.

## Композиция

В UML композиция задаёт владение частью. Пока часть входит в состав целого, у неё может быть только один такой владелец. При удалении целого удаляются и его текущие части. Способ создания части модель оставляет на усмотрение разработчика.

::: multi-code "Композиция"

```kotlin
class ElectricEngine {
    fun start() = "engine started"
}

class Car {
    private val engine = ElectricEngine()

    fun start(): String = engine.start()
}
```

```kotlin playground
class ElectricEngine {
    fun start() = "engine started"
}

class Car {
    private val engine = ElectricEngine()

    fun start(): String = engine.start()
}

fun main() {
    val car = Car()
    println(car.start())
    println("Engine is created inside Car, so swapping it requires changing Car.")
}
```

```csharp
public sealed class ElectricEngine
{
    public string Start() => "engine started";
}

public sealed class Car
{
    private readonly ElectricEngine engine = new();

    public string Start() => engine.Start();
}
```

```java
class ElectricEngine {
    String start() {
        return "engine started";
    }
}

class Car {
    private final ElectricEngine engine = new ElectricEngine();

    String start() {
        return engine.start();
    }
}
```

```go
type ElectricEngine struct{}

func (ElectricEngine) Start() string {
    return "engine started"
}

type Car struct {
    engine ElectricEngine
}

func (c Car) Start() string {
    return c.engine.Start()
}
```

:::

```mermaid
classDiagram
    class Car {
        -engine
        +start()
    }
    class ElectricEngine {
        +start()
    }
    Car *-- ElectricEngine
```

В этой версии тип двигателя закреплён в определении `Car`. В Go поле-значение получает нулевое значение структуры `ElectricEngine` вместе с машиной. Добавление дизельной версии потребует изменить этот код. Можно передавать двигатели через интерфейс и отдельно решить, переходит ли владение автомобилю.

## Агрегация

При агрегации целое объединяет самостоятельные части. Например, игроки могут перейти в другой клуб, если их клуб закроется. Точный смысл такой связи автор UML-модели должен пояснить.

В следующем примере предположим, что мастерская учитывает двигатели отдельно от машин и может снять двигатель для другого автомобиля. По этой договорённости изобразим двигатель как самостоятельную часть. В коде показан другой аспект того же решения — как передать выбранный двигатель снаружи.

::: multi-code "Агрегация"

```kotlin
interface Engine {
    fun start(): String
}

class ElectricEngine : Engine {
    override fun start() = "electric engine started"
}

class DieselEngine : Engine {
    override fun start() = "diesel engine started"
}

class Car(private val engine: Engine) {
    fun start(): String = engine.start()
}
```

```kotlin playground
interface Engine {
    fun start(): String
}

class ElectricEngine : Engine {
    override fun start() = "electric engine started"
}

class DieselEngine : Engine {
    override fun start() = "diesel engine started"
}

class Car(private val engine: Engine) {
    fun start(): String = engine.start()
}

fun main() {
    val electricCar = Car(ElectricEngine())
    val dieselCar = Car(DieselEngine())

    println(electricCar.start())
    println(dieselCar.start())
    println("Car did not change; only the injected Engine changed.")
}
```

```csharp
public interface IEngine
{
    string Start();
}

public sealed class ElectricEngine : IEngine
{
    public string Start() => "electric engine started";
}

public sealed class Car(IEngine engine)
{
    public string Start() => engine.Start();
}
```

```java
interface Engine {
    String start();
}

class ElectricEngine implements Engine {
    public String start() {
        return "electric engine started";
    }
}

class Car {
    private final Engine engine;

    Car(Engine engine) {
        this.engine = engine;
    }

    String start() {
        return engine.start();
    }
}
```

```go
type Engine interface {
    Start() string
}

type ElectricEngine struct{}

func (ElectricEngine) Start() string {
    return "electric engine started"
}

type Car struct {
    engine Engine
}

func (c Car) Start() string {
    return c.engine.Start()
}
```

:::

```mermaid
classDiagram
    class Engine {
        <<interface>>
        +start()
    }
    class ElectricEngine {
        +start()
    }
    class Car {
        -engine
        +start()
    }
    Engine <|.. ElectricEngine
    Car o-- Engine
```

Для теста мастерская может передать машине двигатель-заглушку, который возвращает известную строку. Такую подмену обеспечивает передача зависимости через интерфейс. Она возможна и в модели, где машина получает двигатель в исключительное владение.

### Инфографика

```mermaid
flowchart TD
    A["Нужно связать два типа"] --> B{"Один тип действительно является частным случаем другого"}
    B -->|" да "| C["Проверить LSP и только потом наследование"]
    B -->|" нет "| D{"Один объект содержит другой"}
    D -->|" владеет жизненным циклом "| E["Композиция"]
    D -->|" объединяет самостоятельные части "| F["Агрегация"]
    D -->|" только знает или использует "| G["Ассоциация"]
    A --> H{"Нужно общее поведение у разных иерархий"}
    H -->|" да "| I["Интерфейс"]
```

Начните со сценария: если игрок переходит в другой клуб, кто обновляет состав команды? Если заказ удаляют, что случается с его строками? Ответы помогут выбрать связь и объяснить её коллегам.

## Интерфейсы

Интерфейс описывает контракт: какие операции доступны и что внешний код вправе ожидать. Реализаторы интерфейса не
обязаны быть родственниками.

Автомобиль, велосипед и лифт могут предоставить операцию движения. Общий контракт позволяет вызвать её у каждого из них.

::: multi-code "Реализация интерфейса"

```kotlin
interface Movable {
    fun move(): String
}

class Car : Movable {
    override fun move() = "car moves"
}

class Elevator : Movable {
    override fun move() = "elevator moves"
}

fun start(movable: Movable) {
    println(movable.move())
}
```

```kotlin playground
interface Movable {
    fun move(): String
}

class Car : Movable {
    override fun move() = "car moves"
}

class Elevator : Movable {
    override fun move() = "elevator moves"
}

fun start(movable: Movable) {
    println(movable.move())
}

fun main() {
    val objects: List<Movable> = listOf(Car(), Elevator())
    objects.forEach(::start)
}
```

```csharp
public interface IMovable
{
    string Move();
}

public sealed class Car : IMovable
{
    public string Move() => "car moves";
}

public sealed class Elevator : IMovable
{
    public string Move() => "elevator moves";
}
```

```java
interface Movable {
    String move();
}

class Car implements Movable {
    public String move() {
        return "car moves";
    }
}

class Elevator implements Movable {
    public String move() {
        return "elevator moves";
    }
}
```

```go
type Movable interface {
    Move() string
}

type Car struct{}

func (Car) Move() string {
    return "car moves"
}

type Elevator struct{}

func (Elevator) Move() string {
    return "elevator moves"
}
```

:::

::: only go
В Go тип реализует интерфейс неявно: если у типа есть метод `Move() string`, он уже подходит под `Movable`. Не нужно
писать `implements`.
:::

Интерфейс полезен, когда внешний код хочет работать с возможностью, а не с конкретным классом. Это снижает связанность и
готовит почву для DIP.

## Класс или интерфейс

Практическое правило:

- если нужно общее поведение у разных иерархий - начните с интерфейса;
- если есть настоящее родство, общее состояние и частичная реализация - возможен абстрактный класс;
- если сомневаетесь, не создавайте абстракцию заранее.

| Вопрос                                     | Интерфейс            | Абстрактный класс   |
|--------------------------------------------|----------------------|---------------------|
| Нужно общее поведение без родства?         | Да                   | Обычно нет          |
| Нужно общее состояние?                     | Нет                  | Да                  |
| Нужна частичная реализация алгоритма?      | Иногда, но осторожно | Да                  |
| Есть настоящая иерархия?                   | Может дополнять      | Да                  |
| Нужна множественная реализация контрактов? | Да                   | Нет или ограниченно |

Абстрактный класс удобен для шаблонного алгоритма: общая последовательность шагов фиксирована, а часть шагов
переопределяется потомками.

Интерфейс удобен для способности: печатать, двигаться, сохранять, отправлять уведомление.

::: tip Как выбрать
Если вызывающему коду достаточно вызвать `print`, опишите эту операцию интерфейсом. Если несколько родственных типов выполняют одну и ту же последовательность шагов и хранят общее состояние, рассмотрите абстрактный класс.
:::

## LSP

Барбара Лисков и Джаннет Уинг связали подтип с сохранением свойств, которые следуют из контракта базового типа. В обозначениях ниже это можно записать так.

::: tip Алгебра настигла нас
Пусть `φ(x)` — свойство, доказуемое для объектов `x` типа `T`.

Если `S` является подтипом `T`, то это свойство должно также выполняться
для объектов `y` типа `S`.

$$
\begin{aligned}
S <: T
&\quad\Longrightarrow\quad
(\forall x : T,\ \varphi(x)) \\
&\quad\Rightarrow\quad
(\forall y : S,\ \varphi(y))
\end{aligned}
$$

Где:

- `T` — супертип;
- `S` — подтип;
- `S <: T` — `S` является подтипом `T`;
- `φ(x)` — доказуемое свойство объекта типа `T`.
:::


Проверка на примере: какие результаты разрешено ожидать коду, который знает только базовый тип? Эти ожидания должны выполняться для каждого подтипа.

Классический пример - квадрат и прямоугольник. В математике квадрат является прямоугольником. В программе наследование
может оказаться ошибкой, если у `Rectangle` есть независимые `setWidth` и `setHeight`, а `Square` вынужден менять оба
измерения одновременно.

```mermaid
classDiagram
    class Rectangle {
        +setWidth(width)
        +setHeight(height)
        +area()
    }
    class Square {
        +setWidth(width)
        +setHeight(height)
    }
    Rectangle <|-- Square
```

Проблема не в формуле площади. Проблема в контракте: внешний код ожидает, что ширину и высоту прямоугольника можно
менять независимо.

Сначала посмотрим на проблему — мутабельный `MutableSquare`, который наследует `MutableRectangle`, ломает ожидания
вызывающего кода. Потом посмотрим на решение — общий интерфейс `Shape` без ложной иерархии. Playground ниже показывает
обе ситуации: нарушение LSP и его исправление.

::: multi-code "LSP: площадь фигуры"

```kotlin
interface Shape {
    fun area(): Int
}

data class Rectangle(val width: Int, val height: Int) : Shape {
    override fun area(): Int = width * height
}

data class Square(val side: Int) : Shape {
    override fun area(): Int = side * side
}
```

```kotlin playground
open class MutableRectangle(
    private var width: Int,
    private var height: Int
) {
    open fun setWidth(value: Int) {
        width = value
    }

    open fun setHeight(value: Int) {
        height = value
    }

    fun area(): Int = width * height
}

class MutableSquare(side: Int) : MutableRectangle(side, side) {
    override fun setWidth(value: Int) {
        super.setWidth(value)
        super.setHeight(value)
    }

    override fun setHeight(value: Int) {
        setWidth(value)
    }
}

fun resizeToFiveByTen(rectangle: MutableRectangle): Int {
    rectangle.setWidth(5)
    rectangle.setHeight(10)
    return rectangle.area()
}

interface Shape {
    fun area(): Int
}

data class Rectangle(val width: Int, val height: Int) : Shape {
    override fun area(): Int = width * height
}

data class Square(val side: Int) : Shape {
    override fun area(): Int = side * side
}

fun main() {
    println("Rectangle area: ${resizeToFiveByTen(MutableRectangle(1, 1))}")
    println("Square through rectangle API: ${resizeToFiveByTen(MutableSquare(1))}")
    println("Expected 50, but square gives 100: LSP is broken.")

    val shapes: List<Shape> = listOf(Rectangle(5, 10), Square(10))
    println("Safe areas through Shape: ${shapes.map { it.area() }}")
}
```

```csharp
public interface IShape
{
    int Area();
}

public sealed record Rectangle(int Width, int Height) : IShape
{
    public int Area() => Width * Height;
}

public sealed record Square(int Side) : IShape
{
    public int Area() => Side * Side;
}
```

```java
interface Shape {
    int area();
}

record Rectangle(int width, int height) implements Shape {
    public int area() {
        return width * height;
    }
}

record Square(int side) implements Shape {
    public int area() {
        return side * side;
    }
}
```

```go
type Shape interface {
    Area() int
}

type Rectangle struct {
    Width  int
    Height int
}

func (r Rectangle) Area() int {
    return r.Width * r.Height
}

type Square struct {
    Side int
}

func (s Square) Area() int {
    return s.Side * s.Side
}
```

:::

Здесь `Rectangle` и `Square` не наследуются друг от друга. Они оба реализуют общий контракт `Shape`. Мы сохранили
полиморфизм, но убрали ложную иерархию.

## Баланс абстракций

Если абстракций слишком мало, код быстро становится жестким. Высокоуровневые правила зависят от конкретных деталей:
консоли, базы данных, файловой системы, HTTP-клиента. Любая замена детали тянет правки по всей системе.

Если абстракций слишком много, проект становится трудным для чтения. Появляются интерфейсы без альтернативных
реализаций, фабрики без причины, слои без ответственности. Такой проект тоже дорогой: новый разработчик тратит время не
на бизнес-задачу, а на расшифровку лишней конструкции.

```mermaid
flowchart LR
    A["Мало абстракций"] --> B["Жесткие зависимости"]
    B --> C["Сложно менять"]
    D["Слишком много абстракций"] --> E["Высокий порог входа"]
    E --> F["Overengineering"]
    G["Разумный дизайн"] --> H["Абстракции закрывают реальные точки изменения"]
```

Вводите абстракцию, когда она решает назревшую проблему:

- появилась вторая реализация;
- нужно тестировать код без реальной инфраструктуры;
- бизнес-правило не должно зависеть от способа хранения или вывода;
- изменение детали уже заставляет менять слишком много мест.

## SOLID

SOLID - это язык разговора о дизайне классов и зависимостей. Его не нужно применять как чек-лист "добавить пять
паттернов". Принципы помогают объяснить, почему один дизайн легче менять, чем другой.

| Буква | Принцип               | Главный вопрос                                     |
|-------|-----------------------|----------------------------------------------------|
| S     | Single Responsibility | У класса одна причина измениться?                  |
| O     | Open/Closed           | Можно расширить поведение без правки старого кода? |
| L     | Liskov Substitution   | Потомок сохраняет контракт родителя?               |
| I     | Interface Segregation | Клиент зависит только от нужных методов?           |
| D     | Dependency Inversion  | Высокоуровневый код зависит от абстракций?         |

Мы уже разобрали LSP на фигурах. Дальше рассмотрим причины изменения класса, контракты клиентов и направление зависимостей. В конце проверим, когда новый вариант поведения можно добавить без изменения существующего класса.

### Сквозной пример

Вернёмся к нашей временной программке для рассылки. Покупатели с номером телефона получат SMS, остальные — письмо, если у них есть почта. Когда появится ещё один канал, важно сохранить правила отбора адресатов. На схеме событие «магазин закрывается» запускает выбор получателей и подготовку сообщения.

```mermaid
flowchart LR
    A["Доменное событие"] --> B["NotificationPolicy"]
    B --> C["NotificationMessage"]
    C --> D["NotificationSender"]
    D --> E["Email"]
    D --> F["SMS"]
    D --> G["Push"]
```

Этот пример покажет, почему один большой класс быстро нарушает SRP, один большой интерфейс нарушает ISP, а зависимость
бизнес-логики от конкретного SMTP-клиента нарушает DIP.

### SRP

Рассмотрим `NotificationService`. Один класс содержит выбор канала, форматирование, отправку, retry и
логирование. Каждый из этих аспектов меняется по разным причинам и в разное время. Это нарушение SRP.

Single Responsibility Principle часто переводят как "у класса должна быть одна ответственность". Более точная
формулировка: у класса должна быть одна причина для изменения.

Причина изменения обычно приходит от роли или процесса. Бухгалтер просит изменить расчет премий. Директор просит другой
формат отчета. Пользователь просит другую навигацию. Если все эти изменения попадают в один класс, класс делает слишком
много.

```mermaid
flowchart TD
    A["BonusReport"] --> B["Расчет премий"]
    A --> C["Навигация"]
    A --> D["Печать в PDF"]
    A --> E["Печать в консоль"]
```

Лучше разделить причины:

```mermaid
flowchart TD
    A["BonusCalculator"] --> B["BonusReport"]
    B --> C["ReportRenderer"]
    C --> D["WebRenderer"]
    C --> E["PdfRenderer"]
```

Теперь изменение формата вывода не трогает расчет премий, а изменение формулы премии не трогает PDF.

Если бухгалтер меняет формулу, разработчик открывает `BonusCalculator`. Если директор просит изменить поля печатной формы, точкой изменения становится `PdfRenderer`.

### LSP в SOLID

LSP уже был разобран на фигурах, но в SOLID он выполняет отдельную роль: защищает полиморфизм. Если потомок заставляет
внешний код проверять конкретный тип, наследование перестало быть надежной абстракцией.

Признаки возможного нарушения:

- потомок кидает `NotSupportedException` в методе родителя;
- потомок требует дополнительных предусловий, которых нет у родителя;
- потомок возвращает результат, нарушающий ожидания от родителя;
- тесты базового типа не проходят для потомка.

::: tip Проверка подстановки
Вызовите один сценарий через базовый тип для двух реализаций. Если обе выполняют обещание базового контракта, различие в деталях результата допустимо.
:::

### ISP

Interface Segregation Principle говорит: клиент не должен зависеть от методов, которые он не использует.

Плохой симптом - интерфейс, который заставляет часть реализаций писать пустые методы или выбрасывать
`NotImplementedException`. Например, email имеет subject, SMS обычно нет, голосовое сообщение не имеет текстового тела в
том же смысле.

::: multi-code "ISP: маленькие интерфейсы сообщений"

```kotlin
interface Message {
    val recipient: String
}

interface TextMessage : Message {
    val text: String
}

interface SubjectMessage : TextMessage {
    val subject: String
}

data class Email(
    override val recipient: String,
    override val subject: String,
    override val text: String
) : SubjectMessage

data class Sms(
    override val recipient: String,
    override val text: String
) : TextMessage
```

```kotlin playground
interface Message {
    val recipient: String
}

interface TextMessage : Message {
    val text: String
}

interface SubjectMessage : TextMessage {
    val subject: String
}

data class Email(
    override val recipient: String,
    override val subject: String,
    override val text: String
) : SubjectMessage

data class Sms(
    override val recipient: String,
    override val text: String
) : TextMessage

fun describe(message: Message): String = when (message) {
    is SubjectMessage -> "subject='${message.subject}', text='${message.text}'"
    is TextMessage -> "text='${message.text}'"
    else -> "recipient='${message.recipient}'"
}

fun main() {
    val messages: List<Message> = listOf(
        Email("student@example.com", "Schedule", "Lecture moved"),
        Sms("+79990000000", "Lecture moved")
    )

    messages.forEach { println(describe(it)) }
    println("Sms is not forced to have a fake subject.")
}
```

```csharp
public interface IMessage
{
    string Recipient { get; }
}

public interface ITextMessage : IMessage
{
    string Text { get; }
}

public interface ISubjectMessage : ITextMessage
{
    string Subject { get; }
}

public sealed record Email(
    string Recipient,
    string Subject,
    string Text
) : ISubjectMessage;

public sealed record Sms(
    string Recipient,
    string Text
) : ITextMessage;
```

```java
interface Message {
    String recipient();
}

interface TextMessage extends Message {
    String text();
}

interface SubjectMessage extends TextMessage {
    String subject();
}

record Email(String recipient, String subject, String text) implements SubjectMessage {
}

record Sms(String recipient, String text) implements TextMessage {
}
```

```go
type Message interface {
    Recipient() string
}

type TextMessage interface {
    Message
    Text() string
}

type SubjectMessage interface {
    TextMessage
    Subject() string
}

type Email struct {
    To      string
    Topic   string
    Content string
}

func (e Email) Recipient() string { return e.To }
func (e Email) Subject() string   { return e.Topic }
func (e Email) Text() string      { return e.Content }

type Sms struct {
    To      string
    Content string
}

func (s Sms) Recipient() string { return s.To }
func (s Sms) Text() string      { return s.Content }
```

:::

Какую часть сообщения читает клиент? Счётчику символов SMS достаточно контракта `TextMessage`. Он сможет обработать и текст письма. Формировщику заголовка письма нужен `SubjectMessage`. Передать ему SMS не получится уже при проверке типов.

### DIP

Dependency Inversion Principle - ключ к следующей лекции про внедрение зависимостей
([Лекция 2, раздел DIP и DI](/lectures/02#dip-и-di)). Формулировка:

- высокоуровневые модули не должны зависеть от низкоуровневых модулей;
- оба должны зависеть от абстракций;
- абстракции не должны зависеть от деталей;
- детали должны зависеть от абстракций.

Высокоуровневый код - это бизнес-правила и use cases. Низкоуровневый код - консоль, база данных, PDF, HTML, HTTP,
файловая система. Бизнес-правило не должно знать, куда именно печатается результат.

```mermaid
flowchart TD
    A["BookService"] --> B["Printer interface"]
    C["ConsolePrinter"] --> B
    D["HtmlPrinter"] --> B
    E["PdfPrinter"] --> B
```

::: multi-code "DIP: сервис зависит от принтера как абстракции"

```kotlin
interface Printer {
    fun print(text: String)
}

class ConsolePrinter : Printer {
    override fun print(text: String) {
        println(text)
    }
}

class BufferPrinter : Printer {
    val lines = mutableListOf<String>()

    override fun print(text: String) {
        lines += text
    }
}

class BookService(private val printer: Printer) {
    fun printTitle(title: String) {
        printer.print("Book: $title")
    }
}
```

```kotlin playground
interface Printer {
    fun print(text: String)
}

class ConsolePrinter : Printer {
    override fun print(text: String) {
        println(text)
    }
}

class BufferPrinter : Printer {
    val lines = mutableListOf<String>()

    override fun print(text: String) {
        lines += text
    }
}

class BookService(private val printer: Printer) {
    fun printTitle(title: String) {
        printer.print("Book: $title")
    }
}

fun main() {
    BookService(ConsolePrinter()).printTitle("Clean Architecture")

    val buffer = BufferPrinter()
    BookService(buffer).printTitle("Domain-Driven Design")
    println("Captured in test double: ${buffer.lines}")
}
```

```csharp
public interface IPrinter
{
    void Print(string text);
}

public sealed class ConsolePrinter : IPrinter
{
    public void Print(string text) => Console.WriteLine(text);
}

public sealed class BookService(IPrinter printer)
{
    public void PrintTitle(string title)
    {
        printer.Print($"Book: {title}");
    }
}
```

```java
interface Printer {
    void print(String text);
}

class ConsolePrinter implements Printer {
    public void print(String text) {
        System.out.println(text);
    }
}

class BookService {
    private final Printer printer;

    BookService(Printer printer) {
        this.printer = printer;
    }

    void printTitle(String title) {
        printer.print("Book: " + title);
    }
}
```

```go
type Printer interface {
    Print(text string)
}

type ConsolePrinter struct{}

func (ConsolePrinter) Print(text string) {
    fmt.Println(text)
}

type BookService struct {
    printer Printer
}

func (s BookService) PrintTitle(title string) {
    s.printer.Print("Book: " + title)
}
```

:::

Главная идея: `BookService` не знает, консоль это, HTML или PDF. Он знает только контракт `Printer`.

### OCP

Open/Closed Principle звучит противоречиво: класс должен быть открыт для расширения, но закрыт для модификации. На
практике это значит: новые возможности добавляются новыми типами или реализациями, а стабильный код не переписывается
каждый раз.

Плохой вариант: `Cookbook` содержит методы `prepareMashedPotatoes`, `prepareSalad`, потом `prepareSoup`, потом
`preparePasta`. Каждый новый рецепт меняет старый класс.

Хороший вариант: `Cookbook` умеет приготовить любой `Recipe`.

::: multi-code "OCP: рецепты расширяют поведение"

```kotlin
interface Recipe {
    fun cook(): String
}

class MashedPotatoes : Recipe {
    override fun cook() = "Boil potatoes and mash them"
}

class Salad : Recipe {
    override fun cook() = "Slice vegetables and mix"
}

class Soup : Recipe {
    override fun cook() = "Boil vegetables in broth"
}

class Cookbook {
    fun prepare(recipe: Recipe): String = recipe.cook()
}
```

```kotlin playground
interface Recipe {
    fun cook(): String
}

class MashedPotatoes : Recipe {
    override fun cook() = "Boil potatoes and mash them"
}

class Salad : Recipe {
    override fun cook() = "Slice vegetables and mix"
}

class Soup : Recipe {
    override fun cook() = "Boil vegetables in broth"
}

class Cookbook {
    fun prepare(recipe: Recipe): String = recipe.cook()
}

fun main() {
    val cookbook = Cookbook()
    val recipes: List<Recipe> = listOf(MashedPotatoes(), Salad(), Soup())

    recipes.forEach { println(cookbook.prepare(it)) }
    println("Cookbook stayed unchanged when Soup appeared.")
}
```

```csharp
public interface IRecipe
{
    string Cook();
}

public sealed class MashedPotatoes : IRecipe
{
    public string Cook() => "Boil potatoes and mash them";
}

public sealed class Salad : IRecipe
{
    public string Cook() => "Slice vegetables and mix";
}

public sealed class Cookbook
{
    public string Prepare(IRecipe recipe) => recipe.Cook();
}
```

```java
interface Recipe {
    String cook();
}

class MashedPotatoes implements Recipe {
    public String cook() {
        return "Boil potatoes and mash them";
    }
}

class Salad implements Recipe {
    public String cook() {
        return "Slice vegetables and mix";
    }
}

class Cookbook {
    String prepare(Recipe recipe) {
        return recipe.cook();
    }
}
```

```go
type Recipe interface {
    Cook() string
}

type MashedPotatoes struct{}

func (MashedPotatoes) Cook() string {
    return "Boil potatoes and mash them"
}

type Salad struct{}

func (Salad) Cook() string {
    return "Slice vegetables and mix"
}

type Cookbook struct{}

func (Cookbook) Prepare(recipe Recipe) string {
    return recipe.Cook()
}
```

:::

OCP часто достигается через DIP: стабильный код зависит от абстракции, а новые детали приходят в виде новых реализаций.

## GRASP

GRASP - более прикладной набор принципов назначения ответственностей. В первой лекции достаточно зафиксировать две идеи:

- High Cohesion - внутри класса должны быть тесно связанные обязанности;
- Low Coupling - между классами должно быть как можно меньше лишних знаний друг о друге.

```mermaid
flowchart TD
    A["High Cohesion"] --> B["Класс делает одну связанную задачу"]
    C["Low Coupling"] --> D["Классы знают друг о друге минимум"]
    B --> E["Проще понять"]
    D --> F["Проще заменить"]
```

У класса `OrderManager` слабо связаны собственные обязанности (low cohesion). Посмотрим, какие изменения затронут один и тот же файл.

```kotlin
// Схема обязанностей: реализация внешних операций опущена.
class OrderManager {
    fun calculateTotal(items: List<Item>): Int = items.sumOf { it.price }
    fun sendConfirmationEmail(email: String, orderId: String) { /* SMTP logic */ }
    fun generatePdfInvoice(orderId: String): ByteArray = TODO("PDF rendering")
    fun logOrderEvent(event: String) { /* file I/O */ }
}
```

У этого класса четыре причины меняться: бизнес-правила расчёта, формат писем, шаблон PDF и формат логов. High Cohesion
подсказывает разделить его на части так, чтобы каждая отвечала за одну задачу:

```kotlin
class OrderCalculator {
    fun total(items: List<Item>): Int = items.sumOf { it.price }
}

class OrderNotifier(private val mailer: Mailer) {
    fun confirmOrder(email: String, orderId: String) { /* ... */ }
}
```

Теперь изменение формата письма не затрагивает расчёт цен. Low Coupling при этом достигается через интерфейсы:
`OrderNotifier` зависит от `Mailer`, а не от `SmtpMailer`.

SOLID и GRASP не конфликтуют. Они часто описывают одну инженерную цель разными словами:

| Идея GRASP           | Похожая идея SOLID | Практический эффект                                |
|----------------------|--------------------|----------------------------------------------------|
| High Cohesion        | SRP                | Класс проще понять и менять                        |
| Low Coupling         | ISP, DIP           | Детали проще заменить                              |
| Polymorphism         | LSP, OCP           | Новое поведение добавляется через новые реализации |
| Protected Variations | DIP, OCP           | Вероятные изменения закрыты абстракцией            |

Не нужно стремиться к нулевой связанности. Если объекты вообще никак не связаны, они не образуют систему. Цель - убрать
лишнюю связанность и оставить только осмысленные публичные контракты.

## Простые эвристики

SOLID и GRASP помогают строить гибкий дизайн. Но гибкость легко превратить в чрезмерную сложность. Поэтому нужны
ограничители.

| Подход  | Что проверить | Практический вопрос                                      |
|---------|-------------------------------------|----------------------------------------------------------|
| KISS    | Лишнюю сложность                    | Можно ли сделать проще без потери смысла?                |
| DRY     | Дублирование знания                 | Если правило изменится, сколько мест придется править?   |
| YAGNI   | Функции "на будущее"                | Это нужно сейчас или только кажется полезным?            |
| BDUF    | Полное проектирование всего заранее | Мы планируем ближайший шаг или пытаемся предсказать все? |
| Occam   | Лишние сущности                     | Эта абстракция реально объясняет задачу?                 |

KISS предлагает выбрать простое решение (*Keep It Simple, Stupid*), DRY — хранить каждое правило в одном месте (*Don't Repeat Yourself*), а YAGNI — отложить возможность до появления потребности (*You Aren't Gonna Need It*).

Интернет-магазин даёт скидку 10% при сумме заказа от 1000 рублей. В учебном правиле сумма — неотрицательное 32-битное целое в рублях, дробную часть итоговой цены отбрасываем. Так, за заказ на 1001 рубль покупатель заплатит 900. Разработчик решает заранее спроектировать выбор из нескольких стратегий.

```kotlin
interface DiscountStrategy {
    fun apply(total: Int): Int
}

class ThresholdDiscount(
    private val threshold: Int,
    private val percent: Int
) : DiscountStrategy {
    override fun apply(total: Int): Int =
        if (total >= threshold) (total.toLong() * (100 - percent) / 100).toInt() else total
}

class DiscountFactory {
    fun create(type: String): DiscountStrategy = when (type) {
        "threshold" -> ThresholdDiscount(1000, 10)
        else -> throw IllegalArgumentException("Unknown: $type")
    }
}
```

Пока магазин применяет одно правило. Фабрика каждый раз выбирает один и тот же вариант, а для подсчёта итоговой цены достаточно функции.

::: multi-code "KISS и YAGNI: простая скидка"

```kotlin
fun applyDiscount(total: Int): Int =
    if (total >= 1000) (total.toLong() * 9 / 10).toInt() else total
```

```kotlin playground
fun applyDiscount(total: Int): Int =
    if (total >= 1000) (total.toLong() * 9 / 10).toInt() else total

fun main() {
    listOf(999, 1000, 1001, 100_000_000).forEach { total ->
        println("total=$total -> after discount=${applyDiscount(total)}")
    }
}
```

```csharp
static int ApplyDiscount(int total) =>
    total >= 1000 ? (int)((long)total * 9 / 10) : total;
```

```java
static int applyDiscount(int total) {
    return total >= 1000 ? (int)((long)total * 9 / 10) : total;
}
```

```go
func ApplyDiscount(total int) int {
    if total >= 1000 {
        return int(int64(total) * 9 / 10)
    }
    return total
}
```

:::

Умножение выполняется в 64-битном типе. При заказе на 100 миллионов рублей промежуточное произведение при умножении на 90 уже вышло бы за границы 32-битного целого, хотя цена со скидкой — 90 миллионов — в него помещается.

Вторая стратегия даст повод сравнить варианты: простой выбор функции может оказаться достаточным. Если правило расчёта используется в десяти местах,
DRY подсказывает вынести его в одну функцию, чтобы изменение правила не размазывалось по проекту.

BDUF (Big Design Up Front) называют попытку подробно спроектировать всё приложение заранее. Для нашей скидки достаточно определить порог и проверить расчёт на суммах 999 и 1000 рублей.

## Чеклист класса

Мини-чеклист проектирования класса:

1. Какую задачу решает класс?
2. Кто может потребовать изменить этот класс?
3. Какие зависимости класс создает сам?
4. Можно ли заменить зависимость без правки класса?
5. Есть ли наследование, которое может нарушить LSP?
6. Не слишком ли крупный интерфейс?
7. Не добавлена ли гибкость "на всякий случай"?
8. Есть ли дублирование бизнес-правила?
9. Можно ли объяснить дизайн без рисунка на пять уровней абстракции?

```mermaid
flowchart TD
    A["Появилась идея абстракции"] --> B{"Есть реальная точка изменения"}
    B -->|" нет "| C["Оставить простой код"]
    B -->|" да "| D{"Абстракция снижает связанность"}
    D -->|" нет "| C
    D -->|" да "| E{"Цена понимания приемлема"}
    E -->|" нет "| F["Искать более простой дизайн"]
    E -->|" да "| G["Ввести интерфейс или выделить класс"]
```

## Переход к следующей лекции

Вы уже видели, что `BookService` зависит от `Printer`, а не от `ConsolePrinter`. Но кто создаст нужную реализацию? Если
`BookService` сам напишет `ConsolePrinter()` — мы вернулись к проблеме из начала лекции: бизнес-класс снова знает о
деталях инфраструктуры, и подменить зависимость для теста не получится без правки самого класса.

`BookService` задаёт нужную ему операцию через `Printer`. Это пример DIP. Передача принтера в конструктор — внедрение зависимости (DI). Можно так же передать конкретный `ConsolePrinter`, и тогда сервис останется привязан к консольному выводу. Где выбирать реализацию и собирать объекты вместе, разбирает [лекция 2](/lectures/02#проблема).

## Резюме

- Парадигмы дают не только возможности, но и ограничения.
- В ООП для дизайна важнее не классы сами по себе, а отношения между ними.
- Наследование применять можно, но осторожно: нужна строгая связь `is-a` и соблюдение LSP.
- Ассоциация связывает объекты. Для композиции существенно владение текущими частями, для агрегации смысл объединения поясняют в модели.
- Интерфейс описывает способность или контракт, а не родство.
- SOLID и GRASP помогают удерживать код изменяемым.
- KISS, DRY и YAGNI помогают оценить цену лишней сложности. BDUF обозначает подход к проектированию, который стоит проверять на преждевременную детализацию.
- Хороший дизайн находится между отсутствием абстракций и overengineering.

## Дополнительное чтение

Эти материалы помогут повторить базовые понятия ООП, принципы дизайна и связь простоты с архитектурными решениями.

### ООП и архитектурный контекст

- [Вспомнить ООП](https://habr.com/ru/articles/463125/) — вводное повторение основных идей объектно-ориентированного программирования.
- [Чистая архитектура: краткий пересказ](https://habr.com/ru/articles/443058/) — обзор тезисов книги для первого знакомства.

### Принципы дизайна

- [Лисков и Уинг о поведенческих подтипах](https://www.cs.cmu.edu/afs/cs/project/calder/www/fmdp.html) — какие свойства должны сохраняться при подстановке.
- [Мартин Фаулер о YAGNI](https://martinfowler.com/bliki/Yagni.html) — сколько стоит заранее добавленная возможность.
- [Принципы SOLID](https://medium.com/webbdev/solid-4ffc018077da) — краткое изложение пяти принципов проектирования.
- [Бритва Оккама, KISS, YAGNI, BDUF](https://habr.com/ru/articles/925208/) — разбор эвристик, которые ограничивают лишнюю сложность.

## Вопросы для самопроверки

1. Почему наследование создает более жесткую связь, чем ассоциация?
2. Чем композиция отличается от агрегации?
3. Когда интерфейс лучше абстрактного класса?
4. Почему квадрат-наследник прямоугольника может нарушить LSP?
5. Что значит "одна причина для изменения" в SRP?
6. Как ISP связан с `NotImplementedException`?
7. Почему DIP важен для тестирования?
8. Как DIP помогает OCP?
9. Какие обязанности связаны внутри класса (cohesion) и какие детали соседнего класса ему приходится знать (coupling)? Разберите пример `OrderNotifier`.
10. Как понять, что абстракция появилась преждевременно?
11. Чем DRY опасен, если применять его слишком рано?
12. Как YAGNI ограничивает overengineering?

## Мини-практика

Представьте сервис уведомлений:

- он отправляет email, SMS и голосовые сообщения;
- email имеет тему и текст;
- SMS имеет только текст;
- клиентам из списка исключений ничего не отправляем;
- голосовое сообщение имеет ссылку на аудиофайл;
- бизнес-логика хочет отправить уведомление, но не должна знать детали каждого канала.

Задание:

1. Выделите маленькие интерфейсы вместо одного большого `NotificationMessage`.
2. Отделите бизнес-логику отправки от конкретных каналов.
3. Объясните, где в решении применены SRP, ISP и DIP.
4. Проверьте, не добавили ли вы абстракции, которые пока не нужны.

Если после решения у вас появился класс, который одновременно выбирает канал, форматирует сообщение, отправляет его и
пишет лог, вернитесь к SRP. Если появился интерфейс с методами `sendEmail`, `sendSms`, `sendVoice`, вернитесь к ISP.
Если бизнес-правило создает `SmtpClient` напрямую, вернитесь к DIP.

Проверьте решение на двух случаях. Для клиента только с номером телефона тестовый отправитель должен получить одно SMS без темы. Для клиента из списка исключений он должен получить ноль сообщений. Измените тему письма и повторите обе проверки. Какие компоненты пришлось тронуть?
