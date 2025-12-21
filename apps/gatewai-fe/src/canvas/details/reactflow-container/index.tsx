import { Background, Panel, ReactFlow, SelectionMode } from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { Toolbar } from "./toolbar";

function ReactflowContainer({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { clientNodes, onEdgesChange, onNodesChange,  clientEdges, tool, onConnect, onNodeDragStart } = useCanvasCtx();
  console.log({clientEdges, clientNodes})
  return (
    <div className="w-full h-screen bg-black">
      <ReactFlow
        edges={clientEdges}
        nodes={clientNodes}
        className="bg-black"
        fitView
        nodeTypes={nodeTypes}
        onEdgesChange={onEdgesChange}
        onNodesChange={onNodesChange}
        nodesDraggable={tool === 'select'}
        elementsSelectable={tool === 'select'}
        panOnDrag={tool === 'pan'}
        selectionOnDrag={tool === 'select'}
        selectNodesOnDrag
        selectionMode={SelectionMode.Partial}
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