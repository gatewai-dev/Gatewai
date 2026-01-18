"use client";

import {
	AnimatePresence,
	type AnimationGeneratorType,
	motion,
} from "framer-motion";
import {
	Grid,
	Image as ImageIcon,
	Images,
	Loader2,
	Music,
	PackageOpen,
	Search,
	Video,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "use-debounce";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useUserAssets } from "@/routes/canvas/assets/user-assets-ctx";
import { AssetItem } from "./asset-item";
import type { FileAssetEntity } from "./types";

interface AssetsSectionProps {
	isCollapsed: boolean;
}

type AssetTypeFilter = "all" | "image" | "video" | "audio";

const FILTER_CONFIG = {
	all: { label: "All", icon: Grid, value: undefined },
	image: { label: "Images", icon: ImageIcon, value: "image" },
	video: { label: "Videos", icon: Video, value: "video" },
	audio: { label: "Audio", icon: Music, value: "audio" },
} as const;

// Engineering Note: Standardized spring for brand consistency
const TRANSITION_SPRING = {
	type: "spring" as AnimationGeneratorType,
	stiffness: 500,
	damping: 35,
	mass: 1,
};

export function AssetsSection({ isCollapsed }: AssetsSectionProps) {
	const [isOpen, setIsOpen] = useState(false);
	const { assets: assetsData, isLoading, setQueryParams } = useUserAssets();

	const [searchValue, setSearchValue] = useState("");
	const [activeFilter, setActiveFilter] = useState<AssetTypeFilter>("all");
	const [debouncedSearch] = useDebounce(searchValue, 250); // Reduced for perceived snappiness

	useEffect(() => {
		setQueryParams((prev) => ({
			...prev,
			query: {
				...prev.query,
				q: debouncedSearch.trim() || undefined,
				type: FILTER_CONFIG[activeFilter].value,
				pageIndex: "0",
			},
		}));
	}, [debouncedSearch, activeFilter, setQueryParams]);

	const assets = useMemo(
		() => (assetsData?.assets as FileAssetEntity[]) ?? [],
		[assetsData],
	);

	const hasActiveFilters = searchValue.trim() !== "" || activeFilter !== "all";

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					className={cn(
						"group relative flex h-12 w-full items-center gap-3 rounded-none border-t transition-all hover:bg-accent",
						isCollapsed ? "justify-center px-0" : "justify-start px-4",
						isOpen && "bg-accent",
					)}
				>
					<div
						className={cn(
							"flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
							isOpen
								? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
								: "bg-primary/10 text-primary group-hover:bg-primary/20",
						)}
					>
						<Images className="h-4.5 w-4.5" />
					</div>

					{!isCollapsed && (
						<div className="flex min-w-0 flex-col items-start overflow-hidden text-left">
							<span className="text-sm font-medium leading-tight">
								Your Assets
							</span>
							<span className="text-[10px] text-muted-foreground tabular-nums">
								{isLoading ? "Updating..." : `${assets.length} items`}
							</span>
						</div>
					)}
				</Button>
			</PopoverTrigger>

			<PopoverContent
				side="right"
				align="end"
				sideOffset={12}
				className="w-[380px] overflow-hidden p-0 shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
			>
				<div className="flex h-[680px] flex-col bg-background">
					{/* Header */}
					<div className="space-y-3 border-b bg-muted/20 p-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<h4 className="text-sm font-semibold tracking-tight">
									Library
								</h4>
								<span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary uppercase tracking-wider">
									Cloud
								</span>
							</div>
						</div>

						<div className="group relative">
							<Search className="absolute z-10 left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
							<Input
								placeholder="Search library..."
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								className="h-10 pl-9 pr-9 focus-visible:ring-1 focus-visible:ring-primary/50"
							/>
							<AnimatePresence>
								{searchValue && (
									<motion.div
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.8 }}
										className="absolute right-1 top-1/2 -translate-y-1/2"
									>
										<Button
											size="icon"
											variant="ghost"
											className="size-8 text-muted-foreground hover:text-foreground"
											onClick={() => setSearchValue("")}
										>
											<X className="size-4" />
										</Button>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</div>

					{/* Navigation */}
					<div className="px-4 py-2 border-b bg-background/50">
						<Tabs
							value={activeFilter}
							onValueChange={(v) => setActiveFilter(v as AssetTypeFilter)}
						>
							<TabsList className="h-9 w-full bg-muted/40 p-1">
								{Object.entries(FILTER_CONFIG).map(([key, config]) => (
									<TabsTrigger
										key={key}
										value={key}
										className="flex-1 gap-1.5 text-xs data-[state=active]:bg-background"
									>
										<config.icon className="size-3.5" />
										<span>{config.label}</span>
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>

					{/* Main Content Area */}
					<div className="flex-1 overflow-hidden bg-muted/5">
						<ScrollArea className="h-full">
							<div className="p-4">
								{isLoading ? (
									<div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
										<Loader2 className="h-6 w-6 animate-spin text-primary/60" />
										<p className="text-xs font-medium text-muted-foreground">
											Fetching assets...
										</p>
									</div>
								) : assets.length > 0 ? (
									<div className="grid grid-cols-2 gap-3">
										<AnimatePresence mode="popLayout" initial={false}>
											{assets.map((asset, index) => (
												<motion.div
													key={asset.id}
													layout
													initial={{ opacity: 0, y: 10 }}
													animate={{ opacity: 1, y: 0 }}
													exit={{ opacity: 0, scale: 0.95 }}
													transition={{
														...TRANSITION_SPRING,
														delay: Math.min(index * 0.03, 0.3), // Stagger limited to first 10 items
													}}
												>
													<AssetItem asset={asset} />
												</motion.div>
											))}
										</AnimatePresence>
									</div>
								) : (
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center"
									>
										<div className="mb-4 rounded-2xl bg-muted/50 p-4 ring-1 ring-muted-foreground/10">
											<PackageOpen className="h-8 w-8 text-muted-foreground/40" />
										</div>
										<h3 className="text-sm font-semibold">No results</h3>
										<p className="mt-1 max-w-[180px] text-xs leading-relaxed text-muted-foreground">
											{hasActiveFilters
												? "Try a different search term or filter."
												: "Your library is empty. Upload assets to see them here."}
										</p>
										{hasActiveFilters && (
											<Button
												variant="outline"
												className="mt-4 h-8 px-3 text-xs"
												onClick={() => {
													setSearchValue("");
													setActiveFilter("all");
												}}
											>
												Clear filters
											</Button>
										)}
									</motion.div>
								)}
							</div>
						</ScrollArea>
					</div>

					{/* Footer */}
					<footer className="flex items-center justify-between border-t bg-muted/10 px-4 py-2">
						<div className="flex items-center gap-1.5">
							<div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
							<span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
								{activeFilter}
							</span>
						</div>
						<span className="text-[10px] font-medium tabular-nums text-muted-foreground">
							{assets.length} items
						</span>
					</footer>
				</div>
			</PopoverContent>
		</Popover>
	);
}
