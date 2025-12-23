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
import type {AllNodeConfig, DataType, Edge as DbEdge, Node as DbNode, GPTImage1Result, LLMResult, NodeResult, NodeType, NodeWithFileType, TextResult } from '@gatewai/types';
import { useAppDispatch, useAppSelector } from '@/store';
import { setAllNodes, nodeSelectors } from '@/store/nodes';
import { generateId } from '@/lib/idgen';
import { createNode } from '@/store/nodes';
import type { DbNodeWithTemplate } from '@/types/node';
import type { NodeTemplateWithIO } from '@/types/node-template';
import { rpcClient } from '@/rpc/client';
import type { CanvasDetailsRPC, PatchCanvasRPCReq } from '@/rpc/types';
import throttle from 'lodash/throttle';
import { onNodeChange, selectRFEdges, selectRFNodes, setEdges, setNodes } from '@/store/rfstate';

interface CanvasContextType {
  canvas: CanvasDetailsRPC | undefined;
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
  onConnect: OnConnect;
  onNodeDragStop: (event: MouseEvent, node: Node, nodes: Node[]) => void;
  updateNodeConfig: (nodeId: string, updates: Partial<AllNodeConfig>) => void;
  updateNodeResult: (nodeId: string, updates: Partial<NodeResult>) => void;
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
          templateId: "template1",
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
      id: "template2",
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
          templateId: 'template2',
          required: true,
          label: 'Prompt',
        }
      ],
      outputTypes: [
        {
          "id": "i222",
          outputType: 'Text',
          templateId: 'template2',
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
          templateId: 'template3',
          required: true,
          inputType: 'Text',
          label: 'Prompt',
        }
      ],
      outputTypes: [
        {
          "id": "i232",
          templateId: 'template3',
          outputType: 'Image',
          label: 'Image',
        }
      ]
    }
  },
]

const CanvasProvider = ({
  canvasId,
  children,
}: PropsWithChildren<CanvasProviderProps>) => {

  const dispatch = useAppDispatch();
  const rfInstance = useRef<ReactFlowInstance | undefined>(undefined);
  const storeNodes = useAppSelector(nodeSelectors.selectAll);

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
      dispatch(setAllNodes(canvas.nodes))
    }
    console.log("Setting mock nodes in store")
  }, [dispatch, canvas])

  const nodes = useAppSelector(selectRFNodes);
  const edges = useAppSelector(selectRFEdges);

  const isRestoring = useRef(false);
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

    const currentDbNodes = storeNodes.map((n) => {
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
  }, [canvasId, storeNodes, edges, patchCanvasAsync]);

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
      onNodeChange(changes);
    },
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
        onEdgesChange(changes);
    },
    []
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (isRestoring.current) return;

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

  const updateNodeConfig = useCallback((nodeId: string, updates: Partial<AllNodeConfig>) => {
    if (isRestoring.current) return;

    setNodes(
      nodes.map((n) => {
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
  }, [nodes, scheduleSave]);

  const updateNodeResult = useCallback((nodeId: string, updates: Partial<NodeResult>) => {
    if (isRestoring.current) return;

    setNodes(
      nodes.map((n) => {
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
  }, [nodes, scheduleSave]);

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
    const nodeEntity: DbNodeWithTemplate = {
      id,
      name: template.displayName,
      templateId: template.id,
      template: template,
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
    console.log({nodeEntity})
    setNodes([...nodes, newNode]);
    dispatch(createNode(nodeEntity));
    scheduleSave();
  }, [canvasId, dispatch, nodes, scheduleSave]);
  
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
    onConnect,
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