import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type Dispatch, type MouseEvent, type PropsWithChildren, type SetStateAction } from 'react';
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
  type OnNodesChange
} from '@xyflow/react';
import type { NodeData, NodeWithFileType } from '@gatewai/types';

// Updated Edge type from database with handle support
interface DbEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  dataType: string;
  createdAt: Date;
  updatedAt: Date;
}

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
    type: 'Prompt',
    data: {
      data: {
        content: 'ww',
        outputTypes: [
          {
            "id": "i22",
            outputType: 'Prompt',
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
    height: 80,
    type: 'Crawler',
    data: {
      data: {
        url: 'https://google.com',
        inputTypes: [
          {
            "id": "s",
            inputType: 'Prompt',
          }
        ],
        outputTypes: [
          {
            "id": "i22",
            outputType: 'Prompt',
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
      position: {
        x: node.x,
        y: node.y,
      },
      data: node,
      type: node.type,
    }));

    // Map backend edges to React Flow edges with handle support
    const initialEdges: Edge[] = canvas.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
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
    },
    [nodes, edges, onNodesChangeBase]
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
    },
    [nodes, edges, onEdgesChangeBase]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (isRestoring.current) return;

      past.current = [...past.current, { nodes: [...nodes], edges: [...edges] }];
      future.current = [];
      setCanUndo(past.current.length > 0);
      setCanRedo(false);

      // The params object from React Flow already includes sourceHandle and targetHandle
      setEdges(eds => [
        ...eds,
        {
          id: `e${params.source}-${params.target}-${Date.now()}`,
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle || undefined,
          targetHandle: params.targetHandle || undefined,
        } as Edge,
      ]);
    },
    [nodes, edges, setEdges]
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
  }, [nodes, edges, setNodes, setEdges]);

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
  }, [nodes, edges, setNodes, setEdges]);

  // Uncomment when ready to use actual data
  // useEffect(() => {
  //   if (initialNodes) setNodes(initialNodes);
  //   if (initialEdges) setEdges(initialEdges)
  // }, [initialNodes, initialEdges, setNodes, setEdges])

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