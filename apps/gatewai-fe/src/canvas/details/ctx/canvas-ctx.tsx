import { useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react';
import {
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnEdgesChange,
  type OnNodesChange
} from '@xyflow/react';
import type { NodeData, Edge as DbEdge, NodeWithFileType } from '@gatewai/types';

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

    const initialEdges: Edge[] = canvas.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
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

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (isRestoring.current) {
        onNodesChangeBase(changes);
        return;
      }

      past.current = [...past.current, { nodes: [...nodes], edges: [...edges] }];
      future.current = [];
      setCanUndo(past.current.length > 0);
      setCanRedo(false);

      onNodesChangeBase(changes);
    },
    [nodes, edges, onNodesChangeBase]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (isRestoring.current) {
        onEdgesChangeBase(changes);
        return;
      }

      past.current = [...past.current, { nodes: [...nodes], edges: [...edges] }];
      future.current = [];
      setCanUndo(past.current.length > 0);
      setCanRedo(false);

      onEdgesChangeBase(changes);
    },
    [nodes, edges, onEdgesChangeBase]
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