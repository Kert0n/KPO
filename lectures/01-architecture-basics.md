---
title: Лекция 01. Архитектура как управление зависимостями
order: 1
---

# Лекция 01. Архитектура как управление зависимостями

## Цель

Понять архитектуру приложения как набор решений о границах, зависимостях и направлениях изменения.

## Ключевые идеи

- Архитектура проявляется там, где изменение одной части системы влияет на другую.
- Хорошая граница скрывает детали и оставляет стабильный способ взаимодействия.
- Пример должен показывать не синтаксис языка сам по себе, а форму решения.

## Конспект

В небольшом приложении архитектура часто выглядит как избыточность. Но как только появляются независимые сценарии, разные источники данных, фоновые задачи и интеграции, становится важно отделять намерение от механизма выполнения.

Команда описывает намерение изменить состояние. Обработчик команды принимает решение, проверяет инварианты и возвращает события, которые фиксируют факт изменения.

## Пример

::: multi-code "Обработка команд приложения" {default=kotlin playground=kotlin}

```kotlin
sealed interface Command {
    data class RegisterUser(val id: UserId, val email: Email) : Command
    data class DisableUser(val id: UserId, val reason: String) : Command
}

@JvmInline
value class UserId(val value: String)

@JvmInline
value class Email(val value: String) {
    init {
        require("@" in value) { "Invalid email: $value" }
    }
}

data class User(
    val id: UserId,
    val email: Email,
    val active: Boolean = true
)

sealed interface DomainEvent {
    data class UserRegistered(val id: UserId, val email: Email) : DomainEvent
    data class UserDisabled(val id: UserId, val reason: String) : DomainEvent
}

class UserRegistry {
    private val users = linkedMapOf<UserId, User>()

    fun handle(command: Command): List<DomainEvent> = when (command) {
        is Command.RegisterUser -> {
            require(command.id !in users) { "User already exists: ${command.id.value}" }
            users[command.id] = User(command.id, command.email)
            listOf(DomainEvent.UserRegistered(command.id, command.email))
        }

        is Command.DisableUser -> {
            val current = users.getValue(command.id)
            users[command.id] = current.copy(active = false)
            listOf(DomainEvent.UserDisabled(command.id, command.reason))
        }
    }

    fun snapshot(): List<User> = users.values.toList()
}

fun main() {
    val registry = UserRegistry()

    val events = listOf(
        Command.RegisterUser(UserId("u-1"), Email("alice@example.com")),
        Command.RegisterUser(UserId("u-2"), Email("bob@example.com")),
        Command.DisableUser(UserId("u-1"), "Graduated")
    ).flatMap(registry::handle)

    println("Events:")
    events.forEach { println(" - $it") }

    println()
    println("Active users:")
    registry.snapshot()
        .filter(User::active)
        .forEach { println(" - ${it.id.value}: ${it.email.value}") }
}
```

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

public abstract record Command
{
    public sealed record RegisterUser(UserId Id, Email Email) : Command;
    public sealed record DisableUser(UserId Id, string Reason) : Command;
}

public readonly record struct UserId(string Value);

public readonly record struct Email
{
    public string Value { get; }

    public Email(string value)
    {
        if (!value.Contains('@')) throw new ArgumentException($"Invalid email: {value}");
        Value = value;
    }
}

public sealed record User(UserId Id, Email Email, bool Active = true);

public abstract record DomainEvent
{
    public sealed record UserRegistered(UserId Id, Email Email) : DomainEvent;
    public sealed record UserDisabled(UserId Id, string Reason) : DomainEvent;
}

public sealed class UserRegistry
{
    private readonly Dictionary<UserId, User> users = new();

    public IReadOnlyList<DomainEvent> Handle(Command command) => command switch
    {
        Command.RegisterUser register => Register(register),
        Command.DisableUser disable => Disable(disable),
        _ => throw new InvalidOperationException("Unknown command")
    };

    public IReadOnlyList<User> Snapshot() => users.Values.ToList();

    private IReadOnlyList<DomainEvent> Register(Command.RegisterUser command)
    {
        if (users.ContainsKey(command.Id)) throw new InvalidOperationException($"User already exists: {command.Id.Value}");
        users[command.Id] = new User(command.Id, command.Email);
        return new DomainEvent[] { new DomainEvent.UserRegistered(command.Id, command.Email) };
    }

    private IReadOnlyList<DomainEvent> Disable(Command.DisableUser command)
    {
        var current = users[command.Id];
        users[command.Id] = current with { Active = false };
        return new DomainEvent[] { new DomainEvent.UserDisabled(command.Id, command.Reason) };
    }
}

var registry = new UserRegistry();
var commands = new Command[]
{
    new Command.RegisterUser(new UserId("u-1"), new Email("alice@example.com")),
    new Command.RegisterUser(new UserId("u-2"), new Email("bob@example.com")),
    new Command.DisableUser(new UserId("u-1"), "Graduated")
};

var events = commands.SelectMany(registry.Handle).ToList();

Console.WriteLine("Events:");
events.ForEach(item => Console.WriteLine($" - {item}"));

Console.WriteLine();
Console.WriteLine("Active users:");
foreach (var user in registry.Snapshot().Where(user => user.Active))
{
    Console.WriteLine($" - {user.Id.Value}: {user.Email.Value}");
}
```

```java
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

sealed interface Command permits RegisterUser, DisableUser {}
record RegisterUser(UserId id, Email email) implements Command {}
record DisableUser(UserId id, String reason) implements Command {}

