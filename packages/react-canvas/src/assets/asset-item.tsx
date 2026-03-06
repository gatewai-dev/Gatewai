import { getDataTypeFromMime } from "@gatewai/core/browser";
import type { FileData, NodeResult } from "@gatewai/core/types";
import { useReactFlow } from "@gatewai/react-canvas";
import { useDeleteAssetMutation } from "@gatewai/react-store";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@gatewai/ui-kit";
import { motion } from "framer-motion";
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	PiDotsThreeCircle,
	PiFileDashed,
	PiImageSquare,
	PiMusicNotesSimple,
	PiSpinnerGap,
	PiSubtitles,
	PiTrash,
} from "react-icons/pi";
import { toast } from "sonner";
import { useCanvasCtx } from "../canvas-ctx";
import { cn } from "../lib/utils";
import { useNodeTemplates } from "../node-templates/node-templates.ctx";
import type { FileAssetEntity } from "./types";
import { GetAssetThumbnailEndpoint } from "./utils";

const DragOverlay = ({
	asset,
	position,
}: {
	asset: FileAssetEntity;
	position: { x: number; y: number };
}) => {
	const thumbnail = GetAssetThumbnailEndpoint(asset);
	const isAudio = asset.mimeType?.startsWith("audio/");
	const isSrt =
		asset.name?.toLowerCase().endsWith(".srt") ||
		asset.mimeType === "application/x-subrip";

	return createPortal(
		<div
			className="fixed z-[9999] pointer-events-none"
			style={{
				left: position.x,
				top: position.y,
				transform: "translate(-50%, -50%)",
			}}
		>
			<div
				className={cn(
					"flex items-center gap-3 p-2.5 pr-5",
					"bg-background/70 backdrop-blur-2xl border border-border/40",
					"rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]",
					"w-56",
				)}
			>
				{/* Thumbnail Preview */}
				<div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted/50 border border-border/30">
					{isSrt ? (
						<div className="flex h-full w-full items-center justify-center">
							<PiSubtitles className="h-5 w-5 text-muted-foreground" />
						</div>
					) : isAudio ? (
						<div className="flex h-full w-full items-center justify-center">
							<PiMusicNotesSimple className="h-5 w-5 text-muted-foreground" />
						</div>
					) : thumbnail ? (
						<img
							src={thumbnail}
							alt={asset.name}
							className="h-full w-full object-cover"
							loading="lazy"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<PiImageSquare className="h-5 w-5 text-muted-foreground" />
						</div>
					)}
				</div>
				<div className="flex flex-col overflow-hidden">
					<span className="text-sm font-medium text-foreground truncate tracking-tight">
						{asset.name}
					</span>
					<span className="text-xs text-muted-foreground/70 font-medium mt-0.5">
						Drop to add node
					</span>
				</div>
			</div>
		</div>,
		document.body,
	);
};

type AssetItemProps = {
	asset: FileAssetEntity;
};

