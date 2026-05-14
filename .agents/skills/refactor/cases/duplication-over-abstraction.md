# Duplication Over Bad Abstraction

## Smell

Similar code is merged too early, and the shared abstraction becomes harder to read than the repeated code.

## Bad Shape

```java
process(target, Mode.CREATE, true, false, context);
process(target, Mode.UPDATE, false, true, context);
process(target, Mode.DELETE, false, false, context);
```

The duplication is gone, but the call sites now require readers to decode flags and generic behavior.

## Preferred Shape

```java
createTarget(target, context);
updateTarget(target, context);
deleteTarget(target, context);
```

Some repeated lines are acceptable when each path has a clear name and a clear reason to exist.

## Refactor Move

- Keep duplication when the business meaning differs.
- Extract only after the shared concept has a good name.
- Avoid boolean parameters that create hidden modes.
- Prefer small named functions over generic functions with flags.
- Let repeated code survive until the variation becomes stable.

## Taste Rule

Readable duplication is better than an abstraction that makes intent disappear.
