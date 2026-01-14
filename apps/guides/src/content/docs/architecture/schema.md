---
title: Database Schema
description: Overview of the Prisma schema and data models.
---

The application uses **Prisma** with a PostgreSQL database.

## Core Models

### `NodeTemplate`
Defines the blueprint for a node.
- `type`: Unique identifier (enum `NodeType`).
- `templateHandles`: Defines the inputs and outputs.
- `isTerminalNode`: Boolean indicating if it runs on the backend.

### `Node`
An instance of a node on a canvas.
- `config`: JSON field storing node-specific configuration.
- `result`: JSON field storing the execution output.
- `position`: JSON field for UI coordinates.

### `Handle`
Connectors on a node.
- `type`: `Input` or `Output`.
- `dataTypes`: Array of allowed `DataType` enums.

### `Edge`
Connections between handles.
- `sourceHandleId` & `targetHandleId`.

### `Canvas`
Container for nodes and edges.

### `Task` & `TaskBatch`
Tracks the execution history.
- `Task` records the status, duration, and error of a node execution.

### `FileAsset`
Manages media files.
- Stores metadata like `width`, `height`, `fps`, `duration`.
- Points to cloud storage via `bucket` and `key`.

## Enums

### `NodeType`
Defines all available node types (e.g., `ImageGen`, `Text`, `Compositor`).

### `DataType`
Defines the types of data that can flow between nodes:
- `Text`
- `Number`
- `Boolean`
- `Image`
- `Video`
- `Audio`
