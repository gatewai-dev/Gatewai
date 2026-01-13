import type { FileData, FileResult } from "@gatewai/types";
import { useReactFlow } from "@xyflow/react";
import { motion } from "framer-motion";
import { FileImage, GripVertical, Music } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useCanvasCtx } from "@/routes/canvas/details/ctx/canvas-ctx";
import { getDataTypeFromMime } from "@/utils/file";
import { useNodeTemplates } from "../node-templates.ctx";
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

	return createPortal(
		<div
			className="fixed z-9999 pointer-events-none"
			style={{
				left: position.x,
				top: position.y,
				transform: "translate(-50%, -50%)",
			}}
		>
			<div
				className={cn(
					"flex items-center gap-3 p-2 pr-4",
					"bg-background/90 backdrop-blur-xl border border-primary/20",
					"rounded-xl shadow-2xl",
					"w-52 ring-1 ring-primary/30",
				)}
			>
				{/* Thumbnail Preview */}
				<div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/50">
					{isAudio ? (
						<div className="flex h-full w-full items-center justify-center bg-primary/5">
							<Music className="h-4 w-4 text-primary/70" />
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
							<FileImage className="h-4 w-4 text-muted-foreground/60" />
						</div>
					)}
				</div>
				<div className="flex flex-col overflow-hidden">
					<span className="text-sm font-semibold text-foreground truncate">
						{asset.name}
					</span>
					<span className="text-[10px] text-muted-foreground font-medium">
						Drop to add file
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
	const isAudio = asset.mimeType?.startsWith("audio/");

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
				const importTemplate = nodeTemplates?.find((f) => f.type === "File");
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
											// Ts date strings to Date objects - eww
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
				} as FileResult;
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
				onMouseDown={handleMouseDown}
				className={cn(
					"group relative flex w-full cursor-grab active:cursor-grabbing select-none items-center gap-3",
					"rounded-lg border border-transparent p-1.5 transition-all duration-100",
					"hover:bg-muted/50 hover:border-border/40",
					isDragging ? "opacity-30 grayscale" : "opacity-100",
				)}
				whileHover={{ scale: 1.02 }}
				whileTap={{ scale: 0.98 }}
			>
				{/* Thumbnail */}
				<div
					className={cn(
						"relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border/40 bg-muted",
						"transition-colors duration-300 group-hover:border-primary/20",
					)}
				>
					{isAudio ? (
						<div className="flex h-full w-full items-center justify-center bg-primary/5">
							<Music className="h-4 w-4 text-primary/70" />
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
							<FileImage className="h-4 w-4 text-muted-foreground/60" />
						</div>
					)}
				</div>

				{/* Info */}
				<div className="flex flex-1 flex-col overflow-hidden">
					<span className="truncate text-xs font-medium text-foreground/90">
						{asset.name}
					</span>
					<div>
						<span className="truncate text-[10px] text-muted-foreground">
							{asset.mimeType || "Unknown type"}
						</span>
						{asset.duration && <span>{}</span>}
					</div>
				</div>

				<GripVertical className="h-3.5 w-3.5 text-border opacity-0 transition-opacity group-hover:opacity-100" />
			</motion.div>
		</>
	);
});
