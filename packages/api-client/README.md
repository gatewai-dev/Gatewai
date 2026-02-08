# Gatewai API Client

A TypeScript client library for running Gatewai workflows programmatically.

## Installation

```bash
pnpm add @gatewai/api-client
```

## Quick Start

```typescript
import { GatewaiApiClient } from "@gatewai/api-client";

const client = new GatewaiApiClient({
  baseUrl: "http://localhost:8081",
  apiKey: "your-api-key",
});

// Run a workflow
const result = await client.run({
  canvasId: "your-canvas-id",
});

console.log(result);
```

## Running Workflows

### Basic Run (with duplication)

By default, each run duplicates the canvas to preserve the original:

```typescript
const result = await client.run({
  canvasId: "canvas-id",
});
```

### Run Without Duplication

Set `duplicate: false` to run directly on the original canvas:

```typescript
const result = await client.run({
  canvasId: "canvas-id",
  duplicate: false,
});
```

> **Note:** When `duplicate: false`, any inputs you provide will modify the original canvas nodes.

### With Text Inputs

Override Text node values by passing node IDs in the payload:

```typescript
const result = await client.run({
  canvasId: "canvas-id",
  payload: {
    "text-node-id": "Your custom prompt here",
    "another-text-node": "Another value",
  },
});
```

## File Inputs

The API supports multiple file input formats for File (Import Media) nodes.

### From URL

Download and attach a file from a public URL:

```typescript
const result = await client.run({
  canvasId: "canvas-id",
  payload: {
    "file-node-id": GatewaiApiClient.fromUrl("https://example.com/image.png"),
  },
});
```

### From Base64

Upload a file from base64-encoded data:

```typescript
const result = await client.run({
  canvasId: "canvas-id",
  payload: {
    "file-node-id": GatewaiApiClient.fromBase64(base64Data, "image/png"),
  },
});

// Legacy format (plain string) also works:
const result = await client.run({
  canvasId: "canvas-id",
  payload: {
    "file-node-id": "data:image/png;base64,iVBORw0KGgo...",
  },
});
```

### From Existing Asset

Reuse an already-uploaded asset without re-uploading:

```typescript
const result = await client.run({
  canvasId: "canvas-id",
  payload: {
    "file-node-id": GatewaiApiClient.fromAssetId("existing-asset-id"),
  },
});
```

## Complete Example

```typescript
import { GatewaiApiClient } from "@gatewai/api-client";
import fs from "fs";

const client = new GatewaiApiClient({
  baseUrl: "http://localhost:5456",
  apiKey: process.env.GATEWAI_API_KEY!,
});

// Read local file as base64
const imageBuffer = fs.readFileSync("./input.png");
const base64Data = imageBuffer.toString("base64");

// Run workflow with mixed inputs
const result = await client.run({
  canvasId: "my-workflow-canvas",
  payload: {
    // Text input
    "prompt-node": "A beautiful sunset over mountains",
    // File from base64
    "image-input": GatewaiApiClient.fromBase64(base64Data, "image/png"),
    // File from URL
    "reference-image": GatewaiApiClient.fromUrl("https://example.com/ref.jpg"),
  },
  duplicate: true, // Default, creates a copy
});

if (result.success && result.result) {
  console.log("Output:", result.result);
}
```

## Polling Control

The `run()` method automatically polls until completion. Customize the interval:

```typescript
// Poll every 2 seconds instead of default 1 second
const result = await client.run(request, 2000);
```

For more control, use `startRun()` and `checkStatus()` separately:

```typescript
const batch = await client.startRun({ canvasId: "..." });
// ... do other work ...
const status = await client.checkStatus(batch.batchHandleId);
```

## Asset Management

```typescript
// List assets
const assets = await client.listAssets({ limit: 10 });

// Upload from URL
const asset = await client.uploadAssetFromUrl({
  url: "https://example.com/file.mp4",
  filename: "video.mp4",
});

// Get asset details
const details = await client.getAsset(asset.id);

// Delete asset
await client.deleteAsset(asset.id);
```

## TypeScript Types

All request/response types are exported:

```typescript
import type {
  StartRunRequest,
  StartRunResponse,
  RunStatusResponse,
  FileInput,
  NodeInput,
} from "@gatewai/api-client";
```
