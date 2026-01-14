---
title: Node Graph Processor
description: Deep dive into the Node Graph Processor logic.
---

The `NodeGraphProcessor` is the core engine responsible for executing the node graph. It handles dependency resolution, topological sorting, and the execution loop.

## Execution Flow

1.  **Graph Validation**:
    *   Checks for missing connections on required handles.
    *   Validates data type compatibility between connected handles.
    *   Identifies cycles (though the UI typically prevents them).

2.  **Topological Sort**:
    *   Determines the order of execution based on dependencies.
    *   Nodes with no dependencies (or satisfied dependencies) are processed first.

3.  **Execution Loop**:
    *   The processor runs a loop that continuously checks for "ready" nodes.
    *   **Ready Node**: A node whose inputs are all available (upstream nodes have completed successfully).
    *   **Dirty Node**: A node that needs re-execution due to config changes or upstream updates.

4.  **Node Execution**:
    *   The specific processor for the node type is invoked.
    *   Inputs are collected from upstream nodes.
    *   The result is computed and stored in the `NodeState`.
    *   Downstream nodes are notified of the update.

## State Management

The processor maintains an internal state for each node:

```typescript
export interface NodeState {
    id: string;
    status: TaskStatus | null; // QUEUED, EXECUTING, FAILED, COMPLETED
    isDirty: boolean;
    result: NodeResult | null;
    inputs: Record<string, ConnectedInput> | null;
    error: string | null;
    // ... metrics and versioning
}
```

## Error Handling

- **Validation Errors**: Detected before execution starts (e.g., type mismatch).
- **Execution Errors**: Occur during node processing. The node is marked as `FAILED`, and the error is propagated to dependent nodes (which may also fail or stall).
