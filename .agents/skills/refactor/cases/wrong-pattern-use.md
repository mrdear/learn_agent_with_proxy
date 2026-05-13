# Wrong Pattern Use

## Smell

The code either avoids a pattern where variation is real, or adds pattern layers where direct code would be clearer.

## Bad Shape

```java
if (type.equals("email")) {
    sendEmail(message);
} else if (type.equals("slack")) {
    sendSlack(message);
} else if (type.equals("webhook")) {
    sendWebhook(message);
}
```

This branch becomes fragile when each channel gains its own validation, retry policy, or delivery metadata.

## Preferred Shape

```java
interface NotificationChannel {
    boolean supports(ChannelType type);
    void send(Message message);
}
```

Use direct branching when the variation is small and stable. Introduce Strategy, Command, Factory, or Template Method when the variation has behavior and will grow independently.

## Refactor Move

- Name the variation point.
- Check whether it is behavioral, lifecycle-related, creation-related, or just a simple conditional.
- Pick the smallest pattern that makes the next change local.
- Remove pattern layers that do not own a real decision.

## Taste Rule

A pattern is good when it gives a real responsibility a home.
