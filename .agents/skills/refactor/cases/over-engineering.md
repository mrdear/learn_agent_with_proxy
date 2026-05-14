# Over Engineering

## Smell

A simple behavior is wrapped in managers, registries, factories, providers, or generic frameworks before the system has real repetition.

## Bad Shape

```java
Handler handler = handlerProvider
    .getRegistry()
    .findFactory(type)
    .create(config)
    .decorate(metrics)
    .build();

handler.handle(input);
```

The structure is more complex than the current problem.

## Preferred Shape

```java
Handler handler = handlers.forType(type);
handler.handle(input);
```

Or even:

```java
handle(input, type);
```

when there is only one behavior and no real extension point yet.

## Refactor Move

- Count concrete use cases.
- Collapse pass-through layers.
- Keep only the abstraction that owns a real decision.
- Prefer direct code until a second or third concrete case proves the shape.
- Preserve names and boundaries that will still make sense when the feature grows.

## Taste Rule

Extensibility should come from clear boundaries, not speculative architecture.
