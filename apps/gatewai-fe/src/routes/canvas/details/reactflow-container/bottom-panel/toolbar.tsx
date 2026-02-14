import {
	Button,
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
	Separator,
} from "@gatewai/ui-kit";
import { useReactFlow, useViewport } from "@xyflow/react";
import { ChevronDown, Hand, MousePointer } from "lucide-react";
import { memo } from "react";
import { useCanvasMode } from "../../../../../../../../packages/react-canvas/src/canvas-mode-ctx";
import { CanvasTasksPanel } from "../tasks";
import { RunWorkflowButton } from "./run-workflow-button";

const Toolbar = memo(() => {
	const { zoom } = useViewport();

	const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
	const zoomPercentage = `${Math.round(zoom * 100)}%`;
	const { mode, setMode } = useCanvasMode();

	return (
		<div className="relative flex flex-col items-center gap-2">
			<Menubar className="border border-border/50 bg-background/80 backdrop-blur-md shadow-2xl rounded-full px-2 py-1 h-12 ring-1 ring-white/5 flex items-center gap-1">
				{/* Selection & Pan Tools */}
				<Button
					title="Select (V)"
					variant={mode === "select" ? "secondary" : "ghost"}
					size="icon"
					className="rounded-full w-9 h-9"
					onClick={() => setMode("select")}
				>
					<MousePointer className="w-4 h-4" />
				</Button>
				<Button
					title="Pan (Space)"
					variant={mode === "pan" ? "secondary" : "ghost"}
					size="icon"
					className="rounded-full w-9 h-9"
					onClick={() => setMode("pan")}
				>
					<Hand className="w-4 h-4" />
				</Button>

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
			</Menubar>
		</div>
	);
});

export { Toolbar };
