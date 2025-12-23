import { Background, ConnectionMode, getOutgoers, Panel, ReactFlow, SelectionMode, type Connection, type Edge, type Node } from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { Toolbar } from "./toolbar";
import { CustomEdge, CustomConnectionLine } from "../nodes/base";
import { useCallback, type DragEventHandler } from "react";
import { NodePalette } from "@/node-templates/node-palette";
import { useSelectedEntitiesCtx } from "../ctx/selected-entity-ctx";

// Define edge types - you can add more custom edge types here if needed
const edgeTypes = {
  default: CustomEdge,
};

type ReactFlowProps = {
  children?: React.ReactNode;
};

function ReactflowContainer({ children }: ReactFlowProps) {
  const {
    clientNodes,
    onEdgesChange,
    onNodesChange,
    clientEdges,
    tool,
    onConnect,
    onNodeDragStop,
    rfInstance
  } = useCanvasCtx();
  const { onSelectionChange } = useSelectedEntitiesCtx();

    const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const nodes = clientNodes;
      const edges = clientEdges;
      const target = nodes.find((node) => node.id === connection.target);
      if (!target) return false;
      const hasCycle = (node: Node, visited = new Set()) => {
        if (visited.has(node.id)) return false;
 
        visited.add(node.id);
 
        for (const outgoer of getOutgoers(node, nodes, edges)) {
          if (outgoer.id === connection.source) return true;
          if (hasCycle(outgoer, visited)) return true;
        }
      };
 
      if (target.id === connection.source) return false;
      return !hasCycle(target);
    },
    [clientNodes, clientEdges],
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
        edges={clientEdges}
        nodes={clientNodes}
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
        onSelectionChange={onSelectionChange}
        elementsSelectable={tool === 'select'}
        panOnDrag={tool === 'pan'}
        selectionOnDrag={tool === 'select'}
        selectNodesOnDrag
        selectionMode={SelectionMode.Partial}
        connectionMode={ConnectionMode.Loose}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeDragStop={onNodeDragStop}
      >
        {children}
        <Background />
        <Panel position="top-left" className=" bg-background left-0 top-0 m-0! h-full flex flex-col">
          <NodePalette />
        </Panel>
        <Panel position="bottom-center">
          <Toolbar />
        </Panel>
      </ReactFlow>
    </div>
  );
}

export { ReactflowContainer };