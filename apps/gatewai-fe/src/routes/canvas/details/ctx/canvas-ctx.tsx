import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type PropsWithChildren, type RefObject } from 'react';
import {
  getConnectedEdges,
  getOutgoers,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
  type XYPosition
} from '@xyflow/react';
import type { NodeResult } from '@gatewai/types';
import { useAppDispatch, useAppSelector, type RootState } from '@/store';
import { setAllNodeEntities, type NodeEntityType, deleteManyNodeEntity } from '@/store/nodes';
import { generateId } from '@/lib/idgen';
import { createNodeEntity } from '@/store/nodes';
import type { CanvasDetailsRPC, NodeTemplateListItemRPC, PatchCanvasRPCParams } from '@/rpc/types';
import { createNode, onEdgeChange, onNodeChange, selectRFEdges, selectRFNodes, setEdges, setNodes } from '@/store/rfstate';
import { toast } from 'sonner';
import { addManyHandleEntities, deleteManyHandleEntity, handleSelectors, setAllHandleEntities } from '@/store/handles';
import { setAllEdgeEntities, type EdgeEntityType } from '@/store/edges';
import { useStore } from 'react-redux';
import { useGetCanvasDetailsQuery, usePatchCanvasMutation, useProcessNodesMutationMutation } from '@/store/canvas';
import { useTaskManagerCtx } from './task-manager-ctx';
import type { NodeType } from '@gatewai/db';

interface CanvasContextType {
  canvas: CanvasDetailsRPC["canvas"] | undefined;
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  isLoading: boolean;
  isError: boolean;
  onConnect: OnConnect;
  runNodes: (node_ids: Node["id"][]) => Promise<void>;
  rfInstance: RefObject<ReactFlowInstance | undefined>;
  createNewNode: (template: NodeTemplateListItemRPC, position: XYPosition) => void;
  onNodesDelete: (deleted: Node[]) => void
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

const CanvasProvider = ({
  canvasId,
  children,
}: PropsWithChildren<{
  canvasId: string;
}>) => {

  const { refetch: refetchTasks, setPollingInterval: setTasksPollingInterval } = useTaskManagerCtx();
  const dispatch = useAppDispatch();
  const store = useStore();
  const rfInstance = useRef<ReactFlowInstance | undefined>(undefined);
  const rfNodes = useAppSelector(selectRFNodes);
  const rfEdges = useAppSelector(selectRFEdges);
  const handleEntities = useAppSelector(handleSelectors.selectAll);

  const {
    data: canvasDetailsResponse,
    isLoading,
    isError,
  } = useGetCanvasDetailsQuery({
    param: {
      id: canvasId
    }
  });

  const { initialEdges, initialNodes } = useMemo(() => {
    if (!canvasDetailsResponse?.nodes) {
      return { initialEdges: [], initialNodes: [] };
    }
    // Map backend data to React Flow nodes
    const initialNodes: Node[] = canvasDetailsResponse.nodes.map((node) => ({
      id: node.id,
      position: node.position as XYPosition,
      data: node, // We're not using this but will track for id etc.
      type: node.type,
      width: node.width ?? undefined,
      height: node.height ?? undefined,
      draggable: node.draggable ?? true,
      selectable: node.selectable ?? true,
      deletable: node.deletable ?? true,
    }));

    // Map backend edges to React Flow edges with handle support
    const initialEdges: Edge[] = canvasDetailsResponse.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandleId || undefined,
      targetHandle: edge.targetHandleId || undefined,
    }));

