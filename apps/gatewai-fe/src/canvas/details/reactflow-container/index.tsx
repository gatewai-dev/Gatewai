import { Background, ConnectionMode, getOutgoers, Panel, ReactFlow, SelectionMode, type Connection, type Edge, type Node } from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { Toolbar } from "./toolbar";
import { CustomEdge, CustomConnectionLine } from "../nodes/base";
import { useCallback } from "react";

// Define edge types - you can add more custom edge types here if needed
const edgeTypes = {
  default: CustomEdge,
  // You could also add other custom edge types:
  // animated: AnimatedCustomEdge,
  // straight: StraightCustomEdge,
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
    onNodeDragStart
  } = useCanvasCtx();


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

  return (
    <div className="w-full h-screen bg-black">
      <ReactFlow
        edges={clientEdges}
        nodes={clientNodes}
        className="bg-black"
        fitView
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={CustomConnectionLine} // Add this line
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        nodesDraggable={tool === 'select'}
        elementsSelectable={tool === 'select'}
        maxZoom={4}
        minZoom={0.1}
        panOnDrag={tool === 'pan'}
        selectionOnDrag={tool === 'select'}
        selectNodesOnDrag
        selectionMode={SelectionMode.Partial}
        connectionMode={ConnectionMode.Loose}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeDragStart={onNodeDragStart}
      >
        {children}
        <Background />
        <Panel position="top-left" className=" bg-background left-0 top-0 m-0! h-full w-[60px] flex flex-col">
          <div className=" text-sm">
            <strong className="font-medium">Logo</strong>
          </div>
        </Panel>
        <Panel position="bottom-center">
          <Toolbar />
        </Panel>
      </ReactFlow>
    </div>
  );
}

export { ReactflowContainer };