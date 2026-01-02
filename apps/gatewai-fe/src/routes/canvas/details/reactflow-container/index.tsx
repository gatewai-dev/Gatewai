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
import type { DragEventHandler } from "react";
import { createContext, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAppDispatch, useAppSelector } from "@/store";
import { setSelectedEdgeIds } from "@/store/edges";
import { setSelectedNodeIds } from "@/store/nodes";
import { selectRFEdges, selectRFNodes } from "@/store/rfstate";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { nodeTypes } from "../nodes";
import { CustomConnectionLine, CustomEdge } from "../nodes/base";
import { ReactFlowPanels } from "./panels";
import { useZoomHotkeys } from "./use-zoom-hotkeys";

const edgeTypes = {
	default: CustomEdge,
};

type ReactFlowProps = {
	children?: React.ReactNode;
};

export const ModeContext = createContext<{
	mode: "select" | "pan";
	setMode: React.Dispatch<React.SetStateAction<"select" | "pan">>;
} | null>(null);

function ReactflowContainer({ children }: ReactFlowProps) {
	const { onEdgesChange, onNodesChange, onConnect, rfInstance } =
		useCanvasCtx();
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

	const [mode, setMode] = useState<"select" | "pan">("select");
	const [isSpacePressed, setIsSpacePressed] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useHotkeys("space", () => setIsSpacePressed(true), { keydown: true });
	useHotkeys("space", () => setIsSpacePressed(false), { keyup: true });

	useZoomHotkeys();

	const effectivePan = mode === "pan" || isSpacePressed;

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		let isPanning = false;
		let startX = 0;
		let startY = 0;
		let hasMoved = false;

		const onMouseDown = (e: MouseEvent) => {
			if (e.button !== 1) return;
			e.preventDefault();
			isPanning = true;
			startX = e.clientX;
			startY = e.clientY;
			hasMoved = false;
		};

		const onMouseMove = (e: MouseEvent) => {
			if (!isPanning) return;
			e.preventDefault();
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			const instance = rfInstance.current;
			if (instance) {
				const currentViewport = instance.getViewport();
				instance.setViewport({
					x: currentViewport.x + dx,
					y: currentViewport.y + dy,
					zoom: currentViewport.zoom,
				});
			}
			if (!hasMoved && Math.abs(dx) + Math.abs(dy) > 5) {
				hasMoved = true;
			}
			startX = e.clientX;
			startY = e.clientY;
		};

		const onMouseUp = (e: MouseEvent) => {
			if (e.button !== 1) return;
			if (!hasMoved) {
				setMode((prev) => (prev === "select" ? "pan" : "select"));
			}
			isPanning = false;
		};

		const onMouseLeave = () => {
			isPanning = false;
		};

		el.addEventListener("mousedown", onMouseDown);
		el.addEventListener("mousemove", onMouseMove);
		el.addEventListener("mouseup", onMouseUp);
		el.addEventListener("mouseleave", onMouseLeave);

		return () => {
			el.removeEventListener("mousedown", onMouseDown);
			el.removeEventListener("mousemove", onMouseMove);
			el.removeEventListener("mouseup", onMouseUp);
			el.removeEventListener("mouseleave", onMouseLeave);
		};
	}, [rfInstance]);

	const onDragOver: DragEventHandler<HTMLDivElement> | undefined = (event) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
	};

	return (
		<div ref={containerRef} className="w-full h-screen bg-black">
			<ModeContext.Provider value={{ mode, setMode }}>
				<ReactFlow
					disableKeyboardA11y={true}
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
					onEdgesChange={onEdgesChange}
					onNodesChange={onNodesChange}
					onDragOver={onDragOver}
					maxZoom={4}
					minZoom={0.1}
					zoomOnPinch={true}
					zoomOnScroll={true}
					nodesDraggable={true}
					elementsSelectable={true}
					panOnDrag={effectivePan}
					selectionOnDrag={!effectivePan}
					selectNodesOnDrag
					selectionMode={SelectionMode.Partial}
					connectionMode={ConnectionMode.Loose}
					onConnect={onConnect}
					onSelectionChange={onSelectionChange}
					proOptions={{ hideAttribution: false }}
				>
					{children}
					<Background variant={BackgroundVariant.Dots} />
					<ReactFlowPanels />
				</ReactFlow>
			</ModeContext.Provider>
		</div>
	);
}

export { ReactflowContainer };
