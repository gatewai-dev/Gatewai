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
import {
	type DragEventHandler,
	type MouseEventHandler,
	useCallback,
	useEffect,
	useMemo,
} from "react";
import { useCanvasCtx } from "../canvas-ctx";
import { useCanvasMode } from "../canvas-mode-ctx";
import { useNodeRegistry } from "../node-registry-ctx";
import { CustomConnectionLine, CustomEdge } from "../nodes/base";
import { ReactFlowPanels } from "./panels";

const edgeTypes = {
	default: CustomEdge,
};

type ReactFlowProps = {
	children?: React.ReactNode;
	leftPanel?: React.ReactNode;
};

const defaultFitViewOptions = { padding: 0.2, maxZoom: 1 };
const defaultSnapGrid: [number, number] = [10, 10];
const defaultProOptions = { hideAttribution: false };

function ReactflowContainer({ children, leftPanel }: ReactFlowProps) {
	const {
		onEdgesChange,
		onNodesChange,
		onConnect,
		rfInstance,
		isReviewing,
		isLoading,
	} = useCanvasCtx();
	const { nodeTypes } = useNodeRegistry();
	const { effectivePan, setIsMiddleMousePressed } = useCanvasMode();
	const dispatch = useAppDispatch();

	const onSelectionChange = useCallback(
		({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
			dispatch(setSelectedNodeIds(nodes.map((m) => m.id)));
			dispatch(setSelectedEdgeIds(edges.map((m) => m.id)));
		},
		[dispatch],
	);
	const rfNodes = useAppSelector(selectRFNodes);
	const rfEdges = useAppSelector(selectRFEdges);

	const onDragOver: DragEventHandler<HTMLDivElement> | undefined = useCallback(
		(event: React.DragEvent<HTMLDivElement>) => {
			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
		},
		[],
	);
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

	const onInit = useCallback(
		(flowInstance: any) => {
			if (rfInstance) {
				rfInstance.current = flowInstance;
			}
		},
		[rfInstance],
	);

	const panOnDrag = useMemo(
		() => (effectivePan ? [0, 1, 2] : [1, 2]),
		[effectivePan],
	);

	if (isLoading) {
		return (
			<div className="w-full h-screen bg-black flex items-center justify-center">
				<LoadingSpinner size={60} />
			</div>
		);
	}

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Required
		<div
			onAuxClick={handleAuxClick}
			onMouseDown={onMouseDown}
			className="w-full h-screen bg-black relative"
		>
			<ReactFlow
				onInit={onInit}
				nodes={rfNodes}
				edges={rfEdges}
				multiSelectionKeyCode={null}
				nodeDragThreshold={1}
				fitViewOptions={defaultFitViewOptions}
				className="react-flow-container"
				fitView
				snapToGrid
				connectionRadius={70}
				connectionLineType={ConnectionLineType.Bezier}
				deleteKeyCode={null}
				snapGrid={defaultSnapGrid}
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
				panOnDrag={panOnDrag}
				selectionOnDrag={!effectivePan}
				selectNodesOnDrag={!isReviewing}
				selectionMode={SelectionMode.Partial}
				connectionMode={ConnectionMode.Strict}
				onConnect={isReviewing ? undefined : onConnect}
				onlyRenderVisibleElements={rfNodes.length > 100} // When there's too many nodes, only render visible ones for performance
				onSelectionChange={onSelectionChange}
				proOptions={defaultProOptions}
				nodesConnectable={!isReviewing}
			>
				{children}
				<Background variant={BackgroundVariant.Dots} />
				<ReactFlowPanels>{leftPanel}</ReactFlowPanels>
			</ReactFlow>
		</div>
	);
}

export { ReactflowContainer };
