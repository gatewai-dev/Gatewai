import { Background, Panel, ReactFlow, SelectionMode } from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { Toolbar } from "./toolbar";

function ReactflowContainer({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { clientNodes, setEdges, setNodes, onEdgesChange, onNodesChange,  clientEdges, tool, onConnect, onNodeDragStart } = useCanvasCtx();

  return (
    <div className="w-full h-screen">
      <ReactFlow
        edges={clientEdges}
        nodes={clientNodes}
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
        <Panel position="bottom-center">
          <Toolbar />
        </Panel>
      </ReactFlow>
    </div>
  );
}

export { ReactflowContainer };