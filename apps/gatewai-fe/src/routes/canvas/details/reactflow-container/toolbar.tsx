import { useReactFlow, useViewport } from "@xyflow/react";
import { ChevronDown, ForwardIcon, Hand, MousePointer } from "lucide-react"; // Added ForwardIcon
import { memo, useContext } from "react";
import { Button } from "@/components/ui/button";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "@/components/ui/menubar";
import { Separator } from "@/components/ui/separator";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { ModeContext } from ".";
import { CanvasTasksPanel } from "./tasks";

const Toolbar = memo(() => {
	const { zoom } = useViewport();
	const { runNodes } = useCanvasCtx();
	const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow(); // Added getNodes for context
	const zoomPercentage = `${Math.round(zoom * 100)}%`;
	const ctx = useContext(ModeContext);

	const handleRunAll = () => {
		runNodes();
	};

	return (
		<Menubar className="border border-border/50 bg-background/80 backdrop-blur-md shadow-2xl rounded-full px-2 py-1 h-12 ring-1 ring-white/5 flex items-center gap-1">
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

			<div className="w-px h-5 bg-border mx-1" />

			<MenubarMenu>
				<MenubarTrigger asChild>
					<Button
						variant="ghost"
						className="h-9 px-3 text-xs font-mono rounded-full"
					>
						{zoomPercentage} <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
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

			{/* Separator before the Action Button */}
			<div className="w-px h-5 bg-border mx-1" />

			{/* Run All Nodes Button */}
			<Button
				variant="default"
				size="sm"
				className="rounded-full h-9 px-4 gap-2 shadow-sm transition-all"
				onClick={handleRunAll}
			>
				<ForwardIcon className="w-4 h-4" />
				<span className="text-xs">Run All</span>
			</Button>
			<CanvasTasksPanel />
		</Menubar>
	);
});

export { Toolbar };
