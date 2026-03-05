/**
 * patcher-helpers.ts
 *
 * A self-contained JavaScript library injected verbatim into the QuickJS
 * sandbox before the patcher agent's user code runs.
 *
 * All functions run *inside* the VM — no host imports, no async.
 *
 * Design goals:
 *  1. Eliminate the #1 class of patcher failures: malformed nodes/handles/edges.
 *  2. Encode every hard rule from the system prompt as a throwing guard.
 *  3. Keep the LLM's task to high-level intent, not boilerplate wiring.
 */

export const PATCHER_HELPERS_CODE = /* js */ `
// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Assert a condition; throw a descriptive Error if false. */
function _assert(condition, message) {
  if (!condition) throw new Error('[PatcherHelper] ' + message);
}

/** Return the first element of arr matching predicate, or throw. */
function _require(arr, predicate, notFoundMsg) {
  const found = arr.find(predicate);
  _assert(found !== undefined, notFoundMsg);
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
//  TEMPLATE LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * findTemplate(type)
 * Look up a NodeTemplate by its type string.
 * Throws with the full list of valid types when not found.
 *
 * @param {string} type  e.g. 'Text', 'VideoGen', 'VideoCompositor'
 * @returns {NodeTemplate}
 */
function findTemplate(type) {
  const t = templates.find((t) => t.type === type);
  if (!t) {
    const available = templates.map((t) => t.type).sort().join(', ');
    throw new Error(
      \`[PatcherHelper] Unknown node type "\${type}". Available: [\${available}]\`
    );
  }
  return t;
}

/**
 * listTemplates()
 * Returns a plain array of { type, handleCount } for quick inspection.
 */
function listTemplates() {
  return templates.map((t) => ({
    type: t.type,
    handleCount: t.templateHandles.length,
    handles: t.templateHandles.map((h) => ({
      type: h.type,
      label: h.label,
      dataTypes: h.dataTypes,
      required: h.required ?? false,
    })),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  NODE CREATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createNode(options)
 * Instantiate a node + all its handles from a template.
 * Mutates the shared \`nodes\` and \`handles\` arrays.
 * Returns { node, inputHandles, outputHandles, allHandles, nodeId }.
 *
 * @param {{ type: string, name?: string, position?: {x,y}, config?: object }} options
 *
 * Example:
 *   const { node, outputHandles } = createNode({ type: 'Text', name: 'Intro', position: { x: 100, y: 200 } });
 */
function createNode({ type, name, position = { x: 0, y: 0 }, config = {} }) {
  _assert(type, 'createNode: "type" is required');
  const template = findTemplate(type);

  const nodeId = generateId();
  const createdHandles = [];

  template.templateHandles.forEach((th) => {
    createdHandles.push({
      id: generateId(),
      type: th.type,                 // 'Input' | 'Output'  — copied exactly
      dataTypes: th.dataTypes,       // copied exactly
      label: th.label,               // copied exactly
      order: th.order,
      nodeId,
      required: th.required ?? false,
      templateHandleId: th.id,       // critical linkage
    });
  });

  const node = {
    id: nodeId,
    name: name ?? type,
    type: template.type,
    templateId: template.id,
    position,
    width: 340,
    config,
  };

  nodes.push(node);
  createdHandles.forEach((h) => handles.push(h));

  const inputHandles  = createdHandles.filter((h) => h.type === 'Input');
  const outputHandles = createdHandles.filter((h) => h.type === 'Output');

  return { node, nodeId, allHandles: createdHandles, inputHandles, outputHandles };
}

// ─────────────────────────────────────────────────────────────────────────────
//  HANDLE LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getHandles(nodeId)
 * Return all handles for a given node, split by type.
 *
 * @param {string} nodeId
 * @returns {{ inputHandles: Handle[], outputHandles: Handle[], allHandles: Handle[] }}
 */
function getHandles(nodeId) {
  const all = handles.filter((h) => h.nodeId === nodeId);
  return {
    allHandles:    all,
    inputHandles:  all.filter((h) => h.type === 'Input'),
    outputHandles: all.filter((h) => h.type === 'Output'),
  };
}

/**
 * getHandle(nodeId, label, handleType?)
 * Find a specific handle by its label (and optional type).
 * Throws if not found.
 *
 * @param {string}           nodeId
 * @param {string}           label       e.g. 'Prompt', 'Image 1'
 * @param {'Input'|'Output'} [handleType]
 */
function getHandle(nodeId, label, handleType) {
  return _require(
    handles,
    (h) =>
      h.nodeId === nodeId &&
      h.label === label &&
      (handleType == null || h.type === handleType),
    \`getHandle: no \${handleType ?? ''} handle labeled "\${label}" on node \${nodeId}\`
  );
}

/**
 * getOutputHandle(nodeId, label?)
 * Return the first Output handle of a node, optionally filtered by label.
 */
function getOutputHandle(nodeId, label) {
  return _require(
    handles,
    (h) => h.nodeId === nodeId && h.type === 'Output' && (label == null || h.label === label),
    \`getOutputHandle: no Output handle\${label ? \` labeled "\${label}"\` : ''} on node \${nodeId}\`
  );
}

/**
 * getInputHandle(nodeId, label?)
 * Return the first Input handle of a node, optionally filtered by label.
 */
function getInputHandle(nodeId, label) {
  return _require(
    handles,
    (h) => h.nodeId === nodeId && h.type === 'Input' && (label == null || h.label === label),
    \`getInputHandle: no Input handle\${label ? \` labeled "\${label}"\` : ''} on node \${nodeId}\`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  EDGE CREATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * connectHandles(sourceHandle, targetHandle)
 * Create an edge between two already-resolved Handle objects.
 * Enforces: compatible dataTypes, unoccupied target, no self-loop.
 * Mutates \`edges\`. Returns the new edge.
 *
 * @param {Handle} sourceHandle  Must be type 'Output'
 * @param {Handle} targetHandle  Must be type 'Input'
 */
function connectHandles(sourceHandle, targetHandle) {
  _assert(sourceHandle, 'connectHandles: sourceHandle is null/undefined');
  _assert(targetHandle, 'connectHandles: targetHandle is null/undefined');
  _assert(
    sourceHandle.type === 'Output',
    \`connectHandles: sourceHandle "\${sourceHandle.label}" (id:\${sourceHandle.id}) must be type Output, got \${sourceHandle.type}\`
  );
  _assert(
    targetHandle.type === 'Input',
    \`connectHandles: targetHandle "\${targetHandle.label}" (id:\${targetHandle.id}) must be type Input, got \${targetHandle.type}\`
  );
  _assert(
    sourceHandle.nodeId !== targetHandle.nodeId,
    \`connectHandles: self-loop detected — source and target are on the same node (\${sourceHandle.nodeId})\`
  );

  // dataType compatibility
  const shared = (sourceHandle.dataTypes ?? []).filter((dt) =>
    (targetHandle.dataTypes ?? []).includes(dt)
  );
  _assert(
    shared.length > 0,
    \`connectHandles: incompatible dataTypes — source \${JSON.stringify(sourceHandle.dataTypes)} vs target \${JSON.stringify(targetHandle.dataTypes)}\`
  );

  // Input occupancy
  const occupied = edges.some((e) => e.targetHandleId === targetHandle.id);
  _assert(
    !occupied,
    \`connectHandles: Input handle "\${targetHandle.label}" (id:\${targetHandle.id}) on node \${targetHandle.nodeId} already has an incoming edge\`
  );

  const edge = {
    id: generateId(),
    source: sourceHandle.nodeId,
    target: targetHandle.nodeId,
    sourceHandleId: sourceHandle.id,
    targetHandleId: targetHandle.id,
  };
  edges.push(edge);
  return edge;
}

/**
 * connect(sourceNodeId, targetNodeId, sourceLabel?, targetLabel?)
 * High-level shorthand: resolve handles by node IDs (+ optional labels) then connect.
 * Throws on any violation.
 *
 * @param {string} sourceNodeId
 * @param {string} targetNodeId
 * @param {string} [sourceLabel]  Disambiguate when a node has multiple Output handles
 * @param {string} [targetLabel]  Disambiguate when a node has multiple Input handles
 */
function connect(sourceNodeId, targetNodeId, sourceLabel, targetLabel) {
  const src = getOutputHandle(sourceNodeId, sourceLabel);
  const tgt = getInputHandle(targetNodeId, targetLabel);
  return connectHandles(src, tgt);
}

/**
 * tryConnect(sourceNodeId, targetNodeId, sourceLabel?, targetLabel?)
 * Like connect() but returns null instead of throwing on failure.
 * Logs the reason via console.log.
 */
function tryConnect(sourceNodeId, targetNodeId, sourceLabel, targetLabel) {
  try {
    return connect(sourceNodeId, targetNodeId, sourceLabel, targetLabel);
  } catch (e) {
    console.log('[tryConnect skipped]', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  NODE LOOKUP / MUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * findNode(predicate | id)
 * Find an existing node by ID string or arbitrary predicate.
 * Throws if not found.
 *
 * @param {string | ((n: Node) => boolean)} predicateOrId
 */
function findNode(predicateOrId) {
  const pred =
    typeof predicateOrId === 'string'
      ? (n) => n.id === predicateOrId
      : predicateOrId;
  return _require(nodes, pred, \`findNode: no node matched "\${predicateOrId}"\`);
}

/**
 * findNodeByName(name)
 * Case-sensitive name lookup.
 */
function findNodeByName(name) {
  return _require(nodes, (n) => n.name === name, \`findNodeByName: no node named "\${name}"\`);
}

/**
 * findNodesByType(type)
 * Returns all nodes of a given template type.
 */
function findNodesByType(type) {
  return nodes.filter((n) => n.type === type);
}

/**
 * updateNodeConfig(nodeId, patch)
 * Shallow-merge \`patch\` into node.config.
 * Safe to call multiple times.
 *
 * @param {string} nodeId
 * @param {object} patch
 */
function updateNodeConfig(nodeId, patch) {
  const node = findNode(nodeId);
  node.config = Object.assign({}, node.config ?? {}, patch);
  return node;
}

/**
 * moveNode(nodeId, position)
 * Update a node's position.
 *
 * @param {string}         nodeId
 * @param {{ x: number, y: number }} position
 */
function moveNode(nodeId, position) {
  const node = findNode(nodeId);
  node.position = position;
  return node;
}

// ─────────────────────────────────────────────────────────────────────────────
//  NODE REMOVAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * removeNode(nodeId)
 * Delete a node and all its handles and incident edges from the canvas.
 * Safe to call even if the node does not exist (no-op with a console.log).
 *
 * @param {string} nodeId
 */
function removeNode(nodeId) {
  const nodeIdx = nodes.findIndex((n) => n.id === nodeId);
  if (nodeIdx === -1) {
    console.log(\`[removeNode] Node \${nodeId} not found — skipping\`);
    return;
  }

  // Collect handle IDs before removing them
  const nodeHandleIds = new Set(
    handles.filter((h) => h.nodeId === nodeId).map((h) => h.id)
  );

  // Remove incident edges
  for (let i = edges.length - 1; i >= 0; i--) {
    const e = edges[i];
    if (
      e.source === nodeId ||
      e.target === nodeId ||
      nodeHandleIds.has(e.sourceHandleId) ||
      nodeHandleIds.has(e.targetHandleId)
    ) {
      edges.splice(i, 1);
    }
  }

  // Remove handles
  for (let i = handles.length - 1; i >= 0; i--) {
    if (handles[i].nodeId === nodeId) handles.splice(i, 1);
  }

  // Remove node
  nodes.splice(nodeIdx, 1);
}

/**
 * removeEdge(sourceNodeId, targetNodeId, sourceLabel?, targetLabel?)
 * Delete a specific edge by its endpoint nodes (and optional handle labels).
 */
function removeEdge(sourceNodeId, targetNodeId, sourceLabel, targetLabel) {
  const idx = edges.findIndex((e) => {
    if (e.source !== sourceNodeId || e.target !== targetNodeId) return false;
    if (sourceLabel != null) {
      const sh = handles.find((h) => h.id === e.sourceHandleId);
      if (!sh || sh.label !== sourceLabel) return false;
    }
    if (targetLabel != null) {
      const th = handles.find((h) => h.id === e.targetHandleId);
      if (!th || th.label !== targetLabel) return false;
    }
    return true;
  });
  _assert(idx !== -1, \`removeEdge: no edge from \${sourceNodeId} → \${targetNodeId}\`);
  edges.splice(idx, 1);
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPOSITOR HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * setCompositorLayer(nodeId, inputHandle, layerConfig)
 * Set or update a single layerUpdates entry on a Compositor node.
 * The key is always the Handle ID — this function enforces that.
 *
 * @param {string} nodeId
 * @param {Handle} inputHandle   The handle object (not its label)
 * @param {{ opacity?: number, blendingMode?: string }} layerConfig
 *
 * Example:
 *   const { node, inputHandles } = createNode({ type: 'VideoCompositor', name: 'Comp' });
 *   setCompositorLayer(node.id, inputHandles[0], { opacity: 1, blendingMode: 'normal' });
 */
function setCompositorLayer(nodeId, inputHandle, layerConfig) {
  _assert(inputHandle, 'setCompositorLayer: inputHandle is null/undefined');
  _assert(
    inputHandle.type === 'Input',
    \`setCompositorLayer: handle "\${inputHandle.label}" is type \${inputHandle.type}, expected Input\`
  );
  _assert(
    inputHandle.nodeId === nodeId,
    \`setCompositorLayer: handle does not belong to node \${nodeId}\`
  );

  const node = findNode(nodeId);
  const currentLayers = (node.config?.layerUpdates) ?? {};
  node.config = {
    ...node.config,
    layerUpdates: {
      ...currentLayers,
      [inputHandle.id]: layerConfig,   // ID, never label
    },
  };
  return node;
}

/**
 * createCompositorNode(options)
 * Create a Compositor/VideoCompositor node and wire up its layerUpdates config
 * from a declarative list of { handle, config } pairs.
 *
 * @param {{
 *   type: 'VideoCompositor' | string,
 *   name?: string,
 *   position?: {x,y},
 *   layers?: Array<{ handleIndex?: number, config?: object }>
 * }} options
 *
 * Example:
 *   const { node, inputHandles } = createCompositorNode({
 *     type: 'VideoCompositor',
 *     name: 'Final Mix',
 *     position: { x: 1200, y: 400 },
 *     layers: [
 *       { handleIndex: 0, config: { opacity: 1, blendingMode: 'normal' } },
 *       { handleIndex: 1, config: { opacity: 0.8, blendingMode: 'screen' } },
 *     ],
 *   });
 */
function createCompositorNode({ type = 'VideoCompositor', name, position = { x: 0, y: 0 }, layers = [] }) {
  const result = createNode({ type, name: name ?? type, position, config: { layerUpdates: {} } });

  layers.forEach(({ handleIndex = 0, config = { opacity: 1, blendingMode: 'normal' } }) => {
    const handle = result.inputHandles[handleIndex];
    _assert(handle, \`createCompositorNode: inputHandles[\${handleIndex}] does not exist (node has \${result.inputHandles.length} input(s))\`);
    setCompositorLayer(result.node.id, handle, config);
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  LAYOUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * autoLayout(nodeIds, options?)
 * Assign non-overlapping positions to a list of nodes in a horizontal row.
 *
 * @param {string[]}  nodeIds
 * @param {{ startX?: number, startY?: number, hSpacing?: number, vSpacing?: number, columns?: number }} [options]
 */
function autoLayout(nodeIds, { startX = 100, startY = 100, hSpacing = 500, vSpacing = 400, columns = 0 } = {}) {
  const cols = columns > 0 ? columns : nodeIds.length;
  nodeIds.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    moveNode(id, { x: startX + col * hSpacing, y: startY + row * vSpacing });
  });
}

/**
 * nextPosition(referenceNodeId, direction?, spacing?)
 * Calculate a position offset from an existing node — handy for placing a new
 * node beside one you just located.
 *
 * @param {string}                          referenceNodeId
 * @param {'right'|'left'|'below'|'above'}  [direction='right']
 * @param {number}                          [spacing=500]
 * @returns {{ x: number, y: number }}
 */
function nextPosition(referenceNodeId, direction = 'right', spacing = 500) {
  const ref = findNode(referenceNodeId);
  const { x, y } = ref.position;
  switch (direction) {
    case 'right': return { x: x + spacing, y };
    case 'left':  return { x: x - spacing, y };
    case 'below': return { x, y: y + spacing };
    case 'above': return { x, y: y - spacing };
    default:      return { x: x + spacing, y };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  INSPECTION / DEBUGGING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * inspectCanvas()
 * Log a human-readable summary of the current canvas state.
 * Use console.log output for debugging inside execute_canvas_code.
 */
function inspectCanvas() {
  console.log('=== Canvas Inspection ===');
  console.log(\`Nodes (\${nodes.length}):\`);
  nodes.forEach((n) => {
    const nh = handles.filter((h) => h.nodeId === n.id);
    const inputs  = nh.filter((h) => h.type === 'Input').map((h) => \`  [IN]  \${h.label} (\${h.dataTypes?.join(',')}) id:\${h.id}\`);
    const outputs = nh.filter((h) => h.type === 'Output').map((h) => \`  [OUT] \${h.label} (\${h.dataTypes?.join(',')}) id:\${h.id}\`);
    console.log(\`  \${n.name} [\${n.type}] id:\${n.id} @ (\${n.position?.x},\${n.position?.y})\`);
    [...inputs, ...outputs].forEach((s) => console.log(s));
  });
  console.log(\`Edges (\${edges.length}):\`);
  edges.forEach((e) => {
    const sh = handles.find((h) => h.id === e.sourceHandleId);
    const th = handles.find((h) => h.id === e.targetHandleId);
    console.log(\`  \${sh?.label ?? '?'} (node:\${e.source}) → \${th?.label ?? '?'} (node:\${e.target})\`);
  });
  console.log('=========================');
}
`;

