# Лекция 9. Виртуализация и эволюция баз данных

Эта лекция связывает две большие темы: как приложения запускают и как они хранят состояние. После архитектурных
паттернов из предыдущей лекции нам нужно понять, почему современная разработка почти неизбежно приходит к контейнерам,
Docker, Kubernetes, облакам и отдельным хранилищам для разных типов нагрузки. А перед лекциями про межсервисное
взаимодействие важно увидеть, что сервисы не существуют в вакууме: они запускаются на инфраструктуре и меняют данные,
которые надо сохранить надежно.

Материал написан как самостоятельная статья. Если вы пропустили лекцию, начните отсюда: после чтения вы должны понимать,
чем виртуальная машина отличается от контейнера, зачем нужен Docker, где заканчивается Docker Compose и начинается
Kubernetes, почему базу данных масштабировать сложнее, чем stateless-сервис, и почему в реальном проекте одного слова
"PostgreSQL" часто недостаточно для описания всей стратегии хранения данных.

::: tip Главная идея лекции
Инфраструктура и базы данных развивались так, чтобы прикладной разработчик управлял все более крупными абстракциями.
Сначала мы управляли серверами, потом виртуальными машинами, потом контейнерами, потом желаемым состоянием сервисов.
С базами данных похожая история: приложение хочет просто надежно сохранить состояние, а сложность репликации,
шардирования, кэша и отказоустойчивости должна быть спрятана за понятным контрактом.
:::

::: tip Как работать с примерами
Примеры кода показывают не Docker SDK и не реальные драйверы баз данных, а прикладные решения вокруг инфраструктуры:
конфигурацию через окружение, выбор шарда, транзакционную границу и cache-aside. Kotlin-вкладки там, где код можно
запустить, имеют отдельную Playground-версию с `main` и демонстрационным выводом.
:::

## Сквозной сценарий

Возьмем сервис заказов из архитектурного блока. В коде он уже разделен на use cases, домен и адаптеры, но этого мало:
сервис нужно одинаково запускать у разработчика, в CI, в staging и production. Потом сервис начинает расти: нужен
PostgreSQL, read replica, кэш, отдельная аналитика, возможно шардирование. Так появляется связка двух тем лекции:
runtime-изоляция и стратегия хранения состояния.

```mermaid
flowchart LR
    Code["Архитектурно разделенный сервис"] --> Image["Container image"]
    Image --> Runtime["Container runtime / Kubernetes"]
    Runtime --> Config["Environment config"]
    Runtime --> Database["Primary database"]
    Database --> Replica["Read replicas"]
    Database --> Cache["Cache"]
    Database --> Analytics["OLAP / analytics"]
```

Контейнеры решают вопрос "как воспроизводимо запустить процесс". Базы данных решают другой вопрос: "как сохранить и
прочитать состояние при росте нагрузки и сбоях". Эти вопросы связаны, но их нельзя смешивать: stateless-сервис обычно
масштабируется проще, чем данные, потому что состояние нельзя просто скопировать без правил согласованности.

## Worked example: "у меня запускается" не равно reproducible runtime

### Ситуация

Сервис заказов успешно работает на ноутбуке разработчика. В staging он падает: другая версия JDK/.NET/runtime, не та
переменная окружения, локальный файл конфигурации не попал в деплой, база доступна по другому адресу.

### Наивное решение

Записать в README длинный список ручных шагов: установить runtime, скачать драйвер, создать файл, выставить переменные,
запустить миграции. Если у кого-то не работает, сравнивать окружение вручную.

### Что ломается

Окружение становится скрытой частью приложения. CI, staging и production расходятся. Ошибка выглядит как "код сломан",
хотя реально сломан runtime contract. Масштабирование процесса не решает состояние: база, кэш и аналитика все равно
требуют отдельных правил.

### Улучшение

Упаковать runtime в image, вынести конфигурацию в environment, а состояние держать во внешних хранилищах с понятной
стратегией: primary DB, replicas, cache, analytics. Контейнер делает процесс воспроизводимым, но не отменяет дизайн
данных.

### Почему это работает

Разделение stateless runtime и stateful storage объясняет всю лекцию. Сервис можно пересоздать из image, а данные нельзя
просто "перезапустить" без учета транзакций, репликации, backup, consistency и recovery.

## Цели

После этой статьи вы должны уметь:

- объяснять, зачем появилась виртуализация и почему дата-центры не масштабировались простым добавлением серверов;
- отличать гипервизор Type 1, гипервизор Type 2, контейнеризацию и облачные сервисы;
- объяснять роли Docker image, container, registry, Dockerfile, volume, port mapping и environment variables;
- понимать, зачем нужны Docker Compose и Kubernetes, и почему они решают разные классы задач;
- объяснять различие OLTP и OLAP-нагрузки;
- различать репликацию, партицирование, шардирование и кэширование;
- понимать, когда уместны PostgreSQL, Redis или другая in-memory система, NoSQL, distributed SQL и SQLite;
- видеть связь между микросервисом, его базой данных и транзакционной границей.

## Карта эволюции

Виртуализация обычно выглядит как набор технологий, но полезнее смотреть на нее как на историю повышения уровня
абстракции. На каждом шаге инженеры старались управлять не деталями железа, а более крупной единицей.

```mermaid
flowchart LR
    Physical["Физический сервер"] --> VM["Виртуальная машина"]
    VM --> Container["Контейнер"]
    Container --> Orchestrator["Оркестратор"]
    Orchestrator --> Cloud["Облако"]
    Cloud --> Managed["Managed services"]
```

Этапы можно читать как лестницу абстракций:

- физический сервер - управляем железом, стойкой, сетью и дисками почти напрямую;
- виртуальная машина - управляем guest OS и выделенными ресурсами, а реальный сервер скрыт гипервизором;
- контейнер - управляем процессом и его окружением, а установка runtime и библиотек упакована в образ;
- Kubernetes - управляем желаемым состоянием сервиса, а размещение pod-ов, рестарт и service discovery берет на себя
  кластер;