export const AssetItem = memo(({ asset }: AssetItemProps) => {
	const { createNewNode } = useCanvasCtx();
	const { nodeTemplates } = useNodeTemplates();
	const rfInstance = useReactFlow();

	const [isDragging, setIsDragging] = useState(false);
	const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
	const itemRef = useRef<HTMLDivElement>(null);

	const thumbnail = GetAssetThumbnailEndpoint(asset);
	const [deleteAsset, { isLoading: isDeleting }] = useDeleteAssetMutation();
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const isAudio = asset.mimeType?.startsWith("audio/");
	const isSrt =
		asset.name?.toLowerCase().endsWith(".srt") ||
		asset.mimeType === "application/x-subrip";

	const handleDelete = async () => {
		try {
			await deleteAsset(asset.id).unwrap();
			toast.success("Asset deleted successfully");
		} catch (error) {
			toast.error("Failed to delete asset");
			console.error(error);
		} finally {
			setShowDeleteDialog(false);
		}
	};

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			setCursorPos({ x: e.clientX, y: e.clientY });
		};

		const handleMouseUp = (e: MouseEvent) => {
			setIsDragging(false);

			const flowContainer = document.querySelector(".react-flow-container");
			if (!flowContainer) return;

			const flowRect = flowContainer.getBoundingClientRect();
			const isInside =
				e.clientX >= flowRect.left &&
				e.clientX <= flowRect.right &&
				e.clientY >= flowRect.top &&
				e.clientY <= flowRect.bottom;

			if (isInside && rfInstance) {
				const position = rfInstance.screenToFlowPosition({
					x: e.clientX,
					y: e.clientY,
				});
				const importTemplate = nodeTemplates?.find((f) => f.type === "Import");
				if (!importTemplate) {
					console.error("Import template not found");
					return;
				}
				const dataType = getDataTypeFromMime(asset.mimeType);
				if (!dataType) {
					console.error("Unsupported asset mime type:", asset.mimeType);
					return;
				}
				const initialResult = {
					selectedOutputIndex: 0,
					outputs: [
						{
							items: [
								{
									type: dataType,
									data: {
										entity: {
											...asset,
											createdAt: new Date(asset.createdAt),
											updatedAt: new Date(asset.updatedAt),
											signedUrlExp: asset.signedUrlExp
												? new Date(asset.signedUrlExp)
												: null,
										},
									} as FileData,
									outputHandleId: undefined,
								},
							],
						},
					],
				} as NodeResult;
				createNewNode(importTemplate, position, initialResult);
			}
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, asset, createNewNode, rfInstance, nodeTemplates]);

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		setCursorPos({ x: e.clientX, y: e.clientY });
		setIsDragging(true);
	};

	return (
		<>
			{isDragging && <DragOverlay asset={asset} position={cursorPos} />}

			<motion.div
				ref={itemRef}
				layoutId={`asset-item-${asset.id}`}
				className={cn(
					"group relative flex w-full select-none items-center gap-3",
					"rounded-xl border border-transparent p-2 transition-all duration-300 ease-out",
					"hover:bg-muted/60 hover:border-border/40",
					isDragging ? "opacity-40 grayscale scale-[0.98]" : "opacity-100",
				)}
			>
				<div
					onMouseDown={handleMouseDown}
					className="flex flex-1 items-center gap-3.5 cursor-grab active:cursor-grabbing min-w-0"
				>
					{/* Thumbnail */}
					<div
						className={cn(
							"relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/30 bg-muted/40",
							"transition-colors duration-300 group-hover:border-border/60",
						)}
					>
						{isSrt ? (
							<div className="flex h-full w-full items-center justify-center bg-muted/20">
								<PiSubtitles className="h-5 w-5 text-muted-foreground/80" />
							</div>
						) : isAudio ? (
							<div className="flex h-full w-full items-center justify-center bg-muted/20">
								<PiMusicNotesSimple className="h-5 w-5 text-muted-foreground/80" />
							</div>
						) : thumbnail ? (
							<img
								src={thumbnail}
								alt={asset.name}
								className="h-full w-full object-cover"
								loading="lazy"
							/>
						) : (
							<div className="flex h-full w-full items-center justify-center bg-muted/20">
								<PiFileDashed className="h-5 w-5 text-muted-foreground/60" />
							</div>
						)}
					</div>

					{/* Info */}
					<div className="flex flex-1 flex-col overflow-hidden">
						<span className="truncate text-sm font-medium text-foreground tracking-tight">
							{asset.name}
						</span>
						<div className="flex items-center gap-1.5 mt-0.5">
							<span className="truncate text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
								{asset.mimeType?.split("/")[1] || "Unknown"}
							</span>
							{asset.duration && (
								<>
									<span className="text-muted-foreground/40 text-[10px]">
										•
									</span>
									<span className="text-[11px] text-muted-foreground/70">
										{/* Duration formatting goes here */}
									</span>
								</>
							)}
						</div>
					</div>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className={cn(
								"opacity-0 group-hover:opacity-100 transition-all duration-200",
								"p-1.5 hover:bg-background rounded-lg focus:opacity-100 outline-none border border-transparent",
								"hover:border-border/50 shadow-sm hover:shadow-md",
							)}
						>
							{isDeleting ? (
								<PiSpinnerGap className="h-4 w-4 animate-spin text-muted-foreground" />
							) : (
								<PiDotsThreeCircle className="h-[18px] w-[18px] text-muted-foreground hover:text-foreground transition-colors" />
							)}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						className="w-44 rounded-xl shadow-lg"
					>
						<DropdownMenuItem
							className="focus:bg-destructive/10 text-destructive focus:text-destructive cursor-pointer gap-2.5 rounded-lg m-1 transition-colors"
							onClick={(e) => {
								e.stopPropagation();
								setShowDeleteDialog(true);
							}}
							onSelect={(e) => e.preventDefault()}
						>
							<PiTrash className="h-[18px] w-[18px]" />
							<span className="font-medium text-sm">Delete Asset</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>

				<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
					<AlertDialogContent className="rounded-2xl">
						<AlertDialogHeader>
							<AlertDialogTitle>Delete Asset</AlertDialogTitle>
							<AlertDialogDescription className="text-muted-foreground mt-2">
								Are you sure you want to delete{" "}
								<span className="font-medium text-foreground">
									"{asset.name}"
								</span>
								? Any nodes currently using this asset will lose their data.
								This action cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter className="mt-6">
							<AlertDialogCancel
								className="rounded-xl border-border/50 hover:bg-muted/50 transition-colors"
								onClick={(e) => e.stopPropagation()}
							>
								Cancel
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={(e) => {
									e.stopPropagation();
									handleDelete();
								}}
								className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors"
							>
								{isDeleting ? "Deleting..." : "Delete Permanently"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</motion.div>
		</>
	);
});
