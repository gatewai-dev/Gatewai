---
title: Canvas Processor
description: Details about the Canvas Processor.
---

The Canvas Processor is responsible for managing the state and rendering of the node graph on the frontend.

## Responsibilities

- **Rendering**: Visualizing nodes, edges, and handles using React Flow.
- **Interaction**: Handling user inputs like dragging, connecting, and selecting nodes.
- **State Management**: synchronizing the local canvas state with the server.

## Key Components

### `CanvasCtx`
The React context that holds the state of the canvas, including nodes, edges, and selection.

### `NodeGraphProcessor`
While the heavy lifting is done by the `NodeGraphProcessor` (detailed in its own section), the Canvas Processor interfaces with it to trigger updates and reflect execution states (e.g., progress bars, error states) on the UI.
