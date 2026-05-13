# Messy Fields And Interfaces

## Smell

Fields, methods, and interfaces are added as the implementation grows, without a stable ownership model.

## Bad Shape

```java
class TaskRunner {
    public String mode;
    public boolean async;
    public Map<String, Object> options;
    public Callback callback;
    public TaskContext context;
}
```

The object has state, configuration, lifecycle, and callbacks in one loose bag.

## Preferred Shape

```java
record TaskRunRequest(TaskMode mode, TaskOptions options) {}

final class TaskRunner {
    private final TaskExecutor executor;

    TaskResult run(TaskRunRequest request) {
        return executor.execute(request);
    }
}
```

## Refactor Move

- Group fields by ownership: configuration, runtime state, dependency, result, lifecycle.
- Make required state constructor-bound or request-bound.
- Remove interfaces that only mirror one implementation.
- Split broad interfaces by stable capability.
- Rename technical filler into domain language.

## Taste Rule

State should have an owner. Interfaces should describe capability, not anxiety about future change.
