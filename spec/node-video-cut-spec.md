# node-video-cut Implementation Spec

## Overview
Implement `node-video-cut` - a node to trim/cut video by specifying start and end times. Uses VirtualMediaData with `cut` operation.

---

## 1. Node Structure

```
nodes/node-video-cut/
├── src/
│   ├── metadata.ts           # Node metadata definition
│   ├── shared/
│   │   ├── config.ts         # Zod schemas (VideoCutConfig, VideoCutResult)
│   │   └── index.ts          # Re-exports
│   ├── browser/
│   │   ├── index.ts          # defineClient()
│   │   └── video-cut-node-component.tsx  # React component with range slider
│   └── server/
│       ├── index.ts          # defineNode()
│       └── processor.ts      # NodeProcessor
├── package.json
└── tsdown.config.ts
```

---

## 2. Implementation Details

### Metadata (`metadata.ts`)
- Type: `VideoCut`
- Display name: "Cut Video"  
- Category: "Video"
- Handles: 1 Video input → 1 Video output
- Default config: `{ startSec: 0, endSec: null }`

### Config Schema (`shared/config.ts`)
```ts
export const VideoCutConfigSchema = z.object({
  startSec: z.number().min(0).default(0),
  endSec: z.number().min(0).nullable().default(null),  // null = to end
});
```

### Server Processor (`server/processor.ts`)
- Uses `appendOperation()` with `{ op: "cut", startSec, endSec }`
- Computes new durationMs: `(endSec - startSec) * 1000`
- Validates: startSec < endSec, endSec <= video duration

### Browser Component (`browser/video-cut-node-component.tsx`)
- **Simple dual-slider UI**: Start time slider + End time slider
- **Video player** shows trimmed result via `durationMs={trimmedDurationMs}`
- **Time display**: formatted as `m:ss.ms` or `h:m:ss.ms`
- **Duration display**: shows resulting clip length

---

## 3. scene.tsx - Already Complete

The cut operation is already implemented in `packages/remotion-compositions/src/compositions/scene.tsx`:

**Rendering** (lines 553-565):
```tsx
if (op.op === "cut") {
  const childVideo = virtualMedia.children[0];
  return (
    <SingleClipComposition
      virtualMedia={childVideo}
      trimStartOverride={(trimStartOverride ?? 0) + op.startSec}
    />
  );
}
```

**Comparison** (lines 178-183):
```tsx
case "cut": {
  if (aOp.startSec !== bCut.startSec || aOp.endSec !== bCut.endSec)
    return false;
  break;
}
```

**No changes needed to scene.tsx.**

---

## 4. Files Created

| File | Status |
|------|--------|
| `nodes/node-video-cut/package.json` | Created |
| `nodes/node-video-cut/tsconfig.json` | Created |
| `nodes/node-video-cut/tsdown.config.ts` | Created |
| `nodes/node-video-cut/src/metadata.ts` | Created |
| `nodes/node-video-cut/src/shared/config.ts` | Created |
| `nodes/node-video-cut/src/shared/index.ts` | Created |
| `nodes/node-video-cut/src/server/processor.ts` | Created |
| `nodes/node-video-cut/src/server/index.ts` | Created |
| `nodes/node-video-cut/src/browser/index.ts` | Created |
| `nodes/node-video-cut/src/browser/video-cut-node-component.tsx` | Created |

---

## 5. Build Status

✅ Build successful - `pnpm --filter @gatewai/node-video-cut build` completes without errors.

---

## 6. Future Improvements (Out of Scope)

As requested by user:
- **Timeline-based UI** with zoom levels (frames/seconds/minutes/hours)
- **Draggable handles** on video timeline (similar to crop node's UX)
- **Waveform visualization**
- **Frame-accurate scrubbing**