- облако - покупаем готовую инфраструктурную способность, не закупая железо самостоятельно;
- managed service - покупаем готовый сервис, например managed PostgreSQL, где установка, обновления, бэкапы и часть
  failover находятся на стороне провайдера.

Такой же ход мысли будет во второй половине лекции про базы данных. Сначала приложение обращается к одному серверу БД.
Потом появляются read replica, кэш, шардирование, аналитические хранилища, embedded DB и distributed SQL. Цель та же:
оставить прикладному коду понятный контракт и спрятать низкоуровневую сложность там, где ей место.

## До виртуализации

Представим дата-центр без виртуализации. Под новый сервис покупают новый сервер. Если сервис нагружает CPU на 10%, то
оставшиеся ресурсы простаивают. Если сервис вырос, его надо переносить, покупать новое железо, настраивать сеть, бэкапы,
мониторинг и восстановление. Если стартап закрылся или продукт больше не нужен, железо остается физическим активом,
который уже куплен.

```mermaid
flowchart TD
    Need["Новый сервис"] --> Buy["Купить сервер"]
    Buy --> Rack["Поставить в стойку"]
    Rack --> Network["Подключить сеть"]
    Network --> Backup["Настроить бэкапы"]
    Backup --> Ops["Обслуживать и обновлять"]
    Ops --> Idle["Часть ресурсов простаивает"]
```

Боли такого подхода хорошо видны в эксплуатации:

- сервер покупается под конкретную задачу и часто недогружен, поэтому хочется делить один мощный сервер между несколькими
  изолированными средами;
- сеть, диски, бэкапы и обновления настраиваются вручную, поэтому хочется стандартизировать создание окружений и
  восстановление после сбоя;
- CapEx требует больших капитальных затрат до запуска продукта, поэтому бизнесу часто удобнее OpEx: платить за
  используемую мощность;
- новое окружение поднимается долго, поэтому хочется получать его за минуты, а не за недели закупки;
- отказ физического сервера может остановить сервис, поэтому нужны перенос нагрузки и резервные копии.

Виртуализация появилась не потому, что инженерам захотелось добавить слой сложности. Она была экономическим и
эксплуатационным ответом на плохую утилизацию ресурсов и дорогую ручную работу.

## Виртуальные машины

Обычный компьютер без виртуализации выглядит просто: есть физическое железо, на нем операционная система, а уже поверх
нее прикладные программы.

```mermaid
flowchart TD
    Hardware["Физическое железо"] --> OS["Операционная система"]
    OS --> App["Приложение"]
```

Виртуальная машина добавляет иллюзию отдельного компьютера. Внутри VM есть guest OS: полноценная операционная система со
своими процессами, настройками, библиотеками и приложениями. Снаружи VM управляется гипервизором - слоем, который
распределяет CPU, память, диски и сеть между виртуальными машинами.

### Type 2

Гипервизор Type 2 работает поверх обычной host OS. Это привычный сценарий локальной разработки: на ноутбуке стоит
Windows, macOS или Linux, а внутри VirtualBox, VMware Workstation или похожего инструмента запускается другая ОС.

```mermaid
flowchart TD
    Hardware["Hardware"] --> Host["Host OS"]
    Host --> Hypervisor["Type 2 hypervisor"]
    Hypervisor --> Guest1["Guest OS + App"]
    Hypervisor --> Guest2["Guest OS + App"]
```

Type 2 удобен, когда нужно попробовать другую ОС, поднять лабораторное окружение или воспроизвести старую систему. Но он
платит накладными расходами: host OS сама потребляет ресурсы, а VM получает доступ к железу через дополнительный слой.

### Type 1

Гипервизор Type 1 устанавливается ближе к железу. Его задача - быть минимальной платформой для запуска множества VM.
Именно такой подход типичен для серверной виртуализации.

```mermaid
flowchart TD
    Hardware["Hardware"] --> Hypervisor["Type 1 hypervisor"]
    Hypervisor --> VM1["VM: OS + App"]
    Hypervisor --> VM2["VM: OS + App"]
    Hypervisor --> VM3["VM: OS + App"]
```

| Подход | Где применяют | Плюсы | Минусы |
|---|---|---|---|
| Type 2 | Разработка, локальные эксперименты, обучение | Доступность, простота, можно поставить на обычный ПК | Накладные расходы host OS, низкая плотность VM |
| Type 1 | Серверная виртуализация, частные облака, дата-центры | Высокая плотность, миграции VM, централизованное администрирование | Сложность эксплуатации, нужны компетенции администрирования |

::: warning VM и контейнер - разные абстракции
Виртуальная машина изолирует целую guest OS. Контейнер изолирует процесс и его окружение поверх общего ядра host OS.
Контейнер удобно называть "легковесным", но не стоит считать его просто маленькой виртуальной машиной.
:::

## Контейнеризация

Если VM запускает отдельную операционную систему, контейнер идет другим путем. Он не приносит свое ядро ОС. Контейнер
упаковывает приложение, runtime, библиотеки и настройки, а системные вызовы идут в ядро host OS.

В упрощенной модели Linux можно разделить на две зоны:

- **Kernel Space** - ядро, драйверы, системные вызовы, управление процессами, сетью и памятью;
- **User Space** - программы, библиотеки, runtime и пользовательские настройки.

Контейнеризация изолирует user space для процесса. Поэтому контейнер обычно стартует быстрее VM: ему не нужно запускать
полную guest OS.

