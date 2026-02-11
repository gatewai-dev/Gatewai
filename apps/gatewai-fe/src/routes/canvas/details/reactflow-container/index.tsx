import {
	selectRFEdges,
	selectRFNodes,
	setSelectedEdgeIds,
	setSelectedNodeIds,
	useAppDispatch,
	useAppSelector,
} from "@gatewai/react-store";
import { LoadingSpinner } from "@gatewai/ui-kit";
import {
	Background,
	BackgroundVariant,
	ConnectionLineType,
	ConnectionMode,
	type Edge,
	type Node,
	ReactFlow,
	SelectionMode,
} from "@xyflow/react";
import type { DragEventHandler, MouseEventHandler } from "react";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { useCanvasMode } from "../ctx/canvas-mode-ctx";
import { nodeTypes } from "../nodes";
import { CustomConnectionLine, CustomEdge } from "../nodes/base";
import { ReactFlowPanels } from "./panels";

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
		onConnect,
		rfInstance,
		isReviewing,
		canvas,
		isLoading,
	} = useCanvasCtx();
	const { effectivePan, setIsMiddleMousePressed } = useCanvasMode();
	const dispatch = useAppDispatch();

	const onSelectionChange = ({
		nodes,
		edges,
	}: {
		nodes: Node[];
		edges: Edge[];
	}) => {
		dispatch(setSelectedNodeIds(nodes.map((m) => m.id)));
		dispatch(setSelectedEdgeIds(edges.map((m) => m.id)));
	};
	const rfNodes = useAppSelector(selectRFNodes);
	const rfEdges = useAppSelector(selectRFEdges);

	const onDragOver: DragEventHandler<HTMLDivElement> | undefined = (event) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
	};
	const handleAuxClick: MouseEventHandler<HTMLDivElement> = (event) => {
		if (event.button === 1) {
			// 1 is the middle mouse button
			event.preventDefault();
		}
	};

	const onMouseDown: MouseEventHandler<HTMLDivElement> = (event) => {
		if (event.button === 1) {
			setIsMiddleMousePressed(true);
		}
	};

	useEffect(() => {
		const handleMouseUp = (event: MouseEvent) => {
			if (event.button === 1) {
				setIsMiddleMousePressed(false);
			}
		};
		window.addEventListener("mouseup", handleMouseUp);
		return () => window.removeEventListener("mouseup", handleMouseUp);
	}, [setIsMiddleMousePressed]);

	if (isLoading) {
		return (
			<div className="w-full h-screen bg-black flex items-center justify-center">
				<LoadingSpinner size={60} />
			</div>
		);
	}

	return (
		<div
			onAuxClick={handleAuxClick}
			onMouseDown={onMouseDown}
			className="w-full h-screen bg-black relative"
		>
			<Helmet>
				<title>{canvas?.name ?? "Canvas"} - Gatewai</title>
			</Helmet>
			<ReactFlow
				onInit={(flowInstance) => {
					rfInstance.current = flowInstance;
				}}
				nodes={rfNodes}
				edges={rfEdges}
				multiSelectionKeyCode={null}
				nodeDragThreshold={1}
				fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
				className="react-flow-container"
				fitView
				snapToGrid
				connectionRadius={70}
				connectionLineType={ConnectionLineType.Bezier}
				deleteKeyCode={null}
				snapGrid={[10, 10]}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				connectionLineComponent={CustomConnectionLine}
				onEdgesChange={isReviewing ? undefined : onEdgesChange}
				onNodesChange={isReviewing ? undefined : onNodesChange}
				onDragOver={onDragOver}
				maxZoom={8}
				minZoom={0.1}
				zoomOnPinch={true}
				panOnScroll={true}
				zoomActivationKeyCode="Ctrl"
				zoomOnScroll={false} // Handled by panOnScroll + modifier
				nodesDraggable={!isReviewing}
				elementsSelectable
				panOnDrag={effectivePan ? [0, 1, 2] : [1, 2]}
				selectionOnDrag={!effectivePan}
				selectNodesOnDrag={!isReviewing}
				selectionMode={SelectionMode.Partial}
				connectionMode={ConnectionMode.Strict}
				onConnect={isReviewing ? undefined : onConnect}
				onlyRenderVisibleElements={rfNodes.length > 100} // When there's too many nodes, only render visible ones for performance
				onSelectionChange={onSelectionChange}
				proOptions={{ hideAttribution: false }}
				nodesConnectable={!isReviewing}
			>
				{children}
				<Background variant={BackgroundVariant.Dots} />
				<ReactFlowPanels />
			</ReactFlow>
		</div>
	);
}

export { ReactflowContainer };
