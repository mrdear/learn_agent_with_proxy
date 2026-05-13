# Scattered Lifecycle

## Smell

Setup, validation, execution, cleanup, retry, and error policy are spread across multiple unrelated classes.

## Bad Shape

```java
controller.prepare(job);
service.validate(job);
worker.start(job);
listener.cleanup(job);
controller.markFinished(job);
```

No single place owns the lifecycle. Adding a new lifecycle phase requires editing unrelated classes.

## Preferred Shape

```java
final class JobRunner {
    JobResult run(Job job) {
        validate(job);
        try {
            prepare(job);
            return execute(job);
        } finally {
            cleanup(job);
        }
    }
}
```

## Refactor Move

- Identify the lifecycle phases.
- Pick one owner for phase ordering.
- Keep phase-specific behavior behind small collaborators if needed.
- Make error and cleanup policy explicit.
- Avoid spreading lifecycle decisions across controllers, services, and listeners.

## Taste Rule

Lifecycle order is a responsibility. Give it one owner.