record UserId(String value) {}

record Email(String value) {
    Email {
        if (!value.contains("@")) throw new IllegalArgumentException("Invalid email: " + value);
    }
}

record User(UserId id, Email email, boolean active) {}

sealed interface DomainEvent permits UserRegistered, UserDisabled {}
record UserRegistered(UserId id, Email email) implements DomainEvent {}
record UserDisabled(UserId id, String reason) implements DomainEvent {}

final class UserRegistry {
    private final Map<UserId, User> users = new LinkedHashMap<>();

    List<DomainEvent> handle(Command command) {
        return switch (command) {
            case RegisterUser register -> register(register);
            case DisableUser disable -> disable(disable);
        };
    }

    List<User> snapshot() {
        return new ArrayList<>(users.values());
    }

    private List<DomainEvent> register(RegisterUser command) {
        if (users.containsKey(command.id())) {
            throw new IllegalStateException("User already exists: " + command.id().value());
        }

        users.put(command.id(), new User(command.id(), command.email(), true));
        return List.of(new UserRegistered(command.id(), command.email()));
    }

    private List<DomainEvent> disable(DisableUser command) {
        User current = users.get(command.id());
        users.put(command.id(), new User(current.id(), current.email(), false));
        return List.of(new UserDisabled(command.id(), command.reason()));
    }
}

public class Main {
    public static void main(String[] args) {
        var registry = new UserRegistry();
        var commands = List.<Command>of(
            new RegisterUser(new UserId("u-1"), new Email("alice@example.com")),
            new RegisterUser(new UserId("u-2"), new Email("bob@example.com")),
            new DisableUser(new UserId("u-1"), "Graduated")
        );

        var events = commands.stream()
            .flatMap(command -> registry.handle(command).stream())
            .toList();

        System.out.println("Events:");
        events.forEach(event -> System.out.println(" - " + event));

        System.out.println();
        System.out.println("Active users:");
        registry.snapshot().stream()
            .filter(User::active)
            .forEach(user -> System.out.println(" - " + user.id().value() + ": " + user.email().value()));
    }
}
```

```go
package main

import (
	"fmt"
	"strings"
)

type Command interface {
	isCommand()
}

type RegisterUser struct {
	ID    UserID
	Email Email
}

func (RegisterUser) isCommand() {}

type DisableUser struct {
	ID     UserID
	Reason string
}

func (DisableUser) isCommand() {}

type UserID string

type Email string

func NewEmail(value string) (Email, error) {
	if !strings.Contains(value, "@") {
		return "", fmt.Errorf("invalid email: %s", value)
	}

	return Email(value), nil
}

type User struct {
	ID     UserID
	Email  Email
	Active bool
}

type DomainEvent interface {
	isDomainEvent()
}

type UserRegistered struct {
	ID    UserID
	Email Email
}

func (UserRegistered) isDomainEvent() {}

type UserDisabled struct {
	ID     UserID
	Reason string
}

func (UserDisabled) isDomainEvent() {}

type UserRegistry struct {
	users map[UserID]User
	order []UserID
}

func NewUserRegistry() *UserRegistry {
	return &UserRegistry{users: map[UserID]User{}}
}

func (registry *UserRegistry) Handle(command Command) ([]DomainEvent, error) {
	switch current := command.(type) {
	case RegisterUser:
		if _, exists := registry.users[current.ID]; exists {
			return nil, fmt.Errorf("user already exists: %s", current.ID)
		}

		registry.users[current.ID] = User{ID: current.ID, Email: current.Email, Active: true}
		registry.order = append(registry.order, current.ID)
		return []DomainEvent{UserRegistered{ID: current.ID, Email: current.Email}}, nil
	case DisableUser:
		user := registry.users[current.ID]
		user.Active = false
		registry.users[current.ID] = user
		return []DomainEvent{UserDisabled{ID: current.ID, Reason: current.Reason}}, nil
	default:
		return nil, fmt.Errorf("unknown command")
	}
}

func (registry *UserRegistry) Snapshot() []User {
	users := make([]User, 0, len(registry.order))
	for _, id := range registry.order {
		users = append(users, registry.users[id])
	}

	return users
}

func mustEmail(value string) Email {
	email, err := NewEmail(value)
	if err != nil {
		panic(err)
	}

	return email
}

func main() {
	registry := NewUserRegistry()
	commands := []Command{
		RegisterUser{ID: "u-1", Email: mustEmail("alice@example.com")},
		RegisterUser{ID: "u-2", Email: mustEmail("bob@example.com")},
		DisableUser{ID: "u-1", Reason: "Graduated"},
	}

	var events []DomainEvent
	for _, command := range commands {
		nextEvents, err := registry.Handle(command)
		if err != nil {
			panic(err)
		}
		events = append(events, nextEvents...)
	}

	fmt.Println("Events:")
	for _, event := range events {
		fmt.Printf(" - %#v\n", event)
	}

	fmt.Println()
	fmt.Println("Active users:")
	for _, user := range registry.Snapshot() {
		if user.Active {
			fmt.Printf(" - %s: %s\n", user.ID, user.Email)
		}
	}
}
```

:::

## Вопросы для самопроверки

- Где в примере проходит граница между запросом на изменение и изменением состояния?
- Какие инварианты защищает `UserRegistry`?
- Что изменится, если хранение пользователей вынести в базу данных?

## Что читать дальше

- Глоссарий: архитектурная граница.
- Дополнительные материалы: паттерн "Команда".
