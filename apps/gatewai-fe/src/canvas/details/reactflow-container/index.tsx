import { Background, ConnectionMode, getOutgoers, Panel, ReactFlow, SelectionMode, type Connection, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { Toolbar } from "./toolbar";
import { CustomEdge, CustomConnectionLine } from "../nodes/base";
import { useCallback, useRef, type DragEventHandler } from "react";
import { useNodeTemplateDnD } from "@/node-templates/node-template-drag.ctx";
import { NodePalette } from "@/node-templates/node-palette";

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
    onNodeDragStop
  } = useCanvasCtx();
  const rfInstance = useRef<ReactFlowInstance | undefined>(undefined);
  const {template} = useNodeTemplateDnD();


    const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      // we are using getNodes and getEdges helpers here
      // to make sure we create isValidConnection function only once
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

  const onDrop: DragEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.preventDefault();
      if (!template || !rfInstance.current) return;
      // project was renamed to screenToFlowPosition
      // and you don't need to subtract the reactFlowBounds.left/top anymore
      // details: https://reactflow.dev/whats-new/2023-11-10
      const position = rfInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode = {
        id: "w",
        template,
        position,
        data: { label: `${template} node` },
      };

      console.log({newNode})
    },
    [template],
  );

  return (
    <div className="w-full h-screen bg-black">
      <ReactFlow
        onInit={(flowInstance) => {
          rfInstance.current = flowInstance;
        }}
        edges={clientEdges}
        nodes={clientNodes}
        className="bg-black"
        fitView
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={CustomConnectionLine} // Add this line
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        onDrop={onDrop}
        nodesDraggable={tool === 'select'}
        elementsSelectable={tool === 'select'}
        maxZoom={4}
        zoomOnScroll={true}
        minZoom={0.1}
        zoomOnPinch={true}
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