import { ChevronLeft } from "lucide-react";
import { useEffect, useRef } from "react";
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
import { useNodeTemplates } from "../node-templates.ctx";
import { CATEGORY_MAP } from "./category-icon-map";
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
	}, [setActiveCategory, categoryRefs]);

	return (
		<div
			className={cn(
				"relative bg-transparent flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
				"bg-background/90 backdrop-blur-xl border-r border-border/40 shadow-sm h-screen",
				isCollapsed ? "w-[50px]" : "w-76",
			)}
		>
			<div className="flex h-full overflow-hidden">
				<div className="flex flex-col items-center w-[60px] border-r border-border/10 py-4 gap-4">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={isCollapsed ? "ghost" : "default"}
								size="icon"
								onClick={() => setIsCollapsed(!isCollapsed)}
								className={cn(
									"h-12 w-12 rounded-xl transition-all duration-200",
									isCollapsed ? "rotate-0 hover:rotate-270" : "rotate-90",
								)}
							>
								<YodesLogo className="size-8" />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="right">
							{isCollapsed ? "Expand" : "Collapse"}
						</TooltipContent>
					</Tooltip>

					<Separator className="w-8 opacity-50" />

					{/* Category Icons */}
					<div className="flex flex-col gap-4 items-center">
						{Object.entries(CATEGORY_MAP).map(
							([cat, { icon: Icon, color }]) => (
								<Tooltip key={cat}>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className={cn(
												"h-10 w-10 rounded-xl transition-all",
												activeCategory === cat
													? "scale-110"
													: "opacity-50 hover:opacity-100",
											)}
											style={{
												backgroundColor:
													activeCategory === cat ? `${color}33` : "transparent",
											}}
											onClick={() => {
												if (isCollapsed) setIsCollapsed(false);
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
							),
						)}
					</div>
				</div>

				{/* Search and List Content */}
				<div
					className={cn(
						"flex flex-col flex-1 px-4 h-screen transition-all duration-300",
						isCollapsed
							? "opacity-0 invisible w-0"
							: "opacity-100 visible w-auto",
					)}
				>
					<div className="space-y-4 mb-4 mt-8">
						<SearchInput />
					</div>
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
