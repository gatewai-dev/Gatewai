import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GatewaiLogo } from "@/components/ui/logo";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NodeTemplateListRPC } from "@/rpc/types";
import { CanvasName } from "../../reactflow-container/left-panel/canvas-name";
import { AssetsSection } from "../assets/assets-section";
import { useNodeTemplates } from "../node-templates.ctx";
import { NodePaletteProvider, useNodePalette } from "./node-palette.ctx";
import { NodeTemplateList } from "./node-template-list";
import { SearchInput } from "./search";

export function NodePalette() {
	const { nodeTemplates, isLoading } = useNodeTemplates();

	if (isLoading || !nodeTemplates) {
		return null;
	}

	return (
		<NodePaletteProvider>
			<NodePaletteContent templates={nodeTemplates} />
		</NodePaletteProvider>
	);
}

function NodePaletteContent({ templates }: { templates: NodeTemplateListRPC }) {
	const { isCollapsed, setIsCollapsed } = useNodePalette();

	return (
		<aside
			className={cn(
				"relative z-40 flex h-[calc(100vh-1rem)] my-2 ml-2 flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
				"rounded-3xl border border-white/10 bg-background/60 shadow-2xl backdrop-blur-xl", // Glass effect
				isCollapsed ? "w-[60px]" : "w-72",
			)}
		>
			{/* --- Header Section --- */}
			<div className="flex shrink-0 items-center justify-between px-3 py-4">
				<div
					className={cn(
						"flex items-center gap-2 overflow-hidden transition-all duration-300 pr-0.5",
						isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100",
					)}
				>
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
						<GatewaiLogo className="h-5 w-5" />
					</div>
					<CanvasName />
				</div>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={(e) => {
								e.stopPropagation();
								setIsCollapsed(!isCollapsed);
							}}
							className="h-8 w-8 p-0 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							{isCollapsed ? (
								<PanelLeftOpen className="h-5 w-5" />
							) : (
								<PanelLeftClose className="h-5 w-5" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right" className="text-xs">
						{isCollapsed ? "Expand Library" : "Collapse Library"}
					</TooltipContent>
				</Tooltip>
			</div>

			<div className="flex flex-1 flex-col grow h-full overflow-hidden">
				<div
					className={cn(
						"shrink-0 px-3 pb-3 transition-all duration-300",
						isCollapsed
							? "-translate-x-full opacity-0"
							: "translate-x-0 opacity-100",
					)}
				>
					<SearchInput />
				</div>

				<div
					className={cn(
						"h-px w-full bg-gradient-to-r from-transparent via-border to-transparent",
						isCollapsed && "hidden",
					)}
				/>

				{/* Scrollable List */}
				{!isCollapsed && (
					<div className="pb-4 pt-3 flex-1 overflow-y-auto min-h-0">
						<NodeTemplateList templates={templates} />
					</div>
				)}

				{isCollapsed && (
					<div className="flex flex-1 flex-col items-center gap-4 py-4 opacity-50">
						<div className="h-px w-8 bg-border" />
					</div>
				)}
			</div>

			<div className="mt-auto shrink-0 z-50">
				<AssetsSection isCollapsed={isCollapsed} />
			</div>
		</aside>
	);
}
