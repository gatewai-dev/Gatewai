# Gatewai Architecture Documentation

## Overview

Gatewai is a node-based visual workflow platform that bridges complex AI models with intuitive creative workflows. It enables users to generate and edit videos, images, audio, and text through a visual node-based interface.

### Core Characteristics

- **Headless Backend-First**: Execution engine decoupled from UI, enabling API-only operation
- **Hybrid Execution**: Nodes process across frontend (preview) and backend (production) based on task requirements
- **Node-Based Visual Canvas**: Users connect AI-powered nodes to create media workflows
- **Real-time Rendering**: WebGL parity between client and server

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Canvas    │  │   Nodes     │  │   Agent     │  │   Assets    │       │
│  │  (React    │  │ (Component) │  │   Chat      │  │  Manager    │       │
│  │   Flow)     │  │             │  │             │  │             │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
└─────────┼────────────────┼────────────────┼────────────────┼───────────────┘
          │                │                │                │
          └────────────────┴────────┬───────┴────────────────┘
                                    │ HTTPS
┌────────────────────────────────────┼───────────────────────────────────────┐
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Hono.js Server                               │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │   Auth     │  │  REST API  │  │   Agent    │  │  WebSocket │    │  │
│  │  │ (Better    │  │  (Routes) │  │   Routes   │  │  (Redis)   │    │  │
│  │  │   Auth)    │  │            │  │            │  │            │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         ▼                          ▼                          ▼            │
│  ┌─────────────┐          ┌─────────────────┐        ┌─────────────┐    │
│  │   BullMQ    │          │    Prisma        │        │    Redis    │    │
│  │   Queue     │          │   PostgreSQL     │        │             │    │
│  │  (Worker)  │          │                  │        │  (Pub/Sub)  │    │
│  └─────────────┘          └─────────────────┘        └─────────────┘    │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         ▼                          ▼                          ▼            │
│  ┌─────────────┐          ┌─────────────────┐        ┌─────────────┐    │
│  │  Node       │          │   AI Providers  │        │    GCS      │    │
│  │  Processors │          │   (Gemini,Veo)  │        │  (Storage)  │    │
│  └─────────────┘          └─────────────────┘        └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models (Prisma Schema)

### Core Entities

```prisma
// Data Types supported in the graph
enum DataType {
  Text
  Number
  Boolean
  Image
  Video
  Audio
}

// Task execution status
enum TaskStatus {
  QUEUED
  EXECUTING
  FAILED
  COMPLETED
}

// Handle direction
enum HandleType {
  Input
  Output
}
```

### Canvas & Node Graph

```prisma
model Canvas {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String?
  nodes       Node[]
  taskBatches TaskBatch[]
  version     Int      @default(0)  // For AI agent sync
  isAPICanvas Boolean? @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Node {
  id       String  @id @default(cuid())
  name     String
  type     String  // Node type identifier (e.g., "ImageGen")
  position Json    // { x: number, y: number }
  width    Float?
  height   Float?
  config   Json?   // Node-specific configuration
  result   Json?   // Node processing result
  
  canvasId String
  canvas   Canvas  @relation(fields: [canvasId], references: [id], onDelete: Cascade)
  
  templateId String
  template   NodeTemplate @relation(fields: [templateId], references: [id])
  
  handles Handle[]
  edgesFrom Edge[] @relation("EdgesFrom")
  edgesTo   Edge[] @relation("EdgesTo")
  tasks    Task[]
}

model Handle {
  id          String      @id @default(cuid())
  type        HandleType
  dataTypes   DataType[]  // Supported data types (e.g., ["Image", "Video"])
  label       String      // Display label (e.g., "Prompt", "Result")
  required    Boolean     @default(false)
  order       Int         @default(0)
  
  nodeId      String
  node        Node        @relation("NodeHandles", fields: [nodeId], references: [id], onDelete: Cascade)
  
  sourceEdges Edge[] @relation("SourceHandle")
  targetEdges Edge[] @relation("TargetHandle")
}

model Edge {
  id             String @id @default(cuid())
  source         String // Source node ID
  target         String // Target node ID
  sourceHandleId String
  targetHandleId String
  
  sourceNode     Node   @relation("EdgesFrom", fields: [source], references: [id], onDelete: Cascade)
  targetNode     Node   @relation("EdgesTo", fields: [target], references: [id], onDelete: Cascade)
  sourceHandle   Handle @relation("SourceHandle", fields: [sourceHandleId], references: [id], onDelete: Cascade)
  targetHandle   Handle @relation("TargetHandle", fields: [targetHandleId], references: [id], onDelete: Cascade)
  
  @@unique([sourceHandleId, targetHandleId]) // Prevent duplicate connections
}

model NodeTemplate {
  id           String  @id @default(cuid())
  type         String  @unique // Unique node type identifier
  displayName  String
  description  String?
  category     String?
  subcategory  String?
  
  tokenPrice   Float   @default(0.0)
  isTerminalNode Boolean @default(false)  // Final output node (no downstream connections)
  isTransient  Boolean @default(false)   // Doesn't persist result
  
  templateHandles NodeTemplateHandle[]
  defaultConfig   Json?
  nodes           Node[]
}
```

