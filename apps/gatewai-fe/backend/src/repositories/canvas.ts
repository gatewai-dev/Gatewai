import { type Canvas, type DataType, prisma } from "@gatewai/db";
import type { NodeResult } from "@gatewai/types";
import type { User } from "better-auth";
import { HTTPException } from "hono/http-exception";

async function GetCanvasEntities(id: Canvas["id"], user: User) {
    const canvas = await prisma.canvas.findFirst({
        where: {
          id,
          userId: user?.id, // Ensure user owns the canvas
        },
    });

    const nodes = await prisma.node.findMany({
        where: {
          canvasId: canvas?.id,
        },
        include: {
          template: true
        }
    })

    if (!canvas) {
        throw new HTTPException(404, { message: 'Canvas not found' });
    }
    
    // Get all edges for this canvas separately for cleaner structure
    const edges = await prisma.edge.findMany({
        where: {
            sourceNode: {
              canvasId: id
            }
        }
    });

    const handles = await prisma.handle.findMany({
        where: {
            nodeId: {
              in: nodes.map(m => m.id),
            }
        }
    })

    return {canvas, nodes, edges, handles}
}

export type CanvasCtxData = Awaited<ReturnType<typeof GetCanvasEntities>>;

/**
 * Options for filtering inputs.
 */
type InputFilterOptions = {
  dataType: DataType;
  label?: string;
};

/**
 * Resolve the actual data value that flows into a target node through an edge.
 */
function resolveSourceValue(
  data: CanvasCtxData,
  edge: CanvasCtxData['edges'][number]
) {
  const sourceHandle = data.handles.find((h) => h.id === edge.sourceHandleId);
  if (!sourceHandle) throw new Error('Source handle missing');

  const sourceNode = data.nodes.find((n) => n.id === sourceHandle.nodeId);
  if (!sourceNode) throw new Error('Source node missing');
  const result = sourceNode.result as NodeResult | null;
  if (!result || result.outputs.length === 0) return null;

  const selected = result.outputs[result.selectedOutputIndex ?? 0];
  const item = selected.items.find((i) => i.outputHandleId === edge.sourceHandleId);
  return item?.data ?? null;
}

/**
 * Get the input value for a given data type on a target node, with optional filters.
 * - required = true → throws if missing
 * - Allows optional inputs (system prompt, image, etc.)
 * - Warns if multiple matching edges exist (takes the first)
 * - If options.label is provided, matches on the target handle's label
 */
function getInputValue(
  data: CanvasCtxData,
  targetNodeId: string,
  required: boolean = true,
  options: InputFilterOptions
) {
  let incoming = data.edges.filter(
    (e) => e.target === targetNodeId
  ).filter((e) => {
    const targetHandle = data.handles.find((h) => h.id === e.targetHandleId);
    return targetHandle?.dataTypes.includes(options.dataType);
  });

  if (options.label) {
    incoming = incoming.filter((e) => {
      const targetHandle = data.handles.find((h) => h.id === e.targetHandleId);
      return targetHandle?.label === options.label;
    });
  }

  if (incoming.length === 0) {
    if (required) {
      throw new Error(`Required ${options.dataType} input${options.label ? ` with label "${options.label}"` : ''} not connected`);
    }
    return null;
  }

  if (incoming.length > 1) {
    console.warn(
      `Multiple ${options.dataType} edges${options.label ? ` with label "${options.label}"` : ''} connected to node ${targetNodeId}. Using the first one.`
    );
  }
  const value = resolveSourceValue(data, incoming[0]);
  if ((value === null || value === undefined) && required) {
    throw new Error(`No value received from ${options.dataType} input${options.label ? ` with label "${options.label}"` : ''}`);
  }

  return value;
}

function getInputValuesByType(
  data: CanvasCtxData,
  targetNodeId: string,
  options: InputFilterOptions
) {
  let incoming = data.edges.filter(
    (e) => e.target === targetNodeId
  ).filter((e) => {
    const targetHandle = data.handles.find((h) => h.id === e.targetHandleId);
    return targetHandle?.dataTypes.includes(options.dataType);
  });

  if (options.label) {
    incoming = incoming.filter((e) => {
      const targetHandle = data.handles.find((h) => h.id === e.targetHandleId);
      return targetHandle?.label === options.label;
    });
  }

  const values = incoming.map(edge => resolveSourceValue(data, edge));
  return values;
}

function getAllOutputHandles(
  data: CanvasCtxData,
  nodeId: string,
) {
  return data.handles.filter(
    (e) => e.nodeId === nodeId
  )
}

function getAllInputValuesWithHandle(
  data: CanvasCtxData,
  targetNodeId: string,
) {
  const incoming = data.edges.filter(
    (e) => e.target === targetNodeId
  )

  const values = incoming.map(edge => ({
    handle: data.handles.find((h) => h.id === edge.targetHandleId),
    value: resolveSourceValue(data, edge)
  }));
  return values;
}

export { GetCanvasEntities, resolveSourceValue, getInputValue, getAllOutputHandles, getAllInputValuesWithHandle, getInputValuesByType }