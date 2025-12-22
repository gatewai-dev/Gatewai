import { useMutation, useQuery } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type MouseEvent, type PropsWithChildren, type RefObject, type SetStateAction } from 'react';
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
  type ReactFlowInstance,
  type XYPosition
} from '@xyflow/react';
import type {AllNodeConfig, DataType, Edge as DbEdge, Node as DbNode, GPTImage1Result, LLMResult, NodeResult, NodeTemplate, NodeType, NodeWithFileType, TextResult } from '@gatewai/types';
import { useAppDispatch } from '@/store';
import { setAllNodes } from '@/store/nodes';
import { generateId } from '@/lib/idgen';
import { createNode } from '@/store/nodes';

type DbNodeWithTemplate = DbNode & {
  template?: NodeTemplate & {
    outputTypes: Array<{
      id: string;
      outputType: DataType;
      label: string;
    }>;
    inputTypes?: Array<{
      id: string;
      inputType: DataType;
      label: string;
    }>;
  };
};
// Assuming a basic structure for the fetched canvas data
interface CanvasResponse {
  id: string;
  name: string;
  nodes: Array<NodeWithFileType<AllNodeConfig, NodeResult>>;
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
  onNodeDragStop: (event: MouseEvent, node: Node, nodes: Node[]) => void;
  updateNodeConfig: (nodeId: string, updates: Partial<AllNodeConfig>) => void;
  updateNodeResult: (nodeId: string, updates: Partial<NodeResult>) => void;
  runNodes: (nodeIds: Node["id"][]) => Promise<void>;
  rfInstance: RefObject<ReactFlowInstance | undefined>;
  createNewNode: (template: NodeTemplate, position: XYPosition) => void;
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

const mock_nodes: DbNodeWithTemplate[] = [
  {
    id: "1",
    name: "Text Node 1",
    selectable: true,
    deletable: true,
    draggable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: false,
    canvasId: "canvas1",
    zIndex: 1,
    templateId: "template1",
    position: {
      x: 300,
      y: 360,
    },
    width: 300,
    height: null,
    type: 'Text',
    result: {
      parts: [{
        type: 'Text',
        data: 'Create a text prompt for GTA 6 advertisement banner image.',
      }]
    } as TextResult,
    config: {},
    template: {
      id: "template1",
      type: 'Text',
      displayName: 'Text',
      description: 'A simple text node',
      processEnvironment: 'Server',
      variableInputs: false,
      variableOutputs: false,
      tokenPrice: 0,
      category: 'Toolbox',
      subcategory: 'Text tools',
      defaultConfig: {},
      showInQuickAccess: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      outputTypes: [
        {
          "id": "i22",
          outputType: 'Text',
          label: 'Text',
        }
      ]
    }
  },
  {
    id: "2",
    name: "LLM Node 1",
    selectable: true,
    deletable: true,
    draggable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: false,
    canvasId: "canvas1",
    zIndex: 1,
    templateId: "template2",
    position: {
      x: 400,
      y: 680,
    },
    width: 300,
    height: null,
    type: 'LLM',
    result: {
      parts: [{
        type: 'Text',
        data: 'Semi realistic image of Roy, long haired man in miami beach with 3 other chatacters on sky.',
      }]
    } as LLMResult,
    config: {},
    template: {
      id: "template1",
      type: 'LLM',
      displayName: 'LLM',
      description: 'A node to run LLM inferences',
      processEnvironment: 'Server',
      variableInputs: false,
      variableOutputs: false,
      tokenPrice: 0,
      category: 'LLMs',
      subcategory: 'Language Models',
      showInQuickAccess: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      defaultConfig: {},
      inputTypes: [
        {
          "id": "i222",
          inputType: 'Text',
          label: 'Prompt',
        }
      ],
      outputTypes: [
        {
          "id": "i222",
          outputType: 'Text',
          label: 'Output',
        }
      ]
    }
  },
  {
    id: "3",
    name: "GPT IMG",
    selectable: true,
    deletable: true,
    draggable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    isDirty: false,
    canvasId: "canvas1",
    zIndex: 1,
    templateId: "template2",
    position: {
      x: 800,
      y: 1080,
    },
    width: 300,
    height: null,
    type: 'GPTImage1',
    result: {
      selectedIndex: 0,
      parts: [{
        type: 'Image',
        data: {
          mediaSize: {
            width: 512,
            height: 512,
          },
          name: 'First Image',
          bucket: 'default',
          fileSize: 2048,
          mimeType: 'image/png',
          url: "https://placehold.co/512x512",
        }
      },{
        type: 'Image',
        data: {
          mediaSize: {
            width: 1024,
            height: 1024,
          },
          name: 'Second Image',
          bucket: 'default',
          fileSize: 2048,
          mimeType: 'image/png',
          url: "https://placehold.co/1024x1024",
        }
      }]
    } as GPTImage1Result,
    config: {},
    template: {
      id: "template3",
      type: 'GPTImage1',
      displayName: 'Gpt Image 1',
      description: 'A node to run LLM inferences',
      processEnvironment: 'Server',
      variableInputs: false,
      variableOutputs: false,
      tokenPrice: 0,
      category: 'Image',
      subcategory: 'Image Generation',
      showInQuickAccess: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      defaultConfig: {},
      inputTypes: [
        {
          "id": "s13",
          inputType: 'Text',
          label: 'Prompt',
        }
      ],
      outputTypes: [
        {
          "id": "i232",
          outputType: 'Image',
          label: 'Image',
        }
      ]
    }
  },
]

function convertToClientNode(dbNode: DbNode): Node {
  return {
    id: dbNode.id,
    position: dbNode.position as XYPosition,
    data: dbNode,
    type: dbNode.type,
    width: dbNode.width ?? undefined,
    height: dbNode.height ?? undefined,
    draggable: dbNode.draggable ?? true,
    selectable: dbNode.selectable ?? true,
    deletable: dbNode.deletable ?? true,
  };
}

const CanvasProvider = ({
  canvasId,
  children,
}: PropsWithChildren<CanvasProviderProps>) => {

  const dispatch = useAppDispatch();
  const rfInstance = useRef<ReactFlowInstance | undefined>(undefined);

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

  useEffect(() => {
    // if (canvas?.nodes) {
    //   dispatch(setAllNodes(canvas.nodes))
    // }
    console.log("Setting mock nodes in store")
    dispatch(setAllNodes(mock_nodes as any))
  }, [dispatch])

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(mock_nodes.map(convertToClientNode));
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([]);
  const past = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const future = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const isRestoring = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { mutateAsync: patchCanvasAsync } = useMutation({
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

    const currentDbNodes: Partial<DbNode>[] = nodes.map((n) => {
      const nodeData = n.data as NodeWithFileType<AllNodeConfig, NodeResult>;

      return {
        id: n.id,
        type: n.type as NodeType,
        position: n.position as XYPosition,
        width: n.width ?? undefined,
        height: n.height ?? undefined,
        draggable: n.draggable ?? true,
        selectable: n.selectable ?? true,
        deletable: n.deletable ?? true,
        config: nodeData.config as AllNodeConfig,
        zIndex: nodeData.zIndex,
        result: nodeData.result as NodeResult,
        isDirty: nodeData.isDirty ?? false,
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
  }, [canvasId, nodes, edges, patchCanvasAsync]);

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

  const onNodeDragStop = useCallback((_event: MouseEvent, _node: Node, _draggedNodes: Node[]) => {
    if (isRestoring.current) return;
    scheduleSave();
  }, [scheduleSave]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      if (isRestoring.current) {
        onNodesChangeBase(changes);
        return;
      }

      // Ignore pure selection changes for history
      const isOnlySelection = changes.every(c => c.type === 'select');

      // Ignore all position changes for history (handled in drag start/stop)
      const isPositionChange = changes.every(c => c.type === 'position');

      if (isOnlySelection || isPositionChange) {
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

      setEdges((eds) => {
        // Find if there's an existing edge connected to the same target and targetHandle
        const existingEdge = eds.find(
          (e) =>
            e.target === params.target &&
            e.targetHandle === (params.targetHandle || undefined)
        );

        // If found, remove the existing edge
        let updatedEdges = existingEdge
          ? eds.filter((e) => e.id !== existingEdge.id)
          : eds;

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
      });

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

  const updateNodeConfig = useCallback((nodeId: string, updates: Partial<AllNodeConfig>) => {
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
              config: {
                ...n.data.config as AllNodeConfig,
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

  const updateNodeResult = useCallback((nodeId: string, updates: Partial<NodeResult>) => {
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
              result: {
                ...n.data.result as NodeResult,
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

  const runNodes = useCallback(async (nodeIds: Node["id"][]) => {
    // Save before running
    await save();

    const resp = await runNodesMutateAsync({ nodeIds });
    console.log({resp});
  }, [runNodesMutateAsync, save])

  // Uncomment when ready to use actual data
  // useEffect(() => {
  //   if (initialNodes) setNodes(initialNodes);
  //   if (initialEdges) setEdges(initialEdges)
  // }, [initialNodes, initialEdges, setNodes, setEdges])

  useEffect(() => {
    // setNodes(initialNodes);
    setNodes(mock_nodes.map(convertToClientNode))
    setEdges(initialEdges);
    past.current = [];
    future.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [initialEdges, setNodes, setEdges]);

  const createNewNode = useCallback((template: NodeTemplate, position: XYPosition) => {
    const id = generateId();
    const nodeEntity: DbNode = {
      id,
      name: template.displayName,
      templateId: template.id,
      type: template.type as NodeType,
      position,
      width: 300,
      height: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDirty: false,
      canvasId: canvasId,
      zIndex: 1,
      draggable: true,
      selectable: true,
      deletable: true,
      config: template.defaultConfig || {},
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
    setNodes((nds) => [...nds, newNode]);
    dispatch(createNode(nodeEntity));
    scheduleSave();
  }, [canvasId, setNodes, dispatch, scheduleSave]);
  
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
    onNodeDragStop,
    updateNodeConfig,
    updateNodeResult,
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