```mermaid
flowchart LR
    subgraph VM["Виртуальная машина"]
        HW1["Hardware"] --> HV["Hypervisor"]
        HV --> GOS["Guest OS"]
        GOS --> VApp["App + libs"]
    end

    subgraph C["Контейнер"]
        HW2["Hardware"] --> HOS["Host OS kernel"]
        HOS --> Runtime["Container runtime"]
        Runtime --> CApp["App + libs"]
    end
```

Ключевая разница:

- VM изолирует полную ОС, а контейнер - процесс и user space;
- у каждой VM свое guest kernel, а контейнеры используют общее ядро host OS;
- VM обычно стартует медленнее, потому что запускает ОС, а контейнер стартует быстрее как процесс;
- VM часто весит гигабайты, контейнер обычно меньше, потому что хранит только нужные слои;
- VM лучше подходит для разных ОС и legacy-систем, контейнер - для упаковки и доставки приложений.

::: warning Частые ошибки про контейнеры
- Контейнер не заменяет VM во всех задачах: если нужна другая ОС или сильная граница изоляции, VM может быть уместнее.
- Контейнер не хранит данные надежно сам по себе: для PostgreSQL, файлов и очередей нужны volume или внешнее хранилище.
- Образ и контейнер не одно и то же: образ - шаблон, контейнер - запущенный экземпляр образа.
:::

## Docker

Docker стал популярным не потому, что контейнеры появились только с ним. Контейнерные механизмы существовали раньше, но
Docker дал удобную упаковку, переносимость и единый пользовательский опыт: собрать образ, загрузить его в registry,
скачать на другой машине и запустить одинаковым способом.

```mermaid
flowchart LR
    Dockerfile["Dockerfile"] --> Image["Image"]
    Image --> Registry["Registry"]
    Registry --> Pull["docker pull"]
    Pull --> Container["Container"]
```

Минимальный словарь Docker:

- `Docker host` - машина или VM, где установлен Docker;
- `Docker daemon` - фоновый процесс, который создает образы, запускает контейнеры, управляет сетью и volume;
- `Docker client` - CLI или UI, через который пользователь отправляет команды daemon-у;
- `image` - неизменяемый шаблон запуска: приложение, runtime, библиотеки и слои файловой системы;
- `container` - запущенный экземпляр image с собственным процессом, сетью и writable layer;
- `registry` - публичное, приватное или локальное хранилище образов;
- `Dockerfile` - инструкция сборки image;
- `volume` - постоянное хранилище данных за пределами жизненного цикла контейнера;
- `port mapping` - проброс порта контейнера наружу, например `5432:5432`;
- `environment variables` - конфигурация контейнера без пересборки image.

Аналогия "image - это класс, container - это объект" полезна на первом шаге: из одного image можно запустить несколько
container-ов. Но аналогия не полная. Класс существует в языке программирования, а image - это набор слоев файловой
системы и метаданных запуска. Контейнер - не просто объект в памяти, а процесс с сетевым и файловым окружением.

Минимальный запуск PostgreSQL в контейнере:

```sh
docker run --name kpo-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:latest
```

Эта команда говорит: запусти контейнер с именем `kpo-postgres`, передай пароль через переменную окружения, пробрось порт
`5432` из контейнера на порт `5432` host-машины и используй образ `postgres:latest`.

Для повторяемого локального окружения удобнее описывать набор сервисов декларативно:

```yaml
services:
  postgres:
    image: postgres:latest
    environment:
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

::: only go
Go компилируется в статический бинарник без runtime. Это даёт минимальные Docker-образы:

| Подход | Примерный размер |
|---|---|
| Go `FROM scratch` | ~10 MB |
| JVM (Kotlin/Java) | ~200 MB |
| .NET (C#) | ~100 MB |

`FROM scratch` означает пустой базовый образ — только ваш бинарник. Быстрый pull, меньше поверхность атаки,
моментальный cold start.
:::

Docker Compose хорошо подходит для локальной разработки, учебных стендов и тестового окружения из нескольких
контейнеров. Он не является полноценным кластерным оркестратором: Compose не решает production-задачи уровня
самовосстановления кластера, service discovery между узлами, rolling update и автоматического размещения pod-ов на
нескольких worker node.

## Конфигурация через окружение

Контейнерный образ должен быть переносимым. Если в коде зашить адрес `localhost:5432`, пользователь, тестовый стенд и
production быстро разъедутся. Поэтому приложение обычно читает строку подключения из конфигурации: environment variables,
секретов Kubernetes, `.env` в локальной разработке или managed secret storage в облаке.

::: only kotlin
В Kotlin/JVM это может быть прямое чтение `System.getenv`, конфигурационный объект фреймворка или DI-модуль, который
создает адаптер базы данных. Важно, чтобы доменная модель не читала environment variables сама.
:::

::: only csharp
В .NET конфигурацию обычно собирает `IConfiguration`: environment variables, appsettings, secrets и параметры запуска.
Сервис приложения должен получать уже готовый options-объект или зависимость, а не искать переменные окружения внутри
бизнес-метода.
:::

::: only java
В Spring Boot значения часто приходят через `application.yml`, environment variables и `@ConfigurationProperties`.
Риск тот же: удобно связать infrastructure-конфигурацию с bean-ами, но не стоит протаскивать ее в entity и value object.
:::

::: only go
В Go конфигурацию часто читают в `main`, валидируют и передают в функции-конструкторы. Это хорошо сочетается с manual
wiring: ошибки конфигурации обнаруживаются при старте, а бизнес-пакеты остаются независимыми от окружения.
:::

::: multi-code "Конфигурация подключения" {default=kotlin}

```kotlin
class ProductRepository(private val connectionString: String)

fun createRepository(env: Map<String, String>): ProductRepository {
    val connection = env["DATABASE_URL"]
        ?: error("DATABASE_URL is required")
    return ProductRepository(connection)
}
```

```kotlin playground
class ProductRepository(private val connectionString: String) {
    fun describe(): String = "Repository uses $connectionString"
}

