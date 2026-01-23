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
import { createContext, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAppDispatch, useAppSelector } from "@/store";
import { setSelectedEdgeIds, setSelectedNodeIds } from "@/store/node-meta";
import { selectRFEdges, selectRFNodes } from "@/store/rfstate";
import { useAgentSessionsCtx } from "../agent/ctx/canvas-sessions.ctx";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { nodeTypes } from "../nodes";
import { CustomConnectionLine, CustomEdge } from "../nodes/base";
import { ReactFlowPanels } from "./panels";

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
	const { isLocked } = useAgentSessionsCtx();
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
	const handleAuxClick: MouseEventHandler<HTMLDivElement> = (event) => {
		if (event.button === 1) {
			// 1 is the middle mouse button
			event.preventDefault();
		}
	};

	return (
		<div
			ref={containerRef}
			onAuxClick={handleAuxClick}
			className="w-full h-screen bg-black relative"
		>
			{isLocked && (
				<div className="absolute inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
					<div className="bg-card p-6 rounded-xl shadow-2xl border border-border flex flex-col items-center gap-4 max-w-sm text-center">
						<div className="relative">
							<div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
							<LoadingSpinner className="w-8 h-8 relative z-10 text-primary" />
						</div>
						<div>
							<h3 className="font-semibold text-lg">Agent Working</h3>
							<p className="text-sm text-muted-foreground">
								Canvas is locked while the agent is executing changes.
							</p>
						</div>
					</div>
				</div>
			)}
			<ModeContext.Provider value={{ mode, setMode }}>
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
					onEdgesChange={!isLocked ? onEdgesChange : undefined}
					onNodesChange={!isLocked ? onNodesChange : undefined}
					onDragOver={!isLocked ? onDragOver : undefined}
					maxZoom={8}
					minZoom={0.1}
					zoomOnPinch={true}
					zoomOnScroll={true}
					nodesDraggable={!isLocked}
					elementsSelectable={!isLocked}
					panOnDrag={effectivePan}
					selectionOnDrag={!effectivePan}
					selectNodesOnDrag={!isLocked}
					selectionMode={SelectionMode.Partial}
					connectionMode={ConnectionMode.Loose}
					onConnect={!isLocked ? onConnect : undefined}
					onlyRenderVisibleElements={rfNodes.length > 20} // When there's too many nodes, only render visible ones for performance
					onSelectionChange={onSelectionChange}
					proOptions={{ hideAttribution: false }}
					nodesConnectable={!isLocked}
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
