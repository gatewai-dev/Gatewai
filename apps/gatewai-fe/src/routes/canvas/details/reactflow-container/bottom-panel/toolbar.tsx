import { useReactFlow, useViewport } from "@xyflow/react";
import {
	ChevronDown,
	Hand,
	MessageSquare,
	MousePointer,
	Redo2,
	Undo2,
} from "lucide-react";
import { memo, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "@/components/ui/menubar";
import { Separator } from "@/components/ui/separator";
import { useAppDispatch, useAppSelector } from "@/store";
import { selectCanRedo, selectCanUndo } from "@/store/undo-redo";
import { CanvasAgentLayout } from "../../agent/components/layout";
import { useCanvasCtx } from "../../ctx/canvas-ctx";
import { ModeContext } from "..";
import { CanvasTasksPanel } from "../tasks";
import { RunWorkflowButton } from "./run-workflow-button";

const Toolbar = memo(() => {
	const { zoom } = useViewport();
	const dispatch = useAppDispatch();
	const { canvas } = useCanvasCtx();
	const [isChatOpen, setIsChatOpen] = useState(false);

	// Existing logic
	const undo = () => dispatch({ type: "flow/undo" });
	const redo = () => dispatch({ type: "flow/redo" });

	const canUndo = useAppSelector(selectCanUndo);
	const canRedo = useAppSelector(selectCanRedo);

	const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
	const zoomPercentage = `${Math.round(zoom * 100)}%`;
	const ctx = useContext(ModeContext);

	return (
		<div className="relative flex flex-col items-center gap-2">
			{/* Chat Window - Floating above toolbar */}
			{isChatOpen && canvas && (
				<div className="absolute bottom-full mb-4 right-0 w-[750px] shadow-2xl rounded-xl overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200 z-50">
					<CanvasAgentLayout canvasId={canvas.id} />
				</div>
			)}

			<Menubar className="border border-border/50 bg-background/80 backdrop-blur-md shadow-2xl rounded-full px-2 py-1 h-12 ring-1 ring-white/5 flex items-center gap-1">
				{/* Selection & Pan Tools */}
				<Button
					title="Select (V)"
					variant={ctx?.mode === "select" ? "secondary" : "ghost"}
					size="icon"
					className="rounded-full w-9 h-9"
					onClick={() => ctx?.setMode("select")}
				>
					<MousePointer className="w-4 h-4" />
				</Button>
				<Button
					title="Pan (Space)"
					variant={ctx?.mode === "pan" ? "secondary" : "ghost"}
					size="icon"
					className="rounded-full w-9 h-9"
					onClick={() => ctx?.setMode("pan")}
				>
					<Hand className="w-4 h-4" />
				</Button>

				<Separator orientation="vertical" className="h-5 mx-1" />

				{/* Undo & Redo Group */}
				<div className="flex items-center gap-0.5">
					<Button
						title="Undo (Ctrl+Z)"
						variant="ghost"
						disabled={!canUndo}
						size="icon"
						className="rounded-full w-9 h-9"
						onClick={undo}
					>
						<Undo2 className="w-4 h-4" />
					</Button>
					<Button
						title="Redo (Ctrl+Y)"
						variant="ghost"
						disabled={!canRedo}
						size="icon"
						className="rounded-full w-9 h-9"
						onClick={redo}
					>
						<Redo2 className="w-4 h-4" />
					</Button>
				</div>

				<Separator orientation="vertical" className="h-5 mx-1" />

				{/* Zoom Controls */}
				<MenubarMenu>
					<MenubarTrigger asChild>
						<Button
							variant="ghost"
							className="h-9 px-3 text-xs font-mono rounded-full"
						>
							{zoomPercentage}{" "}
							<ChevronDown className="w-3 h-3 ml-2 opacity-50" />
						</Button>
					</MenubarTrigger>
					<MenubarContent align="center" className="min-w-[140px]">
						<MenubarItem onClick={() => zoomIn()}>Zoom In</MenubarItem>
						<MenubarItem onClick={() => zoomOut()}>Zoom Out</MenubarItem>
						<MenubarItem onClick={() => zoomTo(1)}>
							Actual Size (100%)
						</MenubarItem>
						<MenubarItem onClick={() => zoomTo(2)}>200%</MenubarItem>
						<Separator className="my-1" />
						<MenubarItem onClick={() => fitView()}>Fit to Screen</MenubarItem>
					</MenubarContent>
				</MenubarMenu>

				<Separator orientation="vertical" className="h-5 mx-1" />

				<RunWorkflowButton />
				<CanvasTasksPanel />

				<Separator orientation="vertical" className="h-5 mx-1" />

				{/* Chat Toggle */}
				<Button
					title="AI Agent Chat"
					variant={isChatOpen ? "secondary" : "ghost"}
					size="icon"
					className="rounded-full w-9 h-9"
					onClick={() => setIsChatOpen(!isChatOpen)}
				>
					<MessageSquare className="w-4 h-4" />
				</Button>
			</Menubar>
		</div>
	);
});

export { Toolbar };