fun createRepository(env: Map<String, String>): ProductRepository {
    val connection = env["DATABASE_URL"]
        ?: error("DATABASE_URL is required")
    return ProductRepository(connection)
}

fun main() {
    val env = mapOf(
        "DATABASE_URL" to "postgres://app:secret@postgres:5432/orders"
    )

    val repository = createRepository(env)
    println(repository.describe())

    val missing = runCatching { createRepository(emptyMap()) }
    println("Missing config accepted: ${missing.isSuccess}")
    println("Error: ${missing.exceptionOrNull()?.message}")
}
```

```csharp
public sealed class ProductRepository
{
    public ProductRepository(string connectionString)
    {
        ConnectionString = connectionString;
    }

    public string ConnectionString { get; }
}

public static ProductRepository CreateRepository(
    IReadOnlyDictionary<string, string> env)
{
    if (!env.TryGetValue("DATABASE_URL", out var connection))
        throw new InvalidOperationException("DATABASE_URL is required");

    return new ProductRepository(connection);
}
```

```java
import java.util.Map;

final class ProductRepository {
    private final String connectionString;

    ProductRepository(String connectionString) {
        this.connectionString = connectionString;
    }
}

static ProductRepository createRepository(Map<String, String> env) {
    var connection = env.get("DATABASE_URL");
    if (connection == null) {
        throw new IllegalStateException("DATABASE_URL is required");
    }
    return new ProductRepository(connection);
}
```

```go
package main

import "fmt"

type ProductRepository struct {
    ConnectionString string
}

func CreateRepository(env map[string]string) (ProductRepository, error) {
    connection, ok := env["DATABASE_URL"]
    if !ok {
        return ProductRepository{}, fmt.Errorf("DATABASE_URL is required")
    }
    return ProductRepository{ConnectionString: connection}, nil
}
```

:::

В контейнерной среде такой код не меняется между локальным запуском и production. Меняется только источник значения:
Compose подставит его из `environment`, Kubernetes - из `ConfigMap` или `Secret`, облако - из своего механизма секретов.

## Монолит и микросервисы

Монолит не является ошибкой. Небольшая команда, простой домен и умеренная нагрузка часто выигрывают от монолита:
меньше сетевых вызовов, проще транзакции, проще локальная разработка. Проблема появляется, когда разные части системы
живут с разной скоростью: каталог читают часто, платежи требуют надежности, рекомендации требуют экспериментов, а личный
кабинет меняется отдельной командой.

```mermaid
flowchart LR
    Client["Client"] --> Gateway["API Gateway"]
    Gateway --> Catalog["Catalog service"]
    Gateway --> Orders["Orders service"]
    Gateway --> Payments["Payments service"]
    Catalog --> CatalogDb[("Catalog DB")]
    Orders --> OrdersDb[("Orders DB")]
    Payments --> PaymentsDb[("Payments DB")]
```

Что дают микросервисы и чем за это платят:

- локальность изменений: команда меняет свой сервис без полной пересборки системы, но нужны стабильные API-контракты;
- масштабирование: можно масштабировать только горячий сервис, но появляются сеть, балансировка и service discovery;
- технологический выбор: для разных задач можно выбрать разные хранилища и runtime, но возникает технологический зоопарк;
- владение данными: у сервиса своя база и понятная граница ответственности, но сложнее транзакции между сервисами;
- независимая поставка: сервис можно выкатывать отдельно, но нужны observability, CI/CD, безопасность и откаты.

Микросервисы почти всегда приводят к контейнерам. Если сервисов много, их надо запускать одинаково, быстро заменять,
масштабировать, рестартовать и подключать к сети. На малом масштабе Docker Compose может быть достаточным. На кластере
для production обычно нужен оркестратор.

## Kubernetes

Kubernetes - это не "Docker посложнее". Это платформа оркестрации контейнеризированных приложений. Ее главный смысл:
пользователь описывает желаемое состояние, а control plane пытается привести кластер к этому состоянию.

```mermaid
flowchart TD
    Cluster["Kubernetes cluster"] --> Control["Control plane"]
    Control --> Api["API server"]
    Control --> Scheduler["Scheduler"]
    Control --> Controllers["Controllers"]
    Control --> Etcd[("etcd")]
    Cluster --> NodeA["Worker node A"]
    Cluster --> NodeB["Worker node B"]
    NodeA --> PodA["Pod"]
    NodeB --> PodB["Pod"]
    PodA --> ContainerA["Container"]
    PodB --> ContainerB["Container"]
    Service["Service"] --> PodA
    Service --> PodB
    Ingress["Ingress"] --> Service
