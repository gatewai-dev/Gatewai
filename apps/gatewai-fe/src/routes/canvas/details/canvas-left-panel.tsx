import {
	NodeLibrary,
	NodePaletteProvider,
	SidePanel,
	SidePanelFooter,
	useNodePalette,
	useNodeTemplates,
} from "@gatewai/react-canvas";
import {
	Button,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@gatewai/ui-kit";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { CanvasName } from "./canvas-name";
import { UserMenu } from "./user-menu";

export function CanvasLeftPanel() {
	const { nodeTemplates, isLoading } = useNodeTemplates();

	if (isLoading || !nodeTemplates) {
		return null;
	}

	return (
		<NodePaletteProvider>
			<SidePanel>
				<div className="flex shrink-0 items-center justify-between px-3 py-4">
					<div className="flex items-center gap-2 overflow-hidden transition-all duration-300 pr-0.5">
						<UserMenu />
						<CanvasName />
					</div>
					<CollapseButton />
				</div>

				<NodeLibrary templates={nodeTemplates} />
				<SidePanelFooter />
			</SidePanel>
		</NodePaletteProvider>
	);
}

function CollapseButton() {
	const { isCollapsed, setIsCollapsed } = useNodePalette();
	return (
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
						<PanelLeftOpen className="size-6" />
					) : (
						<PanelLeftClose className="size-6" />
					)}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="right" className="text-xs">
				{isCollapsed ? "Expand Library" : "Collapse Library"}
			</TooltipContent>
		</Tooltip>
	);
}
