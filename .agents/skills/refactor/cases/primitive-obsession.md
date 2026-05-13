# Primitive Obsession

## Smell

Strings, maps, booleans, numeric flags, or loose enums carry domain meaning across the system.

## Bad Shape

```java
submit(String userId, String plan, boolean trial, Map<String, Object> metadata);
```

The signature accepts invalid combinations and hides domain meaning inside primitives.

## Preferred Shape

```java
submit(UserId userId, SubscriptionPlan plan, TrialPolicy trialPolicy, Metadata metadata);
```

Do not wrap every primitive automatically. Introduce domain types where they prevent invalid states, centralize parsing, or make behavior easier to locate.

## Refactor Move

- Find primitives repeated across boundaries.
- Check whether validation or formatting is duplicated.
- Introduce a value object for meaningful identity, policy, money, time, status, or typed metadata.
- Keep construction and parsing at the boundary.
- Avoid tiny wrappers that add no invariant or behavior.

## Taste Rule

Use domain types when they protect meaning.