```

Минимальный словарь Kubernetes:

- `cluster` - набор машин, которыми управляет Kubernetes;
- `control plane` - управляющая часть кластера: API server, scheduler, controllers и `etcd`;
- `node` - рабочая машина, где реально запускаются pod-ы;
- `pod` - минимальная единица запуска в Kubernetes, обычно содержащая один контейнер приложения;
- `container` - процесс приложения внутри pod-а;
- `service` - стабильная сетевая точка доступа к группе pod-ов;
- `ingress` - правила входящего HTTP/HTTPS-трафика в кластер;
- `replica` - один экземпляр pod-а в наборе одинаковых экземпляров;
- `self-healing` - восстановление желаемого состояния, например создание нового pod-а вместо упавшего;
- `scaling` - изменение числа replica или ресурсов, выделенных экземпляру.

Важно различать типы масштабирования:

- **горизонтальное масштабирование** - создать несколько экземпляров сервиса, например три pod-а вместо одного;
- **вертикальное масштабирование** - дать одному экземпляру больше CPU или памяти.

| Вопрос | Docker Compose | Kubernetes |
|---|---|---|
| Где удобен | Локально, учебный стенд, маленький набор сервисов | Кластер, production, high availability |
| Масштабирование | Ограниченное, вручную или скриптами | Декларативное, через controllers и autoscaling |
| Самовосстановление | Минимальное | Встроенная модель desired state |
| Сеть | Простая локальная сеть проекта | Service discovery, ingress, сетевые политики |
| Сложность | Ниже | Выше |

::: warning Kubernetes не отменяет архитектуру
Kubernetes может перезапустить pod, но не исправит плохую транзакционную модель, не сделает несовместимые API
совместимыми и не решит проблему потерянных данных. Оркестратор управляет запуском процессов, а не смыслом бизнес-операций.
:::

## Облака

Облако можно воспринимать как следующий шаг абстракции. Команда перестает думать о закупке железа и начинает покупать
инфраструктурные возможности: VM, сеть, диски, managed Kubernetes, managed PostgreSQL, очереди, объектное хранилище,
функции.

Основные модели облачных сервисов:

- **IaaS** - виртуальные машины, сеть и диски; команда сама ставит ОС, Docker и приложение;
- **PaaS** - платформа для запуска приложения или БД, например managed Kubernetes, managed PostgreSQL или платформенный
  runtime;
- **SaaS** - готовое приложение: почта, CRM, issue tracker, аналитический сервис;
- **Serverless/FaaS** - запуск функции или задачи без управления сервером: обработать событие, сгенерировать превью,
  выполнить cron-задачу.

Примеры облачных провайдеров: AWS, Microsoft Azure, Google Cloud, Yandex Cloud, Selectel, VK Cloud, Cloud.ru, MTS Cloud.
Это именно примеры, а не рейтинг. Для выбора провайдера важнее конкретные требования: регион, стоимость, compliance,
доступные managed services, SLA, поддержка и опыт команды.

## Переход к базам данных

Мы разобрали, как *запускать* сервисы: контейнеры, оркестрация, облака. Теперь — как они *хранят состояние*. Это другая
задача: stateless-процесс можно пересоздать из образа, а данные — нет.

Контейнеры и Kubernetes отвечают на вопрос: где и как запустить процесс. База данных отвечает на другой вопрос: где живет
состояние. Stateless-сервис можно быстро размножить: поднять еще несколько pod-ов и распределить между ними запросы.
Состояние так просто не копируется, потому что у данных есть актуальность, транзакции, конфликты записи, индексы,
репликация и восстановление после сбоя.

```mermaid
flowchart LR
    Client["Clients"] --> LB["Load balancer"]
    LB --> S1["Service replica 1"]
    LB --> S2["Service replica 2"]
    LB --> S3["Service replica 3"]
    S1 --> DB[("Shared persistent state")]
    S2 --> DB
    S3 --> DB
```

Если сервис упал, Kubernetes может поднять новый. Если потерялись данные, "поднять новый pod" уже недостаточно. Поэтому
базы данных развиваются своим путем: транзакции, репликация, шардирование, кэш, специализированные модели и managed
сервисы.

## Что должна делать база данных

Для прикладного разработчика база данных должна быть скучной в хорошем смысле. Приложение отправляет данные, база их
сохраняет, переживает сбои и возвращает предсказуемый результат. Внутри это сложная инженерная система, но бизнес-код не
должен каждый день думать о страницах памяти, WAL, протоколе репликации и планировщике запросов.

Минимальный набор ожиданий:

- хранить данные между перезапусками приложения;
- переживать сбои процесса, машины или сети в рамках выбранных гарантий;
- обслуживать конкурентные чтения и записи;
- сохранять инварианты, например уникальность заказа или остаток товара не ниже нуля;
- давать транзакции;
- обеспечивать понятную модель чтения и записи;
- давать инструменты бэкапа, восстановления и наблюдения.

Классическая транзакционная база часто описывается через ACID:

- **Atomicity** - операция применяется целиком или не применяется вовсе;
- **Consistency** - после транзакции данные остаются в допустимом состоянии;
- **Isolation** - параллельные транзакции не должны ломать друг другу инварианты;
- **Durability** - после commit результат должен пережить сбой в рамках гарантий БД.

Эти свойства не бесплатны. Чем больше гарантий, тем больше координации, блокировок, журналирования и сетевых протоколов в
распределенном случае.

## OLTP и OLAP

Одна из первых развилок - тип нагрузки. Интернет-магазин, который оформляет заказ, и аналитический отчет по продажам за
три года работают с данными принципиально по-разному.

| Критерий | OLTP | OLAP |
|---|---|---|
| Пример | Оформить заказ, списать остаток, изменить адрес доставки | Построить отчет продаж за год, найти тренды, сравнить регионы |
| Данные | Актуальные операционные данные | Исторические, агрегированные или специально подготовленные данные |
| Запросы | Короткие, точечные, много параллельных пользователей | Тяжелые аналитические запросы, меньше пользователей |
| Главный риск | Продать отсутствующий товар или потерять платеж | Медленный отчет или устаревшая аналитика |
| Типичный выбор | PostgreSQL, MySQL, SQL Server и другие транзакционные СУБД | Columnar DB, data warehouse, analytical replicas, lakehouse |

```mermaid
flowchart LR
    User["Пользователь"] --> App["E-commerce services"]
    App --> OLTP[("OLTP database")]
    OLTP --> Replication["Replication / ETL"]
    Replication --> OLAP[("Analytics storage")]
    Analyst["Аналитик"] --> OLAP
