# Hidden Fallback

## Smell

Trusted internal code uses fallback creation, default values, auto-initialization, or silent repair to hide a broken contract.

## Bad Shape

```java
if (workspace != null) {
    return workspace;
}

Path targetDir = DEFAULT_WORKSPACE_BASE.resolve(agentType.getCode()).resolve(agentId);
Files.createDirectories(targetDir);
workspaceInitializer.initialize(agentId, targetDir);
return targetDir;
```

The builder quietly takes over workspace lifecycle even though `workspace` should be supplied by the caller.

## Preferred Shape

```java
private Workspace requireWorkspace() {
    if (workspace == null) {
        throw new IllegalStateException("workspace is required");
    }
    return workspace;
}
```

## Refactor Move

- Decide where the dependency becomes required.
- Validate at that boundary.
- Remove internal fallback branches.
- Keep recovery only for genuinely external input or user-facing workflows.

## Taste Rule

Framework internals should trust their own contracts. Required state should fail fast when missing.
