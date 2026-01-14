import {
	Grid,
	Image,
	Images,
	Loader2,
	Music,
	PackageOpen,
	Search,
	Video,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
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

const FILTER_VALUES = {
	all: undefined,
	image: "image",
	video: "video",
	audio: "audio",
} as const;

const FILTER_ICONS = {
	all: Grid,
	image: Image,
	video: Video,
	audio: Music,
} as const;

export function AssetsSection({ isCollapsed }: AssetsSectionProps) {
	const [isOpen, setIsOpen] = useState(false);
	const { assets: assetsData, isLoading, setQueryParams } = useUserAssets();

	const [searchValue, setSearchValue] = useState("");
	const [activeFilter, setActiveFilter] = useState<AssetTypeFilter>("all");

	const [debouncedSearch] = useDebounce(searchValue, 300);

	useEffect(() => {
		setQueryParams((prev) => ({
			...prev,
			query: {
				...prev.query,
				q: debouncedSearch.trim() || undefined,
				type: FILTER_VALUES[activeFilter],
				pageIndex: "0",
			},
		}));
	}, [debouncedSearch, activeFilter, setQueryParams]);

	const assets = (assetsData?.assets as FileAssetEntity[]) ?? [];

	const hasFilterOrSearch = searchValue.trim() !== "" || activeFilter !== "all";

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					className={cn(
						"flex h-12 w-full items-center gap-3 rounded-none border-t",
						isCollapsed ? "justify-center px-0" : "justify-start px-4",
					)}
				>
					<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 shadow-sm">
						<Images className="h-5 w-5 text-primary" />
					</div>

					{!isCollapsed && (
						<div className="flex min-w-0 flex-col items-start overflow-hidden">
							<span className="text-sm font-medium leading-tight">
								Your Assets
							</span>
							<span className="text-[10px] text-muted-foreground">
								{isLoading ? "Loading..." : `${assets.length} items`}
							</span>
						</div>
					)}
				</Button>
			</PopoverTrigger>

			<PopoverContent
				side="right"
				align="end"
				className="w-[360px] p-0 shadow-2xl backdrop-blur-xl bg-background/95 border border-border/50"
				sideOffset={12}
			>
				<div className="flex h-[640px] flex-col">
					{/* Header */}
					<div className="border-b bg-muted/30 px-4 py-3.5">
						<div className="mb-3 flex items-center justify-between">
							<h4 className="text-sm font-semibold">Asset Library</h4>
							<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
								All Canvases
							</span>
						</div>

						<div className="relative">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 z-10" />
							<Input
								placeholder="Search assets..."
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								className="h-9 pl-9 pr-9 bg-background/60 border-border/40 text-sm shadow-sm"
							/>
							{searchValue && (
								<Button
									size="icon"
									variant="ghost"
									className="absolute right-1 top-1/2 size-7 -translate-y-1/2 hover:bg-muted/70"
									onClick={() => setSearchValue("")}
								>
									<X className="size-4" />
								</Button>
							)}
						</div>
					</div>

					{/* Tabs with icons */}
					<div className="border-b bg-muted/20 px-3 py-2">
						<Tabs
							value={activeFilter}
							onValueChange={(v) => setActiveFilter(v as AssetTypeFilter)}
							className="w-full"
						>
							<TabsList className="grid w-full grid-cols-4 bg-transparent p-0.5 h-9 border border-border/40 rounded-md">
								{(["all", "image", "video", "audio"] as const).map((value) => {
									const Icon = FILTER_ICONS[value];
									return (
										<TabsTrigger
											key={value}
											value={value}
											className="text-xs gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:shadow-sm"
										>
											<Icon className="h-3.5 w-3.5" />
											<span className="hidden sm:inline">
												{value === "all"
													? "All"
													: value.charAt(0).toUpperCase() + value.slice(1)}
											</span>
										</TabsTrigger>
									);
								})}
							</TabsList>
						</Tabs>
					</div>

					{/* Content - better scroll handling */}
					<div className="flex-1 overflow-hidden">
						<ScrollArea className="h-full">
							<div className="p-3 pb-8">
								{isLoading ? (
									<div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-muted-foreground">
										<Loader2 className="h-7 w-7 animate-spin" />
										<span className="text-sm">Loading your assets...</span>
									</div>
								) : assets.length > 0 ? (
									<div className="grid grid-cols-1 gap-1.5">
										{assets.map((asset) => (
											<AssetItem key={asset.id} asset={asset} />
										))}
									</div>
								) : (
									<div className="flex min-h-80 flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
										<PackageOpen
											className="h-10 w-10 opacity-60"
											strokeWidth={1.4}
										/>
										<div className="space-y-1.5">
											<p className="text-base font-medium text-foreground/80">
												No assets found
											</p>
											<p className="text-xs leading-relaxed">
												{hasFilterOrSearch
													? "Try different search terms or filters"
													: "Upload some files to start using them in your canvas"}
											</p>
										</div>
									</div>
								)}
							</div>

							{/* Extra padding at bottom */}
							<div className="h-12" />
						</ScrollArea>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