/**
 * API documentation injected into the patcher agent's system prompt.
 * Keeps the prompt in sync with the actual helper surface automatically.
 */
export const PATCHER_HELPER_API_DOCS = `
### Template Lookup
- \`findTemplate(type)\` → NodeTemplate — throws with valid types on miss
- \`listTemplates()\` → \`[{ type, handleCount, handles }]\` — quick overview of available types

### Node Creation
- \`createNode({ type, name?, position?, config? })\`
  → \`{ node, nodeId, allHandles, inputHandles, outputHandles }\`
  Creates node + all handles from template. Mutates \`nodes\` and \`handles\`.

- \`createCompositorNode({ type?, name?, position?, layers? })\`
  → same as createNode
  Convenience wrapper that also wires \`config.layerUpdates\` from a
  declarative \`layers: [{ handleIndex, config }]\` array.

### Handle Lookup
- \`getHandles(nodeId)\` → \`{ allHandles, inputHandles, outputHandles }\`
- \`getHandle(nodeId, label, handleType?)\` → Handle — throws if not found
- \`getOutputHandle(nodeId, label?)\` → first matching Output handle
- \`getInputHandle(nodeId, label?)\` → first matching Input handle

### Edge / Connection
- \`connectHandles(sourceHandle, targetHandle)\` → Edge
  Low-level. Enforces: Output→Input direction, type compatibility,
  unoccupied target, no self-loops.
- \`connect(sourceNodeId, targetNodeId, sourceLabel?, targetLabel?)\` → Edge
  High-level shorthand — resolves handles then calls connectHandles.
- \`tryConnect(sourceNodeId, targetNodeId, sourceLabel?, targetLabel?)\` → Edge | null
  Like connect() but swallows errors (logs via console.log).

### Node Lookup & Mutation
- \`findNode(idOrPredicate)\` → Node — throws if not found
- \`findNodeByName(name)\` → Node
- \`findNodesByType(type)\` → Node[]
- \`updateNodeConfig(nodeId, patch)\` → Node — shallow-merges patch into config
- \`moveNode(nodeId, { x, y })\` → Node

### Removal
- \`removeNode(nodeId)\` — removes node, its handles, and all incident edges
- \`removeEdge(sourceNodeId, targetNodeId, sourceLabel?, targetLabel?)\`

### Compositor
- \`setCompositorLayer(nodeId, inputHandle, { opacity, blendingMode })\`
  Sets config.layerUpdates[handle.id] — always uses ID, never label.

### Layout
- \`autoLayout(nodeIds, { startX?, startY?, hSpacing?, vSpacing?, columns? })\`
  Assigns grid positions to a list of node IDs.
- \`nextPosition(referenceNodeId, direction?, spacing?)\` → \`{ x, y }\`
  direction: 'right' | 'left' | 'below' | 'above'  (default 'right', spacing 500)

### Debugging
- \`inspectCanvas()\` — logs a full node/handle/edge summary via console.log
`.trim();
