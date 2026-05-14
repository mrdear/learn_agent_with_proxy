# Domain Exposure

## Smell

Domain objects expose raw state and let callers enforce invariants from the outside.

## Bad Shape

```java
class Order {
    public List<OrderItem> items = new ArrayList<>();
    public OrderStatus status;
}

order.items.add(item);
order.status = OrderStatus.PAID;
```

Any caller can mutate important state without passing through domain rules.

## Preferred Shape

```java
class Order {
    private final List<OrderItem> items = new ArrayList<>();
    private OrderStatus status = OrderStatus.DRAFT;

    void addItem(OrderItem item) {
        ensureEditable();
        items.add(item);
    }

    void markPaid(Payment payment) {
        ensurePayable(payment);
        status = OrderStatus.PAID;
    }

    List<OrderItem> items() {
        return List.copyOf(items);
    }
}
```

## Refactor Move

- Make fields private.
- Replace setters with domain verbs.
- Return immutable views or copies for collections.
- Keep invariants inside the object that owns the state.
- Use value objects when primitives carry important domain meaning.

## Taste Rule

Domain objects should expose behavior before state.