### Task Execution

```prisma
model TaskBatch {
  id             String    @id @default(cuid())
  canvasId       String
  canvas         Canvas    @relation(fields: [canvasId], references: [id], onDelete: Cascade)
  
  tasks          Task[]
  startedAt     DateTime? // When first task was dispatched
  finishedAt    DateTime? // When all tasks completed
  pendingJobData Json?    // Deferred job data when waiting for previous batch
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Task {
  id          String     @id @default(cuid())
  name        String
  nodeId      String?
  node        Node?      @relation(fields: [nodeId], references: [id], onDelete: SetNull)
  
  status      TaskStatus?
  startedAt   DateTime?
  finishedAt  DateTime?
  durationMs  Float?
  error       Json?
  result      Json?      // Stored result for recovery
  
  batchId     String
  batch       TaskBatch  @relation(fields: [batchId], references: [id], onDelete: Cascade)
}
```

### Assets

```prisma
model FileAsset {
  id         String   @id @default(cuid())
  name       String
  userId     String?
  
  width      Int?     // Image/video width
  height     Int?     // Image/video height
  size       Int      // File size in bytes
  mimeType   String   // MIME type (image/png, video/mp4, etc.)
  bucket     String   // GCS bucket name
  key        String   // GCS object key
  
  duration   Int?     // Audio/video duration in milliseconds
  fps        Int?     // Video frame rate
  
  isUploaded Boolean  @default(true)  // true = user upload, false = AI generated
  
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

### Agent System

```prisma
model AgentSession {
  id          String        @id @default(cuid())
  canvasId    String
  canvas      Canvas        @relation(fields: [canvasId], references: [id], onDelete: Cascade)
  
  threadId    String?       @unique  // OpenAI thread ID
  assistantId String?
  model       String?
  status      SessionStatus @default(ACTIVE)
  metadata    Json?
  
  events      Event[]
  patches     CanvasPatch[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Event {
  id              String      @id @default(cuid())
  agentSessionId  String
  agentSession    AgentSession @relation(fields: [agentSessionId], references: [id], onDelete: Cascade)
  
  eventType       String      // OpenAI event type
  role            EventRole?
  content         Json        // Message content, tool calls, etc.
  messageId       String?     // OpenAI message ID
  runId           String?     // OpenAI run ID
  toolCallId      String?
  toolName        String?
  promptTokens    Int?
  completionTokens Int?
  status          EventStatus @default(COMPLETED)
  
  createdAt       DateTime    @default(now())
}

model CanvasPatch {
  id            String     @id @default(cuid())
  canvasId      String
  canvas        Canvas     @relation(fields: [canvasId], references: [id], onDelete: Cascade)
  
  patch         Json       // Proposed changes
  status        PatchStatus @default(PENDING)
  
  agentSessionId String?
  agentSession   AgentSession? @relation(fields: [agentSessionId], references: [id], onDelete: SetNull)
  
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
}
```

---

## Node Graph Processor

### Architecture

The node graph processor handles the execution of nodes in a canvas workflow. It uses a queue-based system for background processing with dependency resolution.

### Key Components

#### 1. NodeWFProcessor (Canvas Workflow Processor)

**Location**: `packages/graph-engine/src/canvas-workflow-processor.ts`

The `NodeWFProcessor` class is the main entry point for processing canvas nodes:

```typescript
class NodeWFProcessor {
  // Build dependency graphs within selected nodes
  buildDepGraphs(nodeIds: Node["id"][], data: CanvasCtxData): {
    depGraph: Map<Node["id"], Node["id"][]>;
    revDepGraph: Map<Node["id"], Node["id"][]>;
  }

  // Topological sort using Kahn's algorithm
  topologicalSort(
    nodes: string[],
    depGraph: Map<Node["id"], Node["id"][]>,
    revDepGraph: Map<Node["id"], Node["id"][]>,
  ): string[] | null;

  // Main entry point for processing nodes
  async processNodes(
    canvasId: Canvas["id"],
    nodeIds?: Node["id"][],  // Specific nodes to run, or all if not provided
    apiKey?: string,
  ): Promise<TaskBatch>;
}
```

#### 2. Workflow Queue (BullMQ)

**Location**: `packages/graph-engine/src/queue/workflow.queue.ts`

Uses BullMQ for distributed job processing:

```typescript
// Job data structure
interface NodeTaskJobData {
  taskId: string;           // Task ID in database
  canvasId: string;         // Canvas ID
  batchId: string;          // Task batch ID
  remainingTaskIds: string[]; // Remaining tasks to process
  isExplicitlySelected: boolean;
  selectionMap: Record<string, boolean>;
  apiKey?: string;
}
```

#### 3. Workflow Worker

**Location**: `apps/gatewai-backend/src/graph-engine/queue/workflow.worker.ts`

The worker processes individual node tasks:

```typescript
async function processNodeJob(job: Job<NodeTaskJobData>) {
  // 1. Load canvas entities (nodes, edges, handles)
  const data = await GetCanvasEntities(canvasId);
  
  // 2. Find the node being processed
  const node = data.nodes.find(n => n.id === task.nodeId);
  
  // 3. Get processor from registry
  const ProcessorClass = nodeRegistry.getProcessor(node.type);
  
  // 4. Create context with full canvas state
  const ctx: BackendNodeProcessorCtx = {
    node,
    data: { ...data, tasks: batchTasks, task, apiKey }
  };
  
  // 5. Process the node
  const processorInstance = container.get(ProcessorClass);
  const result = await processorInstance.process(ctx);
  
  // 6. Update task and node results
  await prisma.task.update({ ... });
  await prisma.node.update({ ... });
  
  // 7. Trigger next task in sequence
  await triggerNextTask(...);
}
```

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NODE EXECUTION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

1. USER TRIGGERS EXECUTION
   │
   ▼
2. NodeWFProcessor.processNodes(canvasId, nodeIds?)
   │
   ├── a) GetCanvasEntities(canvasId) → Full canvas state
   │
   ├── b) Create TaskBatch record
   │
   ├── c) Build dependency graph (buildDepGraphs)
   │     - Maps downstream dependencies for each node
   │
   ├── d) Topological sort (topologicalSort)
   │     - Kahn's algorithm for execution order
   │     - Returns null if cycle detected
   │
   ├── e) Create Task records for each node
   │
   └── f) Dispatch first task to BullMQ queue
           (or defer if another batch is running)
   │
   ▼
3. WORKER PROCESSES TASK (processNodeJob)
   │
   ├── a) Update task status → EXECUTING
   │
   ├── b) Get processor from NodeRegistry
   │
   ├── c) Create BackendNodeProcessorCtx:
   │     {
   │       node: Node & { result, config, template },
   │       data: { canvas, nodes, edges, handles, tasks, task, apiKey }
   │     }
   │
   ├── d) Execute processor.process(ctx)
   │     - Processor uses GraphResolvers to get input values
   │     - Processor returns { success, error, newResult }
   │
   ├── e) Update task status → COMPLETED/FAILED
   │     - Store result in Task.result
   │     - Store result in Node.result (if not transient)
   │
   ├── f) Propagate failures downstream
   │     - If task fails, mark all downstream tasks as FAILED
   │
   └── g) Trigger next task (triggerNextTask)
           - Chain to next task in topological order
   │
   ▼
4. BATCH COMPLETION (checkAndFinishBatch)
   │
   ├── a) Count pending/executing tasks
   │
   ├── b) If all complete, set batch.finishedAt
   │
   └── c) Dispatch next pending batch if exists
```

### Dependency Resolution

The graph resolver system (`packages/graph-engine/src/resolvers.ts`) handles input/output resolution:

```typescript
// Get input value by data type and label
getInputValue(
  data: CanvasCtxDataWithTasks,
  targetNodeId: string,
  required: boolean,
  options: { dataType?: DataType; label?: string }
): { type: DataType; data: unknown; outputHandleId: string } | null

// Get all input values of a specific type
getInputValuesByType(
  data: CanvasCtxDataWithTasks,
  targetNodeId: string,
  options: { dataType?: DataType; label?: string }
): Array<{ type: DataType; data: unknown; outputHandleId: string } | null>

// Resolve source value from edge
resolveSourceValue(
  data: CanvasCtxDataWithTasks,
  edge: Edge
): OutputItem | null

// Load media buffer from storage (GCS)
loadMediaBuffer(storage: StorageService, fileData: FileData): Promise<Buffer>
```

---

## Node System

### Node Structure

Each node is a separate package in the `nodes/` directory:

```
nodes/node-image-gen/
├── package.json
└── src/
    ├── metadata.ts          # Node definition (type, handles, config schema)
    ├── shared/
    │   ├── config.ts        # Zod schemas (config + result)
    │   └── index.ts
    ├── browser/
    │   ├── index.ts         # Client-side registration
    │   ├── processor.ts     # Browser processor (for preview)
    │   └── node-component.tsx
    └── server/
        ├── index.ts         # Server-side registration
        └── processor.ts     # Backend processor (for execution)
```

### Node Metadata

```typescript
// nodes/node-image-gen/src/metadata.ts
export default defineMetadata({
  type: "ImageGen",                    // Unique type identifier
  displayName: "Generate Image",       // Display name
  category: "AI",                      // Category for sidebar
  subcategory: "Image",                // Subcategory
  isTerminal: true,                     // Terminal node (no outputs)
  isTransient: false,                  // Persists result
  handles: {
    inputs: [
      { dataTypes: ["Text"], required: true, label: "Prompt" },
      { dataTypes: ["Image"], label: "Image" }
    ],
    outputs: [
      { dataTypes: ["Image"], label: "Result" }
    ]
  },
  configSchema: ImageGenNodeConfigSchema,
  resultSchema: ImageGenResultSchema,
  defaultConfig: { model: "gemini-3-pro-image-preview" }
});
```

### Backend Processor

```typescript
// nodes/node-image-gen/src/server/processor.ts
@injectable()
export class ImageGenProcessor implements NodeProcessor {
  constructor(
    @inject(TOKENS.PRISMA) private prisma: PrismaClient,
    @inject(TOKENS.ENV) private env: EnvConfig,
    @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
    @inject(TOKENS.STORAGE) private storage: StorageService,
    @inject(TOKENS.MEDIA) private media: MediaService,
    @inject(TOKENS.AI_PROVIDER) private aiProvider: AIProvider,
  ) {}

  async process(ctx: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
    // 1. Get input values from graph
    const prompt = this.graph.getInputValue(ctx.data, ctx.node.id, true, {
      dataType: DataType.Text,
      label: "Prompt"
    });
    
    const images = this.graph.getInputValuesByType(ctx.data, ctx.node.id, {
      dataType: DataType.Image
    });
    
    // 2. Parse node config
    const config = ImageGenNodeConfigSchema.parse(ctx.node.config);
    
    // 3. Call AI provider
    const genAI = this.aiProvider.getGemini<GoogleGenAI>();
    const response = await genAI.models.generateContent({
      model: config.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseModalities: ["IMAGE"] }
    });
    
    // 4. Upload result to storage
    const buffer = Buffer.from(imageData, "base64");
    await this.storage.uploadToStorage(buffer, key, mimeType, bucket);
    
    // 5. Create asset record
    const asset = await this.prisma.fileAsset.create({ ... });
    
    // 6. Return result
    return {
      success: true,
      newResult: {
        selectedOutputIndex: 0,
        outputs: [{
          items: [{
            type: DataType.Image,
            data: { entity: asset },
            outputHandleId: outputHandle.id
          }]
        }]
      }
    };
  }
}
```

### Node Registration

Nodes are dynamically discovered and registered at startup:

```typescript
// apps/gatewai-backend/src/node-discovery.ts
async function discoverNodes() {
  const nodesDir = path.resolve(__dirname, "../../../nodes");
  const entries = fs.readdirSync(nodesDir)
    .filter(d => d.startsWith("node-") && isDirectory);
  
  for (const dir of entries) {
    const pkg = JSON.parse(readFile(`nodes/${dir}/package.json`));
    const entryPath = `${pkg.name}/server`;  // Dynamic import
    discovered.push({ name: pkg.name, server: () => import(entryPath) });
  }
  return discovered;
}

// apps/gatewai-backend/src/register-nodes.ts
export const registerNodes = async () => {
  const nodes = await discoverNodes();
  for (const entry of nodes) {
    const mod = await entry.server();
    if (mod.default) {
      nodeRegistry.register(mod.default);  // Register manifest + processor
    }
  }
};
```

---

## Data Types

### OutputItem Structure

```typescript
// Generic output item
type OutputItem<R extends DataType> = {
  type: R;
  data: DataForType<R>;
  outputHandleId: string | undefined;
};

// Data type mappings
type DataForType<R extends DataType> = R extends "Text"
  ? string
  : R extends "Number"
    ? number
    : R extends "Boolean"
      ? boolean
      : R extends "Image" | "Audio"
        ? FileData
        : R extends "Video"
          ? VirtualMediaData
          : never;

// Node result structure
type NodeResult = {
  selectedOutputIndex: number;
  outputs: Array<{
    items: OutputItem<DataType>[];
  }>;
};
```

### FileData Structure

```typescript
// For Image and Audio types
type FileData = {
  entity?: FileAsset;  // Database record (for persisted files)
  processData?: {
    dataUrl: string;       // Base64 data URL
    tempKey?: string;     // Temporary storage key
    mimeType?: string;
    width?: number;
    height?: number;
    duration?: number;     // ms
    fps?: number;
  };
};
```

### VirtualMediaData Structure

**The native video type that enables zero-cost node chaining:**

```typescript
type VirtualMediaData = {
  metadata: VideoMetadata;
  operation: VideoOperation;
  children: VirtualMediaData[];
};

type VideoMetadata = {
  width?: number;
  height?: number;
  durationMs?: number;
  fps?: number;
};

// Video operations (appended to create chains)
type VideoOperation = 
  | { op: "source"; source: VideoSource; sourceMeta: VideoMetadata }
  | { op: "text"; text: string; metadata?: VideoMetadata }
  | { op: "crop"; leftPercentage: number; topPercentage: number; widthPercentage: number; heightPercentage: number; metadata?: VideoMetadata }
  | { op: "cut"; startSec: number; endSec: number | null; metadata?: VideoMetadata }
  | { op: "speed"; rate: number; metadata?: VideoMetadata }
  | { op: "filter"; filters: VideoFilters; metadata?: VideoMetadata }
  | { op: "flip"; horizontal: boolean; vertical: boolean; metadata?: VideoMetadata }
  | { op: "rotate"; degrees: number; metadata?: VideoMetadata }
  | { op: "layer"; x: number; y: number; width?: number; height?: number; ...; metadata?: VideoMetadata }
  | { op: "compose"; width: number; height: number; fps: number; durationInFrames: number; metadata?: VideoMetadata };

type VideoFilters = {
  cssFilters?: {
    brightness?: number;    // 0-200, default 100
    contrast?: number;      // 0-200, default 100
    saturation?: number;     // 0-200, default 100
    hueRotate?: number;     // -180 to 180
    blur?: number;          // 0-20
    grayscale?: number;     // 0-100
    sepia?: number;         // 0-100
    invert?: number;        // 0-100
  };
};
```

---

## Agent System

### Multi-Agent Architecture

The agent system uses a multi-agent approach powered by OpenAI Agents SDK:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT SYSTEM ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

User Message
     │
     ▼
┌─────────────────┐
│  Orchestrator   │ ◄─── Gemini 3 (Main agent)
│    Agent        │
└────────┬────────┘
         │
         ├── Tool: get_canvas_state     → Read current graph
         ├── Tool: propose_patch        → Generate changes
         ├── Tool: apply_patch          → Apply changes (with validation)
         │
         ▼
┌─────────────────┐
│   Patcher       │ ◄─── Specialized sub-agent
│   Sub-Agent     │     (Code generation for graph manipulation)
└─────────────────┘
```

### Agent Session Flow

```typescript
// apps/gatewai-backend/src/agent/runner/index.ts
export async function* RunCanvasAgent({
  canvasId,
  sessionId,
  userMessage,
  model,
  signal
}) {
  // 1. Create agent session
  const session = new PrismaAgentSession({ sessionId, canvasId });
  
  // 2. Create MCP tool for tool calls
  const mcpTool = createGatewaiMCPTool(authHeaders);
  
  // 3. Create orchestrator agent
  const agent = await CreateOrchestratorAgentForCanvas({
    canvasId,
    session,
    modelName: model,
    mcpTool
  });
  
  // 4. Run agent with streaming
  const result = await run(agent, userMessage, {
    stream: true,
    session,
    signal
  });
  
  // 5. Yield chunks to client
  for await (const chunk of result.toStream()) {
    yield chunk;
  }
}
```

### MCP Tools

```typescript
// Gatewai MCP tools available to agents
const gatewaiMCPTools = {
  // Canvas operations
  get_canvas_state: "Get current canvas nodes, edges, and handles",
  get_node_result: "Get result of a specific node",
  
  // Graph manipulation
  propose_patch: "Generate proposed changes to canvas",
  apply_patch: "Apply validated changes to canvas",
  
  // Execution
  run_canvas: "Execute the canvas workflow",
  get_task_status: "Get status of execution tasks",
  
  // Node info
  get_node_templates: "List available node types",
  get_node_schema: "Get configuration schema for a node type"
};
```

---

## API Endpoints

### Core REST API Routes

| Route | Description |
|-------|-------------|
| `POST /api/v1/canvas` | Create new canvas |
| `GET /api/v1/canvas/:id` | Get canvas entities |
| `PUT /api/v1/canvas/:id` | Update canvas |
| `POST /api/v1/canvas/:id/run` | Run canvas workflow |
| `GET /api/v1/canvas/:id/tasks` | Get task status |
| `GET /api/v1/nodes` | List registered nodes |
| `GET /api/v1/node-templates` | List node templates |
| `POST /api/v1/assets` | Upload asset |
| `GET /api/v1/assets/:id` | Get asset |
| `GET /api/v1/fonts` | List available fonts |
| `POST /api/v1/api-run` | Headless canvas execution |
| `GET /api/v1/api-keys` | Manage API keys |

### WebSocket / Real-time

| Channel | Description |
|---------|-------------|
| `agent:session:{sessionId}` | Agent streaming events |
| `agent:session:{sessionId}:accumulated` | Accumulated text |
| `agent:session:{sessionId}:stop` | Stop signal |

---

## Authentication

### Authentication Flow

```typescript
// apps/gatewai-backend/src/auth.ts
const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  plugins: [apiKey({ apiKeyHeaders: "X-API-KEY" })]
});

