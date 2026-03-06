import type { NodeTemplateListRPC } from "@gatewai/react-store";
import {
	Button,
	cn,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@gatewai/ui-kit";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { AssetsSection } from "../../assets";
import { useNodeTemplates } from "../node-templates.ctx";
import { GuidesDialog } from "./guides-dialog";
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
			<SidePanel>
				<NodeLibrary templates={nodeTemplates} />

				<SidePanelFooter />
			</SidePanel>
		</NodePaletteProvider>
	);
}

export function SidePanel({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	const { isCollapsed } = useNodePalette();
	return (
		<aside
			className={cn(
				"relative z-40 flex h-[calc(100vh-1rem)] my-2 ml-2 flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
				"rounded-3xl border border-white/10 bg-background/60 shadow-2xl backdrop-blur-xl",
				isCollapsed ? "w-[60px]" : "w-72",
				className,
			)}
		>
			{children}
		</aside>
	);
}

export function CollapseButton() {
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

export function NodeLibrary({ templates }: { templates: NodeTemplateListRPC }) {
	const { isCollapsed } = useNodePalette();
	return (
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
					"h-px w-full bg-linear-to-r from-transparent via-border to-transparent",
					isCollapsed && "hidden",
				)}
			/>

			{/* Scrollable List */}
			{!isCollapsed && (
				<div className="flex-1 overflow-y-auto min-h-0">
					<NodeTemplateList templates={templates} />
				</div>
			)}

			{isCollapsed && (
				<div className="flex flex-1 flex-col items-center gap-4 py-4 opacity-50">
					<div className="h-px w-8 bg-border" />
				</div>
			)}
		</div>
	);
}

export function SidePanelFooter() {
	const { isCollapsed } = useNodePalette();
	return (
		<div className=" shrink-0 z-50 flex flex-col">
			<div
				className={cn(
					"flex w-full items-center justify-evenly",
					isCollapsed && "flex-col gap-4 pb-4",
				)}
			>
				<SocialLink
					href="https://discord.gg/ha4A8UD7kn"
					icon={<FaDiscord className="size-5" />}
					label="Discord"
					isCollapsed={true}
				/>
				<SocialLink
					href="https://github.com/gatewai-dev/Gatewai"
					icon={<FaGithub className="size-5" />}
					label="GitHub"
					isCollapsed={true}
				/>
				<GuidesDialog isCollapsed={true} />
			</div>
			<AssetsSection isCollapsed={isCollapsed} />
		</div>
	);
}

function SocialLink({
	href,
	icon,
	label,
	isCollapsed,
}: {
	href: string;
	icon: React.ReactNode;
	label: string;
	isCollapsed: boolean;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<a
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className={cn(
						"flex items-center gap-3 rounded-xl px-2 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
						isCollapsed ? "justify-center" : "justify-start",
					)}
				>
					<span className="shrink-0">{icon}</span>
					{!isCollapsed && (
						<span className="text-sm font-medium animate-in fade-in slide-in-from-left-2">
							{label}
						</span>
					)}
				</a>
			</TooltipTrigger>
			{isCollapsed && <TooltipContent side="top">{label}</TooltipContent>}
		</Tooltip>
	);
}