```

OLTP требует актуальности и хорошей работы с конкурентными изменениями. OLAP часто допускает задержку обновления, но
должен быстро читать большие объемы данных. Поэтому один и тот же продукт может использовать транзакционную БД для
операций и отдельное аналитическое хранилище для отчетов.

## Репликация, партицирование и шардирование

Ваша primary БД обрабатывает 10 тыс. read/сек. Аналитический дашборд добавляет ещё 5 тыс. Reads конкурируют с writes за
CPU. Решение — раздать чтение по репликам. Но если данных становится слишком много для одного диска? Нужно шардирование.
Когда одной базы начинает не хватать, важно не смешивать разные техники масштабирования.

Термины:

- **репликация** создает копии данных на других узлах для отказоустойчивости и разгрузки чтения;
- **read replica** принимает запросы на чтение, пока primary принимает запись;
- **вертикальное партицирование** делит данные по колонкам или таблицам, чтобы разнести редко и часто используемые части;
- **горизонтальное партицирование** делит строки одной логической таблицы на части;
- **шардирование** размещает части данных на разных узлах и помогает масштабировать объем и нагрузку;
- **router** или **balancer** решает, на какой shard отправить запрос.

```mermaid
flowchart LR
    App["Application"] --> Router["DB router"]
    Router --> ShardA[("Shard A primary")]
    Router --> ShardB[("Shard B primary")]
    Router --> ShardC[("Shard C primary")]
    ShardA --> ReplicaA[("Replica A")]
    ShardB --> ReplicaB[("Replica B")]
    ShardC --> ReplicaC[("Replica C")]
```

::: warning Цена шардирования
Шардирование усложняет `join`, распределенные транзакции, миграции данных, бэкапы, rebalancing и расследование
инцидентов. Если проект можно надежно вести на одной PostgreSQL с индексами, репликами и нормальным мониторингом, это
часто лучше преждевременного распределения данных.
:::

## Shard routing

Учебная модель выбора шарда обычно выглядит как функция от идентификатора. В реальном проекте этого мало: нужны
стабильный hash, consistent hashing или таблица размещения, rebalancing, миграции, backfill и стратегия отказа. Но
простая функция помогает понять идею: приложение или router должны одинаково решать, где лежит конкретный агрегат.

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

    for (customerId in listOf(101L, 102L, 103L, 104L, 205L)) {
        val shard = router.route(customerId)
        println("customer=$customerId -> ${shard.name} (${shard.endpoint})")
    }
}
```

```csharp
public sealed record Shard(string Name, string Endpoint);

public sealed class ShardRouter
{
    private readonly IReadOnlyList<Shard> _shards;

    public ShardRouter(IReadOnlyList<Shard> shards)
    {
        _shards = shards;
    }

    public Shard Route(long customerId)
    {
        var index = Math.Abs(customerId.GetHashCode()) % _shards.Count;
        return _shards[index];
    }
}
```

```java
import java.util.List;

record Shard(String name, String endpoint) {
}

final class ShardRouter {
    private final List<Shard> shards;

    ShardRouter(List<Shard> shards) {
        this.shards = shards;
    }

    Shard route(long customerId) {
        var index = Math.floorMod(Long.hashCode(customerId), shards.size());
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

## Unit of Work

База данных связана не только с инфраструктурой, но и с архитектурой приложения. Если бизнес-операция меняет несколько
объектов, ее нужно сохранить как единое целое. Например, оформление заказа создает заказ и уменьшает остаток товара. Если
заказ создан, а остаток не изменился, система уже находится в противоречивом состоянии.

Unit of Work ведет границу бизнес-транзакции: собирает изменения нескольких репозиториев и фиксирует их одним commit.

```mermaid
flowchart TD
    Service["Бизнес-операция"] --> Uow["Unit of Work"]
    Uow --> Orders["OrderRepository"]
    Uow --> Inventory["InventoryRepository"]
    Uow --> Commit["Commit одной транзакцией"]
    Commit --> DB[("Database")]
```

В микросервисной архитектуре важное практическое правило: транзакционная граница обычно находится внутри одного сервиса
и его базы данных. Как только операция проходит через несколько сервисов, обычная локальная транзакция перестает быть
достаточной, и появляются саги, outbox, idempotency и eventual consistency. Эти темы относятся к следующим лекциям про
межсервисное взаимодействие.

::: multi-code "Unit of Work вокруг бизнес-операции" {default=kotlin}

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
        println("create order: $productId x $quantity")
        return "order-1"
    }
}

class InventoryRepository {
    private val stock = mutableMapOf("book" to 3)

    fun reserve(productId: String, quantity: Int) {
        val available = stock.getValue(productId)
        require(available >= quantity) { "not enough stock" }
        stock[productId] = available - quantity
        println("reserve inventory: $productId x $quantity")
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

    println("Result: ${service.placeOrder("book", 2)}")
    runCatching { service.placeOrder("book", 5) }
}
```

```csharp
public interface IUnitOfWork
{
    T ExecuteInTransaction<T>(Func<T> block);
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
        _unitOfWork.ExecuteInTransaction(() =>
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

    OrderService(
        UnitOfWork unitOfWork,
        OrderRepository orders,
        InventoryRepository inventory
    ) {
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
    Transaction(func() (string, error)) (string, error)
}

type OrderRepository interface {
    Create(productID string, quantity int) (string, error)
}

type InventoryRepository interface {
    Reserve(productID string, quantity int) error
}

type OrderService struct {
    UnitOfWork UnitOfWork
    Orders     OrderRepository
    Inventory  InventoryRepository
}

func (s OrderService) PlaceOrder(productID string, quantity int) (string, error) {
    return s.UnitOfWork.Transaction(func() (string, error) {
        if err := s.Inventory.Reserve(productID, quantity); err != nil {
            return "", err
        }
        return s.Orders.Create(productID, quantity)
    })
}
```

:::

## Кэш и in-memory базы

Кэш появляется там, где чтение из основной БД слишком дорого или слишком часто повторяется. Самая распространенная
прикладная схема - cache-aside:

1. Приложение ищет значение в кэше.
2. Если значение найдено, возвращает его.
3. Если значения нет, читает основную БД.
4. Кладет результат в кэш.
5. Следующие запросы читают из кэша.