// Middleware supports both session and API key
const authMiddleware = createMiddleware(async (c, next) => {
  const session = c.get("session");
  
  if (session) {
    // User is authenticated via session
    return next();
  }
  
  // Check for API key
  const apiKey = c.req.header("X-API-KEY");
  if (apiKey) {
    const keyRecord = await prisma.apiKey.findUnique({ where: { key: apiKey } });
    if (keyRecord) {
      c.set("user", keyRecord.user);
      c.set("isApiKeyAuth", true);
      return next();
    }
  }
  
  return c.json({ error: "Unauthorized" }, 401);
});
```

---

## Infrastructure

### Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 22+ |
| Framework | Hono.js |
| Database | PostgreSQL (Prisma ORM) |
| Queue | BullMQ + Redis |
| Cache/Pub-Sub | Redis |
| Storage | Google Cloud Storage |
| Auth | Better Auth |
| AI | Google Gemini, Veo |
| Video | Remotion |
| Frontend | React 19, TypeScript, Tailwind |
| Canvas | React Flow |
| Graphics | PixiJS / WebGL |

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=...

# Google Cloud
GCS_ASSETS_BUCKET=gatewai-assets
GOOGLE_AI_API_KEY=...

# Auth
AUTH_SECRET=...
BASE_URL=https://gatewai.studio

# Server
PORT=3000
NODE_ENV=development
```

