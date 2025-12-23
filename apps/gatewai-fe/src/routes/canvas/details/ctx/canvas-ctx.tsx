import { useMutation, useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type PropsWithChildren, type RefObject, type SetStateAction } from 'react';
import {
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
import type { DataType, NodeResult, NodeType } from '@gatewai/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { setAllNodeEntities, nodeSelectors, type NodeEntityType } from '@/store/nodes';
import { generateId } from '@/lib/idgen';
import { createNodeEntity } from '@/store/nodes';
import { rpcClient } from '@/rpc/client';
import type { CanvasDetailsNode, CanvasDetailsRPC, NodeTemplateListItemRPC, PatchCanvasRPCReq } from '@/rpc/types';
import { createNode, onEdgeChange, onNodeChange, selectRFEdges, selectRFNodes, setEdges, setNodes } from '@/store/rfstate';
import { toast } from 'sonner';

interface CanvasContextType {
  canvas: CanvasDetailsRPC | undefined;
  onNodesChange: OnNodesChange<Node>;
  onEdgesChange: OnEdgesChange<Edge>;
  isLoading: boolean;
  isError: boolean;
  tool: 'select' | 'pan';
  setTool: Dispatch<SetStateAction<'select' | 'pan'>>;
  onConnect: OnConnect;
  runNodes: (nodeIds: Node["id"][]) => Promise<void>;
  rfInstance: RefObject<ReactFlowInstance | undefined>;
  createNewNode: (template: NodeTemplateListItemRPC, position: XYPosition) => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

const fetchCanvas = async (canvasId: string): Promise<CanvasDetailsRPC> => {
  // Replace with your actual API endpoint
  const response = await rpcClient.api.v1.canvas[':id'].$get({
    param: {
      id: canvasId,
    }
  });
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const data: Promise<CanvasDetailsRPC> = response.json();

  return data;
};


const CanvasProvider = ({
  canvasId,
  children,
}: PropsWithChildren<{
  canvasId: string;
}>) => {

  const dispatch = useAppDispatch();
  const rfInstance = useRef<ReactFlowInstance | undefined>(undefined);
  const nodeEntities = useAppSelector(nodeSelectors.selectAll);
  const rfNodes = useAppSelector(selectRFNodes);
  const {
    data: canvas,
    isLoading,
    isError,
  } = useQuery<CanvasDetailsRPC>({
    queryKey: ['canvas', canvasId],
    queryFn: () => fetchCanvas(canvasId),
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    enabled: !!canvasId,
  });

  const { initialEdges, initialNodes } = useMemo(() => {
    if (!canvas?.nodes) {
      return { initialEdges: [], initialNodes: [] };
    }
    // Map your backend data to React Flow nodes
    const initialNodes: Node[] = canvas.nodes.map((node) => ({
      id: node.id,
      position: node.position as XYPosition,
      data: node,
      type: node.type,
      width: node.width ?? undefined,
      height: node.height ?? undefined,
      draggable: node.draggable ?? true,
      selectable: node.selectable ?? true,
      deletable: node.deletable ?? true,
    }));

    // Map backend edges to React Flow edges with handle support
    const initialEdges: Edge[] = canvas.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandleId || undefined,
      targetHandle: edge.targetHandleId || undefined,
      data: { dataType: edge.dataType },
    }));

    return { initialEdges, initialNodes };
  }, [canvas]);

  console.log({initialEdges})
  useEffect(() => {
    if (canvas?.nodes) {
      dispatch(setAllNodeEntities(canvas.nodes))
    }
    console.log("Setting mock nodes in store")
  }, [dispatch, canvas])

  const nodes = useAppSelector(selectRFNodes);
  const edges = useAppSelector(selectRFEdges);
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { mutateAsync: patchCanvasAsync } = useMutation({
    mutationFn: async (body: PatchCanvasRPCReq["json"]) => {
      const response = await rpcClient.api.v1.canvas[":id"]["$patch"]({
        json: body,
        param: {
          id: canvasId
        }
      })
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      console.log("Save success")
    },
    onError: (error) => {
      console.error('Save failed:', error);
    },
  });

  const { mutateAsync: runNodesMutateAsync } = useMutation({
    mutationFn: async (body: { nodeIds: CanvasDetailsNode["id"][] }) => {
      const response = await fetch(`/api/v1/canvas/${canvasId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      console.log('Run initiated successfully');
    },
    onError: (error) => {
      console.error('Save failed:', error);
    },
  });

  const save = useCallback(() => {
    if (!canvasId) return;

    const currentCanvasDetailsNodes = nodeEntities.map((n) => {
      const rfNode = rfNodes.find(f => f.id === n.id);
      if (!rfNode) {
        return undefined;
      }
      return {
        ...n,
        position: rfNode.position,
        width: rfNode.width ?? undefined,
        zIndex: (n.zIndex ?? undefined),
      }
    }).filter(f => !!f);

    const currentDbEdges: PatchCanvasRPCReq["json"]["edges"] = edges.map((e) => {
      if (!e.data?.dataType) {
        throw new Error("Datatype is missing");
      }
      return {
        id: e.id,
        source: e.source,
        target:e.target,
        targetHandleId: e.targetHandle as string,
        sourceHandleId: e.sourceHandle as string,
        dataType: e.data.dataType as DataType,
      };
    });

    const body: PatchCanvasRPCReq["json"] = {
      nodes: currentCanvasDetailsNodes,
      edges: currentDbEdges,
    };

    return patchCanvasAsync(body);
  }, [canvasId, nodeEntities, edges, patchCanvasAsync, rfNodes]);

  const scheduleSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      save();
    }, 5000);
  }, [save]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      console.log({changes})
      dispatch(onNodeChange(changes));
      scheduleSave();
    },
    [dispatch, scheduleSave]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
        dispatch(onEdgeChange(changes));
      scheduleSave();
    },
    [dispatch, scheduleSave]
  );

  
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

      // Recursive function: does this node (or any of its descendants) include the target?
      const hasOutgoerAsTarget = (node: Node, visited = new Set<string>()): boolean => {
        if (visited.has(node.id)) return false;
        visited.add(node.id);

        const outgoers = getOutgoers(node, nodes, edges);

        for (const outgoer of outgoers) {
          if (outgoer.id === connection.target) return true;
          if (hasOutgoerAsTarget(outgoer, visited)) return true;
        }
        return false;
      };

      // Invalid if the target is reachable downstream from the source (creates a cycle)
      if (hasOutgoerAsTarget(sourceNode)) {
        return { isValid: false, error: 'Looping connection is not valid.' };
      }

      // Validate if data types for handles match
      const sourceDbNode = sourceNode.data as CanvasDetailsRPC["nodes"][0];
      const sourceHandle = sourceDbNode.handles.find(h => h.id === connection.sourceHandle);

      const targetDbNode = targetNode.data as CanvasDetailsRPC["nodes"][0];
      const targetHandle = targetDbNode.handles.find(h => h.id === connection.targetHandle);

      if (!sourceHandle || !targetHandle) {
        return { isValid: false, error: 'Source or target handle could not be found.' };
      }

      const sourceDataType = sourceHandle.dataType;
      const targetDataType = targetHandle.dataType;

      // Handle 'Any' data type - accepts any connection
      if (sourceDataType === 'Any' || targetDataType === 'Any') {
        return { isValid: true };
      }

      // Handle VideoLayer - accepts Video or Audio
      if (targetDataType === 'VideoLayer') {
        if (sourceDataType === 'Video' || sourceDataType === 'Audio') {
          return { isValid: true };
        }
        return { isValid: false, error: 'VideoLayer only accepts Video or Audio data types.' };
      }

      // Handle DesignLayer - accepts Text, Image, or Mask
      if (targetDataType === 'DesignLayer') {
        if (sourceDataType === 'Text' || sourceDataType === 'Image' || sourceDataType === 'Mask') {
          return { isValid: true };
        }
        return { isValid: false, error: 'DesignLayer only accepts Text, Image, or Mask data types.' };
      }

      // For all other cases, data types must match exactly
      if (sourceDataType !== targetDataType) {
        return { isValid: false, error: `Data types do not match: ${sourceDataType} → ${targetDataType}` };
      }

      return { isValid: true };
    },
    [nodes, edges],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      console.log({params})
      const { isValid, error } = isValidConnection(params);
      if (!isValid) {
        if (error) {
          toast.error(error);
        }
        return;
      }
      // Determine dataType based on source handle
      const sourceNode = nodes.find(n => n.id === params.source);
      const dbNode = sourceNode?.data as CanvasDetailsNode;
      const sourceHandle = dbNode.handles.find(h => h.id === params.sourceHandle);
      if (!sourceHandle) {
        throw new Error("Source handle could not be found");
      }
      const dataType = sourceHandle.dataType;
      console.log(sourceNode?.data)
      const newEdges = (() => {
        // Find if there's an existing edge connected to the same target and targetHandle
        const existingEdge = edges.find(
          (e) =>
            e.target === params.target &&
            e.targetHandle === (params.targetHandle || undefined)
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
            data: { dataType },
          } as Edge,
        ];

        return updatedEdges;
      })();

      dispatch(setEdges(newEdges));

      // Schedule save after connect
      scheduleSave();
    },
    [nodes, dispatch, scheduleSave, edges]
  );

  const runNodes = useCallback(async (nodeIds: Node["id"][]) => {
    // Save before running
    await save();

    await runNodesMutateAsync({ nodeIds });
  }, [runNodesMutateAsync, save])

  useEffect(() => {
    dispatch(setNodes(initialNodes));
    dispatch(setEdges(initialEdges));
  }, [dispatch, initialEdges, initialNodes]);

  const createNewNode = useCallback((template: NodeTemplateListItemRPC, position: XYPosition) => {
    const id = generateId();
    let initialResult: NodeResult | null = null;

    const handles = template.templateHandles.map((tHandle, i) => ({
        nodeId: id,
        label: tHandle.label,
        order: i,
        templateHandleId: tHandle.id,
        id: generateId(),
        required: tHandle.required,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: tHandle.type,
        dataType: tHandle.dataType,
    }));

    if (template.type === 'Text') {
      initialResult = {
        selectedOutputIndex: 0,
        outputs: [{
          items: [{type: 'Text', outputHandleId: handles[0].id, data: ''}]
        }]
      }
    }

    const nodeEntity: NodeEntityType = {
      id,
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
      result: initialResult as unknown,
    };
    const newNode: Node = {
      id,
      position,
      data: nodeEntity,
      type: template.type as NodeType,
      width: 300,
      height: undefined,
      draggable: true,
      selectable: true,
      deletable: true,
    };
    console.log({nodeEntity})
    dispatch(createNode(newNode));
    dispatch(createNodeEntity(nodeEntity));
    scheduleSave();
  }, [canvasId, dispatch, scheduleSave]);
  
  const value = {
    canvas,
    setNodes,
    onNodesChange,
    onEdgesChange,
    isLoading,
    isError,
    tool,
    setTool,
    onConnect,
    runNodes,
    rfInstance,
    createNewNode
  };

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