    return { initialEdges, initialNodes };
  }, [canvasDetailsResponse]);


  useEffect(() => {
    if (canvasDetailsResponse?.nodes) {
      dispatch(setAllNodeEntities(canvasDetailsResponse.nodes))
      dispatch(setAllEdgeEntities(canvasDetailsResponse.edges));
      dispatch(setAllHandleEntities(canvasDetailsResponse.handles));
    }
  }, [dispatch, canvasDetailsResponse])

  const nodes = useAppSelector(selectRFNodes);
  const edges = useAppSelector(selectRFEdges);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [patchCanvasAsync] = usePatchCanvasMutation()
  const [runNodesMutateAsync] = useProcessNodesMutationMutation()

  const save = useCallback(() => {
    if (!canvasId) return;
    const state = store.getState() as RootState;
    const currentNodeEntities = Object.values(state.nodes.entities);
    const currentRfNodes = Object.values(state.reactFlow.nodes);
    const currentEdgeEntities = Object.values(state.edges.entities);
    const currentRfEdges = Object.values(state.reactFlow.edges);
    const currentHandleEntities = Object.values(state.handles.entities);
    const currentCanvasDetailsNodes = currentNodeEntities.map((n) => {
      const rfNode = currentRfNodes.find(f => f.id === n.id);
      if (!rfNode) {
        return undefined;
      }
      return {
        ...n,
        position: rfNode.position,
        width: rfNode.width ?? undefined,
        height: rfNode.height ?? undefined,
        zIndex: (n.zIndex ?? undefined),
      }
    }).filter(f => !!f);
  
    const currentDbEdges: PatchCanvasRPCParams["json"]["edges"] = currentEdgeEntities.map((e) => {
      const rfEdge = currentRfEdges.find(f => f.id === e.id);
      if (!rfEdge || !e) {
        return null;
      }
      return {
        id: e.id,
        source: rfEdge.source,
        target: rfEdge.target,
        targetHandleId: rfEdge.targetHandle as string,
        sourceHandleId: rfEdge.sourceHandle as string,
      };
    }).filter(Boolean) as PatchCanvasRPCParams["json"]["edges"];

    const body: PatchCanvasRPCParams["json"] = {
      nodes: currentCanvasDetailsNodes,
      edges: currentDbEdges,
      handles: currentHandleEntities,
    };

    return patchCanvasAsync({
      json: body,
      param: {
        id: canvasId,
      }
    });
  }, [canvasId, patchCanvasAsync, store]);

  const scheduleSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      save();
    }, 2000);
  }, [save]);

  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    dispatch(onNodeChange(changes));
    scheduleSave();
  }, [dispatch, scheduleSave]);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    dispatch(onEdgeChange(changes));
    scheduleSave();
  }, [dispatch, scheduleSave]);

  
  const isValidConnection = useCallback(
    (connection: Connection | Edge): { isValid: boolean; error?: string } => {
      if (!connection.source || !connection.target) {
        return { isValid: false, error: 'Target or source could not be found.' };
      }

      // Self-connection is always invalid
      if (connection.source === connection.target) {
        return { isValid: false, error: 'Self-connection is not a valid connection.' };
      }

      // Find source node
      const sourceNode = nodes.find((n) => n.id === connection.source);
      if (!sourceNode) {
        return { isValid: false, error: 'Source node could not be found.' };
      }

      // Find target node
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!targetNode) {
        return { isValid: false, error: 'Target node could not be found.' };
      }

      // Check for cycles: adding this edge (source -> target) creates a cycle if there's already a path from target to source
      const isReachable = (fromId: string, toId: string): boolean => {
        const visited = new Set<string>();

        const dfs = (currentId: string): boolean => {
          if (visited.has(currentId)) return false;
          visited.add(currentId);
          if (currentId === toId) return true;

          const currentNode = nodes.find(n => n.id === currentId);
          if (!currentNode) return false;

          const outgoers = getOutgoers(currentNode, nodes, edges);
          for (const outgoer of outgoers) {
            if (dfs(outgoer.id)) return true;
          }

          return false;
        };

        return dfs(fromId);
      };

      if (isReachable(targetNode.id, sourceNode.id)) {
        return { isValid: false, error: 'Looping connection is not valid.' };
      }

      // Validate if data types for handles match
      const sourceHandle = handleEntities.find(h => h.id === connection.sourceHandle);

      const targetHandle = handleEntities.find(h => h.id === connection.targetHandle);

      if (!sourceHandle || !targetHandle) {
        return { isValid: false, error: 'Source or target handle could not be found.' };
      }

      // Ensure source is output and target is input
      if (sourceHandle.type !== 'Output' || targetHandle.type !== 'Input') {
        return { isValid: false, error: 'Can only connect output to input.' };
      }
      console.log(sourceHandle.dataTypes);
      console.log(targetHandle.dataTypes);

      // Prevent one output handle from connecting to multiple inputs on the same target node
      const existingToDifferentHandle = edges.some(
        (e) =>
          e.source === connection.source &&
          e.sourceHandle === connection.sourceHandle &&
          e.target === connection.target &&
          e.targetHandle !== connection.targetHandle
      );

      if (existingToDifferentHandle) {
        return { isValid: false, error: 'Cannot connect one output to multiple inputs on the same node.' };
      }

      return { isValid: true };
    },
    [nodes, handleEntities, edges],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const { isValid, error } = isValidConnection(params);
      if (!isValid) {
        if (error) {
          toast.error(error);
        }
        return;
      }
      const sourceHandle = handleEntities.find(h => h.id === params.sourceHandle);
      if (!sourceHandle) {
        throw new Error("Source handle could not be found");
      }
      const newEdges = (() => {
        // Find if there's an existing edge connected to the same target and targetHandle
        const existingEdge = edges.find(
          (e) =>
            e.target === params.target
            && e.targetHandle === params.targetHandle
        );

        // If found, remove the existing edge
        let updatedEdges = existingEdge
          ? edges.filter((e) => e.id !== existingEdge.id)
          : edges;

        // Add the new edge
        updatedEdges = [
          ...updatedEdges,
          {
            id: `e${params.source}-${params.target}-${Date.now()}`,
            source: params.source,
            target: params.target,
            sourceHandle: params.sourceHandle || undefined,
            targetHandle: params.targetHandle || undefined,
          } as Edge,
        ];

        return updatedEdges;
      })();

      dispatch(setEdges(newEdges));
      const edgeEntities: EdgeEntityType[] = newEdges.map((ne) => ({
        id: ne.id,
        source: ne.source,
        target: ne.target,
        targetHandleId: ne.targetHandle!,
        sourceHandleId: ne.sourceHandle!,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
      dispatch(setAllEdgeEntities(edgeEntities))
      scheduleSave();
    },
    [isValidConnection, handleEntities, dispatch, scheduleSave, edges]
  );

    const onNodesDelete = useCallback(
    (deleted: Node[]) => {

      const deletedNodeIds = deleted.map(m => m.id);
      const newNodes = rfNodes.filter(f => !deletedNodeIds.includes(f.id));
      const edgesToRemove = getConnectedEdges(deleted, rfEdges);
      const deletedEdgeIds = edgesToRemove.map(m => m.id);
      const newEdges = rfEdges.filter(f => !deletedEdgeIds.includes(f.id));
      const deletedHandleIds = handleEntities.filter(m => deletedNodeIds.includes(m.nodeId)).map(m => m.id);
      
      dispatch(setNodes(newNodes))
      dispatch(deleteManyNodeEntity(deletedNodeIds))
      dispatch(setEdges(newEdges))
      dispatch(deleteManyHandleEntity(deletedHandleIds))

      scheduleSave();
    },
    [rfEdges, rfNodes, dispatch, handleEntities, scheduleSave],
  );

  const runNodes = useCallback(async (node_ids: Node["id"][]) => {
    // Save before running
    await save();

    await runNodesMutateAsync(
      {
        param: {
          id: canvasId,
        },
        json: {
          node_ids
        }
      });
      refetchTasks();
      setTasksPollingInterval(2000);
  }, [save, runNodesMutateAsync, refetchTasks, setTasksPollingInterval, canvasId]);

  useEffect(() => {
    dispatch(setNodes(initialNodes));
    dispatch(setEdges(initialEdges));
  }, [dispatch, initialEdges, initialNodes]);

  const createNewNode = useCallback((template: NodeTemplateListItemRPC, position: XYPosition) => {
    const nodeId = generateId();
    let initialResult: NodeResult | null = null;

    const handles = template.templateHandles.map((tHandle, i) => ({
        nodeId: nodeId,
        label: tHandle.label,
        order: i,
        templateHandleId: tHandle.id,
        id: generateId(),
        required: tHandle.required,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: tHandle.type,
        dataTypes: tHandle.dataTypes,
    }));

    if (template.type === 'Text') {
      initialResult = {
        selectedOutputIndex: 0,
        outputs: [{
          items: [{type: 'Text', outputHandleId: handles[0].id, data: ''}]
        }]
      }
    } else {
      initialResult = {
        selectedOutputIndex: 0,
        outputs: []
      }
    }

    const nodeEntity: NodeEntityType = {
      id: nodeId,
      name: template.displayName,
      templateId: template.id,
      template: template,
      type: template.type as NodeType,
      position,
      width: 300,
      height: null,
      isDirty: false,
      canvasId: canvasId,
      zIndex: 1,
      draggable: true,
      selectable: true,
      handles,
      deletable: true,
      config: template.defaultConfig || {},
      result: initialResult as unknown as NodeResult,
    };
    const newNode: Node = {
      id: nodeId,
      position,
      data: nodeEntity,
      type: template.type as NodeType,
      width: 300,
      height: undefined,
      draggable: true,
      selectable: true,
      deletable: true,
    };
    dispatch(createNode(newNode));
    dispatch(createNodeEntity(nodeEntity));
    dispatch(addManyHandleEntities(handles))
    scheduleSave();
  }, [canvasId, dispatch, scheduleSave]);
  
  const value = useMemo(() => ({
    canvas: canvasDetailsResponse?.canvas,
    onNodesChange,
    onEdgesChange,
    isLoading,
    isError,
    onConnect,
    runNodes,
    rfInstance,
    createNewNode,
    onNodesDelete
  }), [
    canvasDetailsResponse?.canvas,
    onNodesChange,
    onEdgesChange,
    isLoading,
    isError,
    onConnect,
    runNodes,
    createNewNode,
    onNodesDelete
  ]);

  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
};

export function useCanvasCtx() {
  const ctx = useContext(CanvasContext);
  if (!ctx) {
    throw new Error('useCanvasCtx should used inside CanvasProvider');
  }
  return ctx;
}

export { CanvasContext, CanvasProvider }