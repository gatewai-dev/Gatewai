# Gatewai Refactoring Report v0.1

## Executive Summary

This is a sophisticated node-based visual workflow platform with **26 custom nodes**, **multiple packages**, and a **complex backend architecture**. While the architecture is well-designed, several areas can be simplified for better maintainability.

---

## Priority 1: High-Impact Refactoring 

### 1.1 Backend: Split `workflow.worker.ts` (725 lines) [DONE]

**Location:** `apps/gatewai-backend/src/graph-engine/queue/workflow.worker.ts`

**Problem:** This file handles too many responsibilities:
- Job processing
- Batch management
- Token reconciliation  
- Failure propagation
- Worker lifecycle

**Solution:** Split into focused modules:
```
src/graph-engine/
├── workers/
│   ├── workflow.worker.ts     # Main entry
│   ├── batch-manager.ts        # Batch lifecycle
│   ├── failure-propagator.ts  # Downstream failure handling
│   └── task-recovery.ts       # Startup recovery
```

---

### 1.2 Backend: Extract Canvas Duplication Logic [DONE]

**Location:** `apps/gatewai-backend/src/routes/v1/canvas.ts` (lines 369-493)

**Problem:** Complex nested loops for mapping nodes, handles, and edges during canvas duplication.

**Solution:** Extract to `src/lib/canvas-duplication.service.ts`

---

### 1.3 Backend: Deduplicate SSE Stream Handling [DONE]

**Location:** `apps/gatewai-backend/src/routes/v1/canvas.ts` (lines 659-695, 710-745)

**Problem:** Nearly identical SSE streaming code appears twice.

**Solution:** Create reusable `createSSEStream()` utility.

---

### 1.4 Backend: Deduplicate API Key Lookup [DONE]

**Problem:** API key lookup pattern repeated in:
- `canvas.ts` (lines 389-396, 519-526)
- `api-run.ts` (lines 155-160)

**Solution:** Create `getUserDefaultApiKey()` utility in `src/lib/`.

---

### 1.5 Backend: Deduplicate Text Extraction

**Location:** `canvas.ts` (lines 532-545, 764-787)

**Problem:** `extractText()` helper appears twice with slightly different logic.

**Solution:** Unify into single utility function.

---

## Priority 2: Node SDK Improvements

### 2.1 Create Abstract Image Processor Base Class [DONE]

**Problem:** Image processing nodes (`blur`, `crop`, `modulate`, `resize`) have nearly identical processor code.

**Current Pattern:**
```typescript
// Repeated in each node:
const imageInput = this.graph.getInputValue(...);
const imageUrl = await this.media.resolveFileDataUrl(imageInput);
const { dataUrl, ...dimensions } = await this.media.backendPixiService.execute(...);
// ... upload to storage, create result
```

**Solution:** Create in `@gatewai/node-sdk`:
```typescript
// server/abstract-image-processor.ts
export abstract class AbstractImageProcessor implements NodeProcessor {
  abstract getPixiRunFunction(): PixiRun;
  
  async process(ctx: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
    // Common image processing logic
  }
}
```

---

### 2.2 Add Result Schema Helpers to SDK

**Problem:** Each node redefines identical result schemas.

**Solution:** Add to `@gatewai/node-sdk/shared/schemas.ts`:
```typescript
export const ImageResultSchema = SingleOutputGenericSchema(
  createOutputItemSchema(z.literal("Image"), FileDataSchema)
);
export const VideoResultSchema = ...
export const TextResultSchema = ...
export const AudioResultSchema = ...
```

---

## Priority 3: Frontend Improvements

### 3.1 Flatten Provider Chain

**Location:** `apps/gatewai-fe/src/routes/canvas/details/index.tsx`

**Problem:** 9 levels of nested providers makes debugging difficult.

**Solution:** Create a composition component:
```tsx
// CanvasProviders.tsx
export function CanvasProviders({ children }) {
  return (
    <NodeTemplateDnDProvider>
      <TaskManagerProvider>
        {/* ... all providers */}
        {children}
      </TaskManagerProvider>
    </NodeTemplateDnDProvider>
  );
}
```

---

### 3.2 Split Large Components [SKIP]

**Location:** `apps/gatewai-fe/src/routes/canvas/home/index.tsx` (520 lines)

**Solution:** Break into:
- `CanvasCard.tsx`
- `EmptyState.tsx`
- `CanvasControls.tsx`
- `useCanvasSearch.ts` (debounce hook)

---

### 3.3 Use Existing Debounce Library [DONE]

**Location:** `canvas/home/index.tsx` (lines 46-73)

**Problem:** Manual debounce implementation when `use-debounce` library exists.

---

### 3.4 Extract Delete Confirmation Dialog

**Problem:** Duplicate delete dialogs in grid/list views.

**Solution:** Create `<DeleteConfirmDialog />` component.

---

## Priority 4: Package Simplification

### 4.1 Remove Redundant Re-exports

**Problem:** `packages/graph-engine/src/node-registry.ts` just re-exports from `@gatewai/node-sdk`.

**Solution:** Remove indirection, import directly from node-sdk.

---

### 4.2 Consolidate React Store

**Problem:** 17+ files in `packages/react-store` may be over-fragmented.

**Solution:** Consider consolidating related state into feature-based modules.

---

## Priority 5: Minor Improvements

| Issue | Location | Fix |
|-------|----------|-----|
| Inconsistent node imports | Various nodes | Standardize on `@gatewai/node-sdk` |
| Inline CSS | `routes/home/index.tsx` | Move to CSS modules |
| Hardcoded polling interval | `user-menu.tsx:22` | Extract to constant |
| Hardcoded demo credentials | `signin-form.tsx:44` | Remove or document |
| Multiple icon libraries | Various | Standardize on `react-icons` by replacing lucide-react ones |

---

## Summary Table

| Priority | Area | Items | Est. Effort |
|----------|------|-------|-------------|
| **P1** | Backend Worker | 5 items | Medium |
| **P2** | Node SDK | 2 items | Medium |
| **P3** | Frontend | 4 items | Low-Medium |
| **P4** | Packages | 2 items | Low |
| **P5** | Minor | 5 items | Low |

---

## Changelog

- **v0.1** (2026-03-05): Initial report created
