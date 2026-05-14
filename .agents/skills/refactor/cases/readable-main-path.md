# Readable Main Path

## Smell

The core behavior is hard to see because setup, fallback, validation, branching, callbacks, logging, and adapter code all sit at the same level.

## Bad Shape

```java
Result run(Request request) {
    if (request == null) {
        request = Request.empty();
    }
    Metrics.Scope scope = metrics.open("run");
    try {
        if (config.isAsync()) {
            return executor.submit(() -> service.handle(adapter.convert(request))).get();
        }
        if (featureFlags.enabled("new-flow")) {
            return newHandler.handle(adapter.convert(request));
        }
        return oldHandler.handle(adapter.convert(request));
    } catch (Exception error) {
        logger.warn("run failed", error);
        return Result.empty();
    } finally {
        scope.close();
    }
}
```

The reader has to separate policy, fallback, execution, metrics, conversion, and error handling before seeing the real flow.

## Preferred Shape

```java
Result run(Request request) {
    Request validRequest = requireRequest(request);
    Command command = commandFactory.create(validRequest);
    return runner.run(command);
}
```

Only extract helpers when the names make the main path clearer. Do not hide important behavior behind vague helpers.

## Refactor Move

- Make invalid input handling explicit at the boundary.
- Put the happy path near the top.
- Move secondary policies behind precise names.
- Remove silent fallback results unless the product behavior requires them.
- Keep extracted methods small and honest.

## Taste Rule

Good code lets the reader see the main flow before the edge cases.
