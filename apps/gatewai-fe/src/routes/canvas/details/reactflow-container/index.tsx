import { Background, ConnectionMode, getOutgoers, Panel, ReactFlow, SelectionMode, type Connection, type Edge, type Node } from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { Toolbar } from "./toolbar";
import { CustomEdge, CustomConnectionLine } from "../nodes/base";
import { useCallback, type DragEventHandler } from "react";
import { NodePalette } from "@/node-templates/node-palette";
import { useSelectedEntitiesCtx } from "../ctx/selected-entity-ctx";
import { RightPanel } from "./right-panel";
import { useAppSelector } from "@/store";
import { selectRFEdges, selectRFNodes } from "@/store/rfstate";
import { toast } from "sonner"
import type { CanvasDetailsRPC } from "@/rpc/types";

// Define edge types - you can add more custom edge types here if needed
const edgeTypes = {
  default: CustomEdge,
};

type ReactFlowProps = {
  children?: React.ReactNode;
};

function ReactflowContainer({ children }: ReactFlowProps) {
  const {
    onEdgesChange,
    onNodesChange,
    tool,
    onConnect,
    rfInstance
  } = useCanvasCtx();
  const { onSelectionChange } = useSelectedEntitiesCtx();
  const nodes = useAppSelector(selectRFNodes);
  const edges = useAppSelector(selectRFEdges);
  console.log({nodes, edges});
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target) {
        toast.error('Target or source could not be found.')
        return false
      };

      // Self-connection is always invalid
      if (connection.source === connection.target) {
        toast.error('Self-connection is not a valid connection.')
        return false
      };

      // Find source node
      const sourceNode = nodes.find((n) => n.id === connection.source);
      if (!sourceNode) {
        toast.error('Source node could not be found.')
        return false;
      };

      // Find target node
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!targetNode) {
        toast.error('Target node could not be found.')
        return false;
      };

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
        toast.error('Looping connection is not valid.')
        return false;
      }

      // Validate if data types for handles match
      const sourceDbNode = sourceNode.data as CanvasDetailsRPC["nodes"][0];
      const sourceHandle = sourceDbNode.handles.find(h => h.id === connection.sourceHandle);

      const targetDbNode = targetNode.data as CanvasDetailsRPC["nodes"][0];
      const targetHandle = targetDbNode.handles.find(h => h.id === connection.targetHandle);

      if (!sourceHandle || !targetHandle) {
        toast.error('Source or target handle could not be found.')
        return false;
      }

      const sourceDataType = sourceHandle.dataType;
      const targetDataType = targetHandle.dataType;

      // Handle 'Any' data type - accepts any connection
      if (sourceDataType === 'Any' || targetDataType === 'Any') {
        return true;
      }

      // Handle VideoLayer - accepts Video or Audio
      if (targetDataType === 'VideoLayer') {
        if (sourceDataType === 'Video' || sourceDataType === 'Audio') {
          return true;
        }
        toast.error('VideoLayer only accepts Video or Audio data types.')
        return false;
      }

      // Handle DesignLayer - accepts Text, Image, or Mask
      if (targetDataType === 'DesignLayer') {
        if (sourceDataType === 'Text' || sourceDataType === 'Image' || sourceDataType === 'Mask') {
          return true;
        }
        toast.error('DesignLayer only accepts Text, Image, or Mask data types.')
        return false;
      }

      // For all other cases, data types must match exactly
      if (sourceDataType !== targetDataType) {
        toast.error(`Data types do not match: ${sourceDataType} → ${targetDataType}`)
        return false;
      }

      return true;
    },
    [nodes, edges],
  );

  const onDragOver: DragEventHandler<HTMLDivElement> | undefined = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="w-full h-screen bg-black">
      <ReactFlow
        onInit={(flowInstance) => {
          rfInstance.current = flowInstance;
        }}
        nodes={nodes}
        edges={edges}
        className="bg-black react-flow-container"
        fitView
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={CustomConnectionLine}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        onDragEnd={onDragOver}
        maxZoom={4}
        minZoom={0.1}
        zoomOnPinch={true}
        zoomOnScroll={true}
        nodesDraggable={tool === 'select'}
        elementsSelectable={tool === 'select'}
        panOnDrag={tool === 'pan'}
        selectionOnDrag={tool === 'select'}
        selectNodesOnDrag
        selectionMode={SelectionMode.Partial}
        connectionMode={ConnectionMode.Loose}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onSelectionChange={onSelectionChange}
      >
        {children}
        <Background />
        <Panel position="top-left" className=" bg-background left-0 top-0 m-0! h-full flex flex-col">
          <NodePalette />
        </Panel>
        <Panel position="bottom-center">
          <Toolbar />
        </Panel>
        <Panel position="center-right">
          <RightPanel />
        </Panel>
      </ReactFlow>
    </div>
  );
}

export { ReactflowContainer };