---

## Current Nodes

| Node | Type | Description |
|------|------|-------------|
| `node-image-gen` | AI | Generate images with Gemini |
| `node-video-gen` | AI | Generate videos with Veo |
| `node-video-compositor` | Video | Multi-layer video composition |
| `node-image-compositor` | Image | Multi-layer image composition |
| `node-import` | IO | File upload |
| `node-export` | IO | Export/download |
| `node-preview` | IO | Preview node |
| `node-llm` | AI | LLM orchestration |
| `node-text-to-speech` | Audio | TTS generation |
| `node-speech-to-text` | Audio | STT transcription |
| `node-paint` | Edit | Canvas painting |
| `node-blur` | Edit | Blur effect |
| `node-crop` | Edit | Crop image |
| `node-resize` | Edit | Resize image |
| `node-modulate` | Edit | Color modulation |
| `node-text` | Content | Text node |
| `node-note` | Utility | Notes |
| `node-text-merger` | Utility | Merge text |

---

## Summary

Gatewai is a sophisticated node-based workflow engine that:

1. **Visual Graph Building**: Users create workflows by connecting nodes on a canvas
2. **Hybrid Processing**: Preview runs in-browser, production runs on backend workers
3. **Dependency Resolution**: Topological sorting ensures correct execution order
4. **Virtual Video Type**: Enables efficient video node chaining without intermediate renders
5. **AI Integration**: Native support for Gemini, Veo, and custom AI models
6. **Agent Assistance**: Multi-agent system for natural language workflow control
7. **Headless API**: Full programmatic access without browser UI

The architecture prioritizes:
- **Extensibility**: New nodes can be added as packages
- **Scalability**: BullMQ workers process nodes in parallel
- **Reliability**: Task batching with failure propagation
- **Real-time**: WebSocket/Redis for live updates
