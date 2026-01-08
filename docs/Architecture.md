# Gatewai Architecture

Gatewai is a node-based generative AI workflow engine designed to execute complex generative tasks through a visual canvas interface.

## 🏗️ System Overview

The system employs a **hybrid execution model**:
- **Frontend (Web)**: Handles the visual node graph, user interactions, and lightweight processing.
- **Backend (Node.js)**: Executes heavy generative AI tasks, terminal operations, and manages data persistence.

### Tech Stack
- **Frontend**: React, Vite, React Flow
- **Backend**: Node.js, Hono
- **Database**: PostgreSQL, Prisma ORM
- **Storage**: Google Cloud Storage
- **Language**: TypeScript (Monorepo with Turbo)

## 🗄️ Data Model

The database schema is defined in `packages/db/prisma/schema.prisma`.

### Node System
The core logic follows a **Template-Instance** pattern:
- **`NodeTemplate`**: Defines the blueprint for a node (e.g., "ImageGen"), including its type, category, and default configuration.
- **`Node`**: An instance of a template placed on a user's canvas. Stores position, configuration, and execution results.
- **`Handle`**: Connection points on nodes. Defined by `DataType` (e.g., Image, Text).
- **`Edge`**: Connects a source `Handle` to a target `Handle`.

### Execution Engine
Execution is asynchronous and tracked via batches:
- **`TaskBatch`**: Represents a single execution run triggered from the canvas.
- **`Task`**: Tracks the lifecycle (`QUEUED`, `EXECUTING`, `COMPLETED`, `FAILED`) of individual node executions.

### Asset Management
- **`FileAsset`**: Manages metadata for AI-generated or uploaded media (Images, Videos). Stores references to cloud storage buckets and keys.

## 📂 Directory Structure

- **`apps/gatewai-fe`**: The main web application (Frontend).
  - **`src`**: React UI and canvas logic.
  - **`backend`**: Backend server code (Hono), task workers, and API routes.
- **`packages/db`**: Prisma schema definitions, migrations, and generated client.
- **`packages/types`**: Shared TypeScript interfaces and type definitions used across frontend and backend.
