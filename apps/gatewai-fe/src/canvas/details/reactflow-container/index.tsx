import { Background, ConnectionMode, Panel, ReactFlow, SelectionMode } from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { Toolbar } from "./toolbar";
import { CustomEdge, CustomConnectionLine } from "../nodes/base";

// Define edge types - you can add more custom edge types here if needed
const edgeTypes = {
  default: CustomEdge,
  // You could also add other custom edge types:
  // animated: AnimatedCustomEdge,
  // straight: StraightCustomEdge,
};

function ReactflowContainer({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { 
    clientNodes,
    onEdgesChange,
    onNodesChange,
    clientEdges,
    tool,
    onConnect,
    onNodeDragStart
  } = useCanvasCtx();

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
        panOnDrag={tool === 'pan'}
        selectionOnDrag={tool === 'select'}
        selectNodesOnDrag
        selectionMode={SelectionMode.Partial}
        connectionMode={ConnectionMode.Loose}
        onConnect={onConnect}
        onNodeDragStart={onNodeDragStart}
      >
        {children}
        <Background />
        <Panel position="top-left" className=" bg-background left-0 top-0 m-0! h-full w-[60px] flex flex-col">
          <div className=" text-sm ">
            <strong className="font-medium">Tool:</strong>
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