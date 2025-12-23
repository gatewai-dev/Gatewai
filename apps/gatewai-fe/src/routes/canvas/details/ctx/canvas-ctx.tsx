import { useMutation, useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type PropsWithChildren, type RefObject, type SetStateAction } from 'react';
import {
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
import type {AllNodeConfig, DataType, Edge as DbEdge, Node as DbNode, NodeResult, NodeType } from '@gatewai/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { setAllNodeEntities, nodeSelectors, type NodeEntityType } from '@/store/nodes';
import { generateId } from '@/lib/idgen';
import { createNodeEntity } from '@/store/nodes';
import type { NodeTemplateWithIO } from '@/types/node-template';
import { rpcClient } from '@/rpc/client';
import type { CanvasDetailsRPC, PatchCanvasRPCReq } from '@/rpc/types';
import { createNode, onEdgeChange, onNodeChange, selectRFEdges, selectRFNodes, setEdges, setNodes } from '@/store/rfstate';

interface CanvasContextType {
  canvas: CanvasDetailsRPC | undefined;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  onNodesChange: OnNodesChange<Node>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  onEdgesChange: OnEdgesChange<Edge>;
  isLoading: boolean;
  isError: boolean;
  tool: 'select' | 'pan';
  setTool: Dispatch<SetStateAction<'select' | 'pan'>>;
  onConnect: OnConnect;
  runNodes: (nodeIds: Node["id"][]) => Promise<void>;
  rfInstance: RefObject<ReactFlowInstance | undefined>;
  createNewNode: (template: NodeTemplateWithIO, position: XYPosition) => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

interface CanvasProviderProps {
  canvasId: string;
}

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
}: PropsWithChildren<CanvasProviderProps>) => {

  const dispatch = useAppDispatch();
  const rfInstance = useRef<ReactFlowInstance | undefined>(undefined);
  const nodeEntities = useAppSelector(nodeSelectors.selectAll);

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
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
      data: { dataType: edge.dataType },
    }));

    return { initialEdges, initialNodes };
  }, [canvas]);

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
    mutationFn: async (body: { nodeIds: DbNode["id"][] }) => {
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

    const currentDbNodes = nodeEntities.map((n) => {
      return {
        ...n,
      }
    });

    const currentDbEdges: Partial<DbEdge>[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || undefined,
      targetHandle: e.targetHandle || undefined,
      dataType: (e.data?.dataType || 'Text') as DataType,
    }));

    const body = {
      nodes: currentDbNodes,
      edges: currentDbEdges,
    };

    return patchCanvasAsync(body);
  }, [canvasId, nodeEntities, edges, patchCanvasAsync]);

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
    },
    [dispatch]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
        dispatch(onEdgeChange(changes));
    },
    [dispatch]
  );

  const onConnect = useCallback(
    (params: Connection) => {

      // Determine dataType based on source handle
      const sourceNode = nodes.find(n => n.id === params.source);
      const output = sourceNode?.data.template?.outputTypes?.find((o: any) => o.id === params.sourceHandle);
      const dataType = output?.outputType || 'Text';
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

      setEdges(newEdges);

      // Schedule save after connect
      scheduleSave();
    },
    [nodes, edges, scheduleSave]
  );

  const runNodes = useCallback(async (nodeIds: Node["id"][]) => {
    // Save before running
    await save();

    const resp = await runNodesMutateAsync({ nodeIds });
    console.log({resp});
  }, [runNodesMutateAsync, save])

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialEdges, initialNodes]);

  const createNewNode = useCallback((template: NodeTemplateWithIO, position: XYPosition) => {
    const id = generateId();
    console.log({template})
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
      deletable: true,
      config: template.defaultConfig as any || {},
      result: {
        selectedIndex: 0,
        parts: [],
      },
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
    setEdges,
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