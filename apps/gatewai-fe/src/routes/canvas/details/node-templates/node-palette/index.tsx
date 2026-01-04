import { ScrollArea } from "@radix-ui/react-scroll-area";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NodeTemplateListRPC } from "@/rpc/types";
import { useNodeTemplates } from "../node-templates.ctx";
import { CATEGORY_MAP } from "./category-icon-map";
import { DataTypeMultiSelect } from "./io-filter";
import { NodePaletteProvider, useNodePalette } from "./node-palette.ctx";
import { NodeTemplateList } from "./node-template-list";
import { SearchInput } from "./search";

export function NodePalette() {
	const { nodeTemplates, isError, isLoading } = useNodeTemplates();

	if (isLoading || !nodeTemplates) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground animate-pulse">
				<span className="text-sm font-medium tracking-tight">
					Synchronizing...
				</span>
			</div>
		);
	}

	if (isError) return <div className="p-4 text-destructive">System Error</div>;

	return (
		<NodePaletteProvider>
			<NodePaletteContent templates={nodeTemplates} />
		</NodePaletteProvider>
	);
}

function NodePaletteContent({ templates }: { templates: NodeTemplateListRPC }) {
	const {
		isCollapsed,
		setIsCollapsed,
		categoryRefs,
		activeCategory,
		setActiveCategory,
	} = useNodePalette();
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				let visibleCat: string | null = null;
				let maxRatio = -1;
				entries.forEach((entry) => {
					if (entry.intersectionRatio > maxRatio) {
						maxRatio = entry.intersectionRatio;
						visibleCat = entry.target.getAttribute("data-category");
					}
				});
				if (visibleCat) {
					setActiveCategory(visibleCat);
				}
			},
			{
				root: scrollRef.current,
				threshold: [0, 0.5, 1.0],
			},
		);

		Object.values(categoryRefs.current).forEach((ref) => {
			if (ref.current) {
				observer.observe(ref.current);
			}
		});

		return () => {
			observer.disconnect();
		};
	}, [templates, setActiveCategory, categoryRefs]);

	return (
		<div
			className={cn(
				"relative flex flex-col h-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
				"bg-background/80 backdrop-blur-xl border-r border-border/40 shadow-sm",
				isCollapsed ? "w-[72px]" : "w-68",
			)}
		>
			{/* Header Area */}
			<div className="flex items-center justify-between px-5 py-6">
				{!isCollapsed && (
					<span className="text-lg font-semibold tracking-tight opacity-90">
						Library
					</span>
				)}
				<Button
					variant="ghost"
					size="icon"
					className="hover:bg-accent/50 rounded-full h-8 w-8 ml-auto"
					onClick={() => setIsCollapsed(!isCollapsed)}
				>
					{isCollapsed && <ChevronRight className="h-4 w-4" />}
				</Button>
			</div>

			<div className="flex items-stretch">
				<div className="flex flex-col gap-5 mt-2 items-center">
					{Object.entries(CATEGORY_MAP).map(([cat, { icon: Icon, color }]) => (
						<TooltipProvider key={cat} delayDuration={0}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className={cn(
											"h-10 w-10 rounded-xl hover:scale-110 active:scale-95 transition-all",
											activeCategory === cat && `bg-[${color}/20]`,
										)}
										onClick={() => {
											setIsCollapsed(false);
											categoryRefs.current[cat]?.current?.scrollIntoView({
												behavior: "smooth",
												block: "start",
											});
										}}
									>
										<Icon className="h-5 w-5" style={{ color }} />
									</Button>
								</TooltipTrigger>
								<TooltipContent side="right" className="font-medium">
									{cat}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					))}
				</div>

				{!isCollapsed && (
					<div className="flex flex-col flex-1 px-4 overflow-hidden">
						<div className="space-y-4 mb-4">
							<SearchInput />
							<DataTypeMultiSelect />
						</div>
						<Separator className="opacity-50" />
						<ScrollArea
							ref={scrollRef}
							className="flex-1 custom-scrollbar pt-4"
						>
							<NodeTemplateList templates={templates} />
						</ScrollArea>
					</div>
				)}
			</div>
		</div>
	);
}