```mermaid
flowchart LR
    App["Application"] --> Cache{"Cache"}
    Cache -->|"hit"| App
    Cache -->|"miss"| DB[("Database")]
    DB --> App
    App -->|"put with TTL"| Cache
```

Минимальный словарь кэша:

- `cache hit` - данные найдены в кэше;
- `cache miss` - данных нет, нужно идти в основную БД;
- `TTL` - время жизни записи в кэше;
- инвалидирование - удаление или обновление устаревшей записи;
- прогрев кэша - постепенное наполнение кэша популярными данными после старта.

In-memory база хранит рабочий набор данных в оперативной памяти и может дополнительно писать снимки или журнал на диск.
Redis часто используют как кэш, но он не сводится только к кэшу: это in-memory система структур данных, которую также
применяют для rate limiting, счетчиков, pub/sub, очередей простого уровня и хранения короткоживущих состояний.

::: warning Кэш ускоряет чтение, но усложняет консистентность
Самая трудная часть кэша - не положить значение в память, а понять, когда оно устарело. Неправильное инвалидирование
может привести к тому, что пользователь увидит старую цену, старый остаток или уже отмененный заказ.
:::

::: multi-code "Cache-aside для продукта" {default=kotlin}

```kotlin
data class Product(val id: String, val name: String)

class ProductService(
    private val cache: MutableMap<String, Product>,
    private val repository: ProductRepository
) {
    fun getProduct(id: String): Product =
        cache[id] ?: repository.findById(id).also { cache[id] = it }
}
```

```kotlin playground
data class Product(val id: String, val name: String)

class ProductRepository {
    fun findById(id: String): Product {
        println("DB read for product=$id")
        return Product(id, "Mechanical Keyboard")
    }
}

class ProductService(
    private val cache: MutableMap<String, Product>,
    private val repository: ProductRepository
) {
    fun getProduct(id: String): Product {
        val cached = cache[id]
        if (cached != null) {
            println("cache hit for product=$id")
            return cached
        }

        val product = repository.findById(id)
        cache[id] = product
        return product
    }
}

fun main() {
    val service = ProductService(mutableMapOf(), ProductRepository())

    println(service.getProduct("p-1"))
    println(service.getProduct("p-1"))
}
```

```csharp
public sealed record Product(string Id, string Name);

public sealed class ProductService
{
    private readonly IDictionary<string, Product> _cache;
    private readonly ProductRepository _repository;

    public ProductService(
        IDictionary<string, Product> cache,
        ProductRepository repository)
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
}
```

```java
import java.util.Map;

record Product(String id, String name) {
}

final class ProductService {
    private final Map<String, Product> cache;
    private final ProductRepository repository;

    ProductService(Map<String, Product> cache, ProductRepository repository) {
        this.cache = cache;
        this.repository = repository;
    }

    Product getProduct(String id) {
        var cached = cache.get(id);
        if (cached != null) {
            return cached;
        }

        var product = repository.findById(id);
        cache.put(id, product);
        return product;
    }
}
```

```go
package main

type Product struct {
    ID   string
    Name string
}

type ProductRepository interface {
    FindByID(id string) Product
}

type ProductService struct {
    Cache      map[string]Product
    Repository ProductRepository
}

func (s ProductService) GetProduct(id string) Product {
    if product, ok := s.Cache[id]; ok {
        return product
    }

    product := s.Repository.FindByID(id)
    s.Cache[id] = product
    return product
}
```

:::

## NoSQL

NoSQL не означает "SQL запрещен". Это широкое семейство нереляционных моделей, которые появились как ответ на задачи,
где строгая табличная модель и `join` не всегда удобны: гибкая схема, хранение агрегата целиком, очень большие объемы,
географическое распределение, быстрый key-value доступ, графовые связи или полнотекстовый поиск.

| Модель | Пример данных | Когда подходит | Риск |
|---|---|---|---|
| Модель | Конкретный сценарий | Когда подходит | Риск |
|---|---|---|---|
| Key-value | Корзина покупок (сессионные данные): `cart:user42 → {items, ttl}` | Сессии, токены, счетчики, feature flags | Сложно делать сложные запросы по содержимому |
| Document | Каталог товаров с гибкой схемой: у электроники — вольтаж, у одежды — размер | Агрегаты с гибкой структурой, JSON-подобные данные | Дублирование и сложные обновления связанных данных |
| Column-family | Метрики сервиса: 100 тыс. точек/сек с предсказуемым запросом `WHERE ts > now()-1h` | Очень большие объемы записей с предсказуемыми запросами | Модель проектируется под запросы заранее |
| Graph | Рекомендации: «друзья друзей, которые купили X» — запрос по 3 связям | Запросы по отношениям между объектами | Не лучший выбор для обычного CRUD |
| Search / vector | Поиск похожих товаров по эмбеддингу описания | Поиск, ранжирование, RAG, рекомендации | Обычно требует синхронизации с основной БД |

Мотивация NoSQL обычно в одном из трех мест:

- данные не выглядят как стабильные нормализованные таблицы;
- нагрузка проще масштабируется без сложных cross-shard `join`;
- приложение читает и пишет агрегат целиком, а не произвольные комбинации строк.

Цена тоже реальна: меньше единых стандартов, сложнее переносимость между продуктами, другие транзакционные гарантии и
часто более жесткая привязка модели хранения к конкретным запросам.

::: details Distributed SQL (NewSQL)

Распределенные SQL-системы пытаются совместить знакомую SQL-модель с горизонтальным
распределением данных. Идея привлекательная: писать SQL, сохранять транзакционную модель, а размещение данных,
репликацию и часть failover отдать системе.

```mermaid
flowchart LR
    App["Application"] --> Sql["SQL endpoint / router"]
    Sql --> Node1[("Node 1")]
    Sql --> Node2[("Node 2")]
    Sql --> Node3[("Node 3")]
    Node1 <--> Node2
    Node2 <--> Node3
    Node3 <--> Node1
```

