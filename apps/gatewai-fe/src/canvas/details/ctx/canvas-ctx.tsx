import { useMutation, useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type MouseEvent, type PropsWithChildren, type SetStateAction } from 'react';
import {
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type XYPosition
} from '@xyflow/react';
import type {DataType, Edge as DbEdge, Node as DbNode, LLMResult, NodeData, NodeType, NodeWithFileType } from '@gatewai/types';

// Assuming a basic structure for the fetched canvas data
interface CanvasResponse {
  id: string;
  name: string;
  nodes: Array<NodeWithFileType<NodeData>>;
  edges: Array<DbEdge>;
}

interface CanvasContextType {
  canvas: CanvasResponse | undefined;
  clientNodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  onNodesChange: OnNodesChange<Node>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  onEdgesChange: OnEdgesChange<Edge>;
  clientEdges: Edge[];
  isLoading: boolean;
  isError: boolean;
  tool: 'select' | 'pan';
  setTool: Dispatch<SetStateAction<'select' | 'pan'>>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onConnect: OnConnect;
  onNodeDragStart: (event: MouseEvent, node: Node, nodes: Node[]) => void;
  updateNodeCustomData: (nodeId: string, updates: Partial<NodeData>) => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

interface CanvasProviderProps {
  canvasId: string;
}

const fetchCanvas = async (canvasId: string): Promise<CanvasResponse> => {
  // Replace with your actual API endpoint
  const response = await fetch(`/api/v1/canvas/${canvasId}`);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

const mock_nodes: Node[] = [
  {
    id: "1",
    position: {
      x: 300,
      y: 360,
    },
    width: 300,
    height: 200,
    type: 'Text',
    data: {
      data: {
        content: 'ww',
        outputTypes: [
          {
            "id": "i22",
            outputType: 'Text',
          }
        ]
      }
    }
  },
  {
    id: "2",
    position: {
      x: 700,
      y: 360,
    },
    width: 300,
    type: 'LLM',
    data: {
      data: {
        result: {
          parts: [{
            type: 'Text',
            data: 'LLM output',
          }]
        } as LLMResult,
        inputTypes: [
          {
            "id": "s1",
            inputType: 'Text',
          }
        ],
        outputTypes: [
          {
            "id": "i22",
            outputType: 'Text',
          }
        ]
      }
    }
  }
]

const CanvasProvider = ({
  canvasId,
  children,
}: PropsWithChildren<CanvasProviderProps>) => {
  const {
    data: canvas,
    isLoading,
    isError,
  } = useQuery<CanvasResponse>({
    queryKey: ['canvas', canvasId],
    queryFn: () => fetchCanvas(canvasId),
    enabled: !!canvasId,
  });

  const { initialNodes, initialEdges } = useMemo(() => {
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

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(mock_nodes);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);
  const past = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const future = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const isRestoring = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { mutate: patchCanvas } = useMutation({
    mutationFn: async (body: { nodes: Partial<DbNode>[]; edges: Partial<DbEdge>[] }) => {
      const response = await fetch(`/api/v1/canvas/${canvasId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response.json();
    },
    onSuccess: () => {
      // Optional: You can add logging or notifications here if needed
    },
    onError: (error) => {
      console.error('Save failed:', error);
    },
  });

  const save = useCallback(() => {
    if (!canvasId) return;

    const currentDbNodes: Partial<DbNode>[] = nodes.map((n) => {
      const nodeData = n.data as NodeWithFileType<NodeData>;

      return {
        id: n.id,
        name: nodeData.name as string,
        type: n.type as NodeType,
        position: n.position as XYPosition,
        width: n.width ?? undefined,
        height: n.height ?? undefined,
        draggable: n.draggable ?? true,
        selectable: n.selectable ?? true,
        deletable: n.deletable ?? true,
        fileData: nodeData.fileData as object | undefined,
        data: nodeData.data as object,
        zIndex: nodeData.zIndex,
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

    patchCanvas(body);
  }, [canvasId, nodes, edges, patchCanvas]);

  const scheduleSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      save();
    }, 5000);
  }, [save]);

  const onNodeDragStart = useCallback((_event: MouseEvent, _node: Node, _draggedNodes: Node[]) => {
    if (isRestoring.current) return;

    past.current = [...past.current, { nodes: [...nodes], edges: [...edges] }];
    future.current = [];
    setCanUndo(past.current.length > 0);
    setCanRedo(false);
  }, [nodes, edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      if (isRestoring.current) {
        onNodesChangeBase(changes);
        return;
      }

      // Ignore pure selection changes for history
      const isOnlySelection = changes.every(c => c.type === 'select');

      // Detect ongoing drag changes
      const isOngoingDrag = changes.every(c => c.type === 'position' && 'dragging' in c && c.dragging);

      if (isOnlySelection || isOngoingDrag) {
        onNodesChangeBase(changes);
        return;
      }

      // Record history for other changes
      past.current = [...past.current, { nodes: [...nodes], edges: [...edges] }];
      future.current = [];
      setCanUndo(past.current.length > 0);
      setCanRedo(false);

      onNodesChangeBase(changes);

      // Schedule save for meaningful changes
      scheduleSave();
    },
    [nodes, edges, onNodesChangeBase, scheduleSave]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      if (isRestoring.current) {
        onEdgesChangeBase(changes);
        return;
      }

      // Ignore pure selection changes for history
      const isOnlySelection = changes.every(c => c.type === 'select');

      if (isOnlySelection) {
        onEdgesChangeBase(changes);
        return;
      }

      // Record history for other changes
      past.current = [...past.current, { nodes: [...nodes], edges: [...edges] }];
      future.current = [];
      setCanUndo(past.current.length > 0);
      setCanRedo(false);

      onEdgesChangeBase(changes);

      // Schedule save for meaningful changes
      scheduleSave();
    },
    [nodes, edges, onEdgesChangeBase, scheduleSave]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (isRestoring.current) return;

      past.current = [...past.current, { nodes: [...nodes], edges: [...edges] }];
      future.current = [];
      setCanUndo(past.current.length > 0);
      setCanRedo(false);

      // Determine dataType based on source handle
      const sourceNode = nodes.find(n => n.id === params.source);
      const output = sourceNode?.data.template?.outputTypes?.find((o: any) => o.id === params.sourceHandle);
      const dataType = output?.outputType || 'Text';

      // The params object from React Flow already includes sourceHandle and targetHandle
      setEdges(eds => [
        ...eds,
        {
          id: `e${params.source}-${params.target}-${Date.now()}`,
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle || undefined,
          targetHandle: params.targetHandle || undefined,
          data: { dataType },
        } as Edge,
      ]);

      // Schedule save after connect
      scheduleSave();
    },
    [nodes, edges, setEdges, scheduleSave]
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;

    const last = past.current.pop()!;
    future.current = [...future.current, { nodes: [...nodes], edges: [...edges] }];

    isRestoring.current = true;
    setNodes([...last.nodes]);
    setEdges([...last.edges]);
    isRestoring.current = false;

    setCanUndo(past.current.length > 0);
    setCanRedo(true);

    // Schedule save after undo
    scheduleSave();
  }, [nodes, edges, setNodes, setEdges, scheduleSave]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;

    const next = future.current.pop()!;
    past.current = [...past.current, { nodes: [...nodes], edges: [...edges] }];

    isRestoring.current = true;
    setNodes([...next.nodes]);
    setEdges([...next.edges]);
    isRestoring.current = false;

    setCanRedo(future.current.length > 0);
    setCanUndo(true);

    // Schedule save after redo
    scheduleSave();
  }, [nodes, edges, setNodes, setEdges, scheduleSave]);

  const updateNodeCustomData = useCallback((nodeId: string, updates: Partial<NodeData>) => {
    if (isRestoring.current) return;

    past.current = [...past.current, { nodes: [...nodes], edges: [...edges] }];
    future.current = [];
    setCanUndo(past.current.length > 0);
    setCanRedo(false);

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              data: {
                ...n.data.data as object,
                ...updates,
              },
            },
          };
        }
        return n;
      })
    );

    scheduleSave();
  }, [nodes, edges, setNodes, scheduleSave]);

  // Uncomment when ready to use actual data
  // useEffect(() => {
  //   if (initialNodes) setNodes(initialNodes);
  //   if (initialEdges) setEdges(initialEdges)
  // }, [initialNodes, initialEdges, setNodes, setEdges])

  useEffect(() => {
    // setNodes(initialNodes);
    setNodes(mock_nodes)
    setEdges(initialEdges);
    past.current = [];
    future.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [initialNodes, initialEdges, setNodes, setEdges]);
  
  const value = {
    canvas,
    clientNodes: nodes,
    setNodes,
    onNodesChange,
    clientEdges: edges,
    setEdges,
    onEdgesChange,
    isLoading,
    isError,
    tool,
    setTool,
    undo,
    redo,
    canUndo,
    canRedo,
    onConnect,
    onNodeDragStart,
    updateNodeCustomData,
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

export { CanvasContext, CanvasProvider };