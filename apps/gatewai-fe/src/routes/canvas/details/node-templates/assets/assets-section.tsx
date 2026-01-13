import { Images, Loader2, PackageOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useGetUserAssetsQuery } from "@/store/assets";
import { AssetItem } from "./asset-item";
import type { FileAssetEntity } from "./types";

interface AssetsSectionProps {
	isCollapsed: boolean;
}

export function AssetsSection({ isCollapsed }: AssetsSectionProps) {
	const [isOpen, setIsOpen] = useState(false);

	// Assuming query param structure - passing empty object to list all
	const { data: assetsData, isLoading } = useGetUserAssetsQuery({ query: {} });

	// Adjust based on actual RPC response structure
	const assets = (assetsData?.assets as unknown as FileAssetEntity[]) || [];

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="default"
					className={cn(
						"flex h-12 w-full items-center gap-3 rounded-none border-t",
						isCollapsed ? "justify-center" : "justify-start",
					)}
				>
					<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-secondary-foreground shadow-sm">
						<Images className="h-4 w-4" />
					</div>

					<div
						className={cn(
							"flex flex-col items-start overflow-hidden transition-all duration-300",
							isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100",
						)}
					>
						<span className="text-sm font-medium">Assets</span>
						<span className="text-[10px]">
							{isLoading ? "Loading..." : `${assets.length} items`}
						</span>
					</div>
				</Button>
			</PopoverTrigger>

			<PopoverContent
				side="right"
				align="end"
				className="w-auto p-0uto shadow-2xl backdrop-blur-3xl bg-background/95 border-white/10"
				sideOffset={10}
			>
				<ScrollArea viewPortCn=" h-[400px] flex flex-col">
					<div className="flex items-center justify-between border-b px-4 py-3 bg-muted/20">
						<h4 className="font-semibold text-sm">Your Assets</h4>
						<span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
							Library
						</span>
					</div>

					<ScrollArea className="flex-1 p-2">
						{isLoading ? (
							<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
								<Loader2 className="h-6 w-6 animate-spin" />
								<span className="text-xs">Loading assets...</span>
							</div>
						) : assets.length > 0 ? (
							<div className="grid gap-1">
								{assets.map((asset) => (
									<AssetItem key={asset.id} asset={asset} />
								))}
							</div>
						) : (
							<div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground p-4 text-center">
								<PackageOpen className="h-8 w-8 opacity-50" />
								<div className="flex flex-col gap-1">
									<span className="text-sm font-medium">No assets found</span>
									<span className="text-xs text-muted-foreground/70">
										Upload files to use them in your canvas
									</span>
								</div>
							</div>
						)}
					</ScrollArea>
				</ScrollArea>
			</PopoverContent>
		</Popover>
	);
}