Что такие системы обещают: сохранить SQL и привычную модель запросов, распределить данные по нескольким узлам,
автоматизировать репликацию и маршрутизацию, дать горизонтальное масштабирование без ручного шардирования.

Но распределенность не бывает бесплатной. Консенсус, распределенные транзакции, сетевые задержки, rebalancing и
наблюдаемость имеют цену. Начинайте с простой надежной модели — Distributed SQL стоит рассматривать, когда есть реальные
симптомы: географическое распределение, объемы или нагрузка, которые не укладываются в один узел.
:::

## Embedded databases

Для unit-тестов с реальным SQL вместо mock-а удобно использовать SQLite — база поднимается за миллисекунды, без Docker и
сетевого подключения. Для мобильных приложений SQLite часто вообще единственная доступная БД.

Не каждой программе нужен отдельный сервер БД. Embedded database встраивается в процесс приложения как библиотека, а
данные часто лежат в одном или нескольких файлах. Типичный пример - SQLite.

```mermaid
flowchart LR
    App["Application process"] --> Lib["Embedded DB library"]
    Lib --> File[("Database file")]
```

Embedded DB хорошо подходит для нескольких сценариев:

- мобильное приложение, где данные пользователя нужны локально, а сеть может быть недоступна;
- desktop-приложение, где удобно хранить настройки, документы и локальные каталоги;
- IoT и edge, где нужна автономная работа рядом с устройством;
- локальный кэш подготовленных данных рядом с приложением;
- тесты, где нужно быстро поднять легкое хранилище без отдельного сервера.

Embedded DB плохо подходит как единственная БД для многопользовательского backend с высокой конкуренцией записей. Там
обычно нужна серверная СУБД: отдельный процесс, сетевой протокол, пул подключений, транзакции для многих клиентов,
наблюдаемость и централизованное резервное копирование.

## Как выбирать хранилище

Выбор базы данных лучше начинать не с моды и не с максимального набора возможностей, а с вопроса: какая нагрузка и какие
гарантии нужны системе сейчас.

| Сценарий | Начальный выбор | Почему | Когда пересматривать |
|---|---|---|---|
| CRUD backend | PostgreSQL | Транзакции, SQL, зрелость, индексы, расширения | Чтение или запись стали измеримым узким местом |
| Локальная разработка | PostgreSQL в Docker Compose | Воспроизводимость и близость к production-модели | Нужен полноценный production-like стенд |
| Быстрый кэш | Redis или cache-aside поверх основной БД | Быстрые повторные чтения и TTL | Появились проблемы консистентности или инвалидирования |
| Документные агрегаты | Document DB | Гибкая схема и чтение агрегата целиком | Нужны сложные `join` и строгие межагрегатные транзакции |
| Мобильное или desktop-приложение | SQLite | Встроенный файл, нет отдельного сервера | Нужна синхронизация между пользователями |
| Global high-load | Distributed SQL | Автоматическое распределение и failover | Только если нагрузка и требования реально оправдывают сложность |

Главный инженерный навык - не выбрать "самую мощную" базу, а вовремя понять, когда текущая модель перестала быть
достаточной. До этого момента простая модель обычно дешевле, надежнее и понятнее.

## Резюме

- Виртуальная машина виртуализирует железо и запускает полноценную guest OS.
- Контейнер изолирует приложение и его user space поверх общего ядра host OS.
- Docker стандартизирует упаковку, доставку и запуск контейнеров.
- Docker Compose удобен для локального набора сервисов, но не заменяет кластерный оркестратор.
- Kubernetes управляет множеством контейнеров через desired state: pod-ы, service, ingress, replicas и self-healing.
- Облако продает инфраструктурные возможности как сервис: от VM до managed databases.
- Stateless-сервисы масштабировать проще, чем состояние.
- OLTP и OLAP решают разные задачи и часто живут в разных хранилищах.
- Репликация, шардирование, кэш и distributed SQL решают разные проблемы и добавляют разную сложность.
- База данных должна быть скучной для прикладного кода: надежной, предсказуемой и достаточно простой для текущих
  требований.

Когда сервис запущен и умеет хранить состояние, появляется следующий слой вопросов: как он разговаривает с клиентами и
другими сервисами, где нужен синхронный ответ, а где достаточно принять задачу на выполнение. Это тема
[Лекции 10](/lectures/10#четыре-уровня-обмена).

## Вопросы для самопроверки

1. Чем гипервизор Type 1 отличается от Type 2?
2. Почему контейнер обычно стартует быстрее виртуальной машины?
3. Чем Docker image отличается от Docker container?
4. Почему volume важен для PostgreSQL в Docker?
5. Чем Docker Compose отличается от Kubernetes?
6. Что такое pod и почему это минимальная единица запуска в Kubernetes?
7. Чем горизонтальное масштабирование отличается от вертикального?
8. Чем OLTP отличается от OLAP?
9. Чем репликация отличается от шардирования?
10. Почему cache invalidation сложнее, чем запись значения в кэш?
11. Когда NoSQL может быть уместнее реляционной БД?
12. Почему distributed SQL не стоит брать в маленький проект без реальных требований к распределенности?
13. Когда embedded DB лучше серверной БД?

## Мини-практика

1. Опишите `docker-compose.yml` для приложения и PostgreSQL. Добавьте переменные окружения, проброс порта и volume для
   данных PostgreSQL.
2. Нарисуйте схему `service -> repository -> UnitOfWork -> DB` для оформления заказа. Отметьте, где начинается и
   заканчивается транзакция.
3. Для интернет-магазина выберите, где нужны OLTP, кэш, аналитическое хранилище и embedded или local storage. Для каждого
   выбора напишите, какую проблему он решает и какую сложность добавляет.
