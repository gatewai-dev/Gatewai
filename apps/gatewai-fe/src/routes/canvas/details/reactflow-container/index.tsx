import { Background, ConnectionMode, Panel, ReactFlow, SelectionMode } from "@xyflow/react";
import { nodeTypes } from "../nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { Toolbar } from "./toolbar";
import { CustomEdge, CustomConnectionLine } from "../nodes/base";
import { type DragEventHandler } from "react";
import { NodePalette } from "@/node-templates/node-palette";
import { useSelectedEntitiesCtx } from "../ctx/selected-entity-ctx";
import { RightPanel } from "./right-panel";
import { useAppSelector } from "@/store";
import { selectRFEdges, selectRFNodes } from "@/store/rfstate";

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
    onNodesDelete,
    onNodesChange,
    onConnect,
    rfInstance
  } = useCanvasCtx();
  const { onSelectionChange } = useSelectedEntitiesCtx();
  const nodes = useAppSelector(selectRFNodes);
  const edges = useAppSelector(selectRFEdges);
  console.log({nodes, edges});

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
        nodesDraggable={true}
        elementsSelectable={true}
        panOnDrag={true}
        selectionOnDrag={true}
        selectNodesOnDrag
        selectionMode={SelectionMode.Partial}
        connectionMode={ConnectionMode.Loose}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onNodesDelete={onNodesDelete}
        deleteKeyCode={"Delete"}
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