import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { YodesLogo } from "@/components/ui/logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NodeTemplateListRPC } from "@/rpc/types";
import { CanvasName } from "../../reactflow-container/left-panel/canvas-name";
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
	const scrollRef = useRef<HTMLDivElement>(null);

	return (
		<div
			className={cn(
				"relative bg-transparent flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
				"bg-background/90 backdrop-blur-xl border-r border-border/40 shadow-sm h-screen",
				isCollapsed ? "w-[52px]" : "w-60 pr-2",
			)}
		>
			<div className="flex flex-col h-full overflow-hidden">
				<div className="flex flex-row items-center border-r ml-1 my-4 border-border/10 gap-4">
					{!isCollapsed && <CanvasName />}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={isCollapsed ? "ghost" : "default"}
								size="icon"
								onClick={() => setIsCollapsed(!isCollapsed)}
								className={cn(
									"h-10 w-10 rounded-xl transition-all duration-200",
									isCollapsed ? "rotate-0 hover:rotate-270" : "rotate-90",
								)}
							>
								<YodesLogo className="size-8" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">
							{isCollapsed ? "Expand Node Menu" : "Collapse"}
						</TooltipContent>
					</Tooltip>
				</div>
				<Separator className="my-2 opacity-50" />

				{/* Search and List Content */}
				<div
					className={cn(
						"flex flex-col flex-1 mx-4 h-[calc(100%-16rem)] transition-all duration-300",
						isCollapsed
							? "opacity-0 invisible w-0"
							: "opacity-100 visible w-auto",
					)}
				>
					{!isCollapsed && <SearchInput />}
					<Separator className="opacity-50" />
					<ScrollArea
						ref={scrollRef}
						className="flex-1 overflow-auto grow pt-4"
					>
						<NodeTemplateList templates={templates} />
					</ScrollArea>
				</div>
			</div>
		</div>
	);
}
