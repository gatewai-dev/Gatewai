import type { CropNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store";
import { makeSelectEdgesByTargetNodeId } from "@/store/edges";
import { makeSelectNodeById, updateNodeConfig } from "@/store/nodes";
import { useNodeResultHash } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import type { CropNode } from "../node-props";

type Crop = {
	leftPercentage: number;
	topPercentage: number;
	widthPercentage: number;
	heightPercentage: number;
};

type DragState = {
	type:
		| "move"
		| "resize-nw"
		| "resize-ne"
		| "resize-sw"
		| "resize-se"
		| "resize-n"
		| "resize-s"
		| "resize-w"
		| "resize-e";
	startX: number;
	startY: number;
	startCrop: Crop;
};

const CropNodeComponent = memo((props: NodeProps<CropNode>) => {
	const dispatch = useAppDispatch();
	const edges = useAppSelector(makeSelectEdgesByTargetNodeId(props.id));
	const inputNodeId = useMemo(() => {
		if (!edges || !edges[0]) {
			return undefined;
		}
		return edges[0].source;
	}, [edges]);

	const inputResultHash = useNodeResultHash(inputNodeId);
	const node = useAppSelector(makeSelectNodeById(props.id));
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const nodeConfig = node?.config as CropNodeConfig;
	const [crop, setCrop] = useState<Crop>({
		leftPercentage: nodeConfig?.leftPercentage ?? 0,
		topPercentage: nodeConfig?.topPercentage ?? 0,
		widthPercentage: nodeConfig?.widthPercentage ?? 100,
		heightPercentage: nodeConfig?.heightPercentage ?? 100,
	});
	const [dragState, setDragState] = useState<DragState | null>(null);
	const latestCropRef = useRef(crop);

	// Keep ref in sync with crop state
	useEffect(() => {
		latestCropRef.current = crop;
	}, [crop]);

	// Sync local crop with node config
	useEffect(() => {
		if (nodeConfig) {
			setCrop({
				leftPercentage: nodeConfig.leftPercentage ?? 0,
				topPercentage: nodeConfig.topPercentage ?? 0,
				widthPercentage: nodeConfig.widthPercentage ?? 100,
				heightPercentage: nodeConfig.heightPercentage ?? 100,
			});
		}
	}, [nodeConfig]);

	const updateConfig = useCallback(
		(newCrop: Crop) => {
			dispatch(updateNodeConfig({ id: props.id, newConfig: newCrop }));
		},
		[dispatch, props.id],
	);

	const constrainCrop = useCallback((newCrop: Crop): Crop => {
		let { leftPercentage, topPercentage, widthPercentage, heightPercentage } =
			newCrop;

		// Ensure minimum dimensions
		widthPercentage = Math.max(5, widthPercentage);
		heightPercentage = Math.max(5, heightPercentage);

		// Clamp width and height to 100% max
		widthPercentage = Math.min(100, widthPercentage);
		heightPercentage = Math.min(100, heightPercentage);

		// Clamp position so crop box stays within image bounds
		leftPercentage = Math.max(
			0,
			Math.min(100 - widthPercentage, leftPercentage),
		);
		topPercentage = Math.max(
			0,
			Math.min(100 - heightPercentage, topPercentage),
		);

		return {
			leftPercentage,
			topPercentage,
			widthPercentage,
			heightPercentage,
		};
	}, []);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent, type: DragState["type"]) => {
			e.preventDefault();
			e.stopPropagation();
			setDragState({
				type,
				startX: e.clientX,
				startY: e.clientY,
				startCrop: { ...crop },
			});
		},
		[crop],
	);

	useEffect(() => {
		if (!dragState || !canvasRef.current) return;

		const canvasRect = canvasRef.current.getBoundingClientRect();

		const handleMouseMove = (e: MouseEvent) => {
			e.preventDefault();
			const dx = ((e.clientX - dragState.startX) / canvasRect.width) * 100;
			const dy = ((e.clientY - dragState.startY) / canvasRect.height) * 100;
			let newCrop = { ...dragState.startCrop };

			switch (dragState.type) {
				case "move":
					newCrop.leftPercentage += dx;
					newCrop.topPercentage += dy;
					break;
				case "resize-nw":
					newCrop.leftPercentage += dx;
					newCrop.topPercentage += dy;
					newCrop.widthPercentage -= dx;
					newCrop.heightPercentage -= dy;
					break;
				case "resize-ne":
					newCrop.topPercentage += dy;
					newCrop.widthPercentage += dx;
					newCrop.heightPercentage -= dy;
					break;
				case "resize-sw":
					newCrop.leftPercentage += dx;
					newCrop.widthPercentage -= dx;
					newCrop.heightPercentage += dy;
					break;
				case "resize-se":
					newCrop.widthPercentage += dx;
					newCrop.heightPercentage += dy;
					break;
				case "resize-n":
					newCrop.topPercentage += dy;
					newCrop.heightPercentage -= dy;
					break;
				case "resize-s":
					newCrop.heightPercentage += dy;
					break;
				case "resize-w":
					newCrop.leftPercentage += dx;
					newCrop.widthPercentage -= dx;
					break;
				case "resize-e":
					newCrop.widthPercentage += dx;
					break;
			}

			newCrop = constrainCrop(newCrop);
			setCrop(newCrop);
		};

		const handleMouseUp = () => {
			// Use the latest crop value from ref to avoid stale closure
			updateConfig(latestCropRef.current);
			setDragState(null);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [dragState, constrainCrop, updateConfig]);
	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div
				className={cn(
					"media-container w-full overflow-hidden bg-black/5 relative select-none",
					{
						"h-92": !inputResultHash,
					},
				)}
			>
				{inputResultHash && (
					<CanvasRenderer ref={canvasRef} resultHash={inputResultHash} />
				)}

				{/* Dark overlay for cropped-out areas */}
				<div className="absolute inset-0 pointer-events-none">
					<svg width="100%" height="100%" className="absolute inset-0">
						<title>Dark</title>
						<defs>
							<mask id={`crop-mask-${props.id}`}>
								<rect width="100%" height="100%" fill="white" />
								<rect
									x={`${crop.leftPercentage}%`}
									y={`${crop.topPercentage}%`}
									width={`${crop.widthPercentage}%`}
									height={`${crop.heightPercentage}%`}
									fill="black"
								/>
							</mask>
						</defs>
						<rect
							width="100%"
							height="100%"
							fill="rgba(0, 0, 0, 0.6)"
							mask={`url(#crop-mask-${props.id})`}
						/>
						{/* Marching ants border */}
						<rect
							x={`${crop.leftPercentage}%`}
							y={`${crop.topPercentage}%`}
							width={`${crop.widthPercentage}%`}
							height={`${crop.heightPercentage}%`}
							fill="none"
							stroke="white"
							strokeWidth="2"
							strokeDasharray="5 5"
							pointerEvents="none"
						>
							<animate
								attributeName="stroke-dashoffset"
								from="0"
								to="10"
								dur="0.3s"
								repeatCount="indefinite"
							/>
						</rect>
					</svg>
				</div>

				{/* Crop selection box */}
				<div
					className="appearance-none absolute box-border"
					style={{
						left: `${crop.leftPercentage}%`,
						top: `${crop.topPercentage}%`,
						width: `${crop.widthPercentage}%`,
						height: `${crop.heightPercentage}%`,
						cursor: dragState?.type === "move" ? "grabbing" : "grab",
					}}
					onMouseDown={(e) => handleMouseDown(e, "move")}
					type="button"
					tabIndex={0}
					aria-label="Move crop selection"
				>
					{/* Corner handles */}
					<button
						type="button"
						className="appearance-none absolute -top-1 -left-1 w-2 h-2 bg-white/70 border border-blue-500/30 cursor-nw-resize shadow-md hover:scale-110 transition-transform"
						onMouseDown={(e) => handleMouseDown(e, "resize-nw")}
						aria-label="Resize top-left corner"
					/>
					<button
						type="button"
						className="appearance-none absolute -top-1 -right-1 w-2 h-2 bg-white/70 border border-blue-500/30 cursor-ne-resize shadow-md hover:scale-110 transition-transform"
						onMouseDown={(e) => handleMouseDown(e, "resize-ne")}
						aria-label="Resize top-right corner"
					/>
					<button
						type="button"
						className="appearance-none absolute -bottom-1 -left-1 w-2 h-2 bg-white/70 border border-blue-500/30 cursor-sw-resize shadow-md hover:scale-110 transition-transform"
						onMouseDown={(e) => handleMouseDown(e, "resize-sw")}
						aria-label="Resize bottom-left corner"
					/>
					<button
						type="button"
						className="appearance-none absolute -bottom-1 -right-1 w-2 h-2 bg-white/70 border border-blue-500/30 cursor-se-resize shadow-md hover:scale-110 transition-transform"
						onMouseDown={(e) => handleMouseDown(e, "resize-se")}
						aria-label="Resize bottom-right corner"
					/>

					{/* Side handles - only show if crop box is large enough */}
					{crop.widthPercentage > 15 && (
						<>
							<button
								type="button"
								className="appearance-none absolute -top-1 left-1/2 -ml-1 w-2 h-2 bg-white/70 border border-blue-500/30 cursor-n-resize shadow-md hover:scale-110 transition-transform"
								onMouseDown={(e) => handleMouseDown(e, "resize-n")}
								aria-label="Resize top side"
							/>
							<button
								type="button"
								className="appearance-none absolute -bottom-1 left-1/2 -ml-1 w-2 h-2 bg-white/70 border border-blue-500/30 cursor-s-resize shadow-md hover:scale-110 transition-transform"
								onMouseDown={(e) => handleMouseDown(e, "resize-s")}
								aria-label="Resize bottom side"
							/>
						</>
					)}
					{crop.heightPercentage > 15 && (
						<>
							<button
								type="button"
								className="appearance-none absolute top-1/2 -left-1 -mt-1 w-2 h-2 bg-white/70 border border-blue-500/30 cursor-w-resize shadow-md hover:scale-110 transition-transform"
								onMouseDown={(e) => handleMouseDown(e, "resize-w")}
								aria-label="Resize left side"
							/>
							<button
								type="button"
								className="appearance-none absolute top-1/2 -right-1 -mt-1 w-2 h-2 bg-white/70 border border-blue-500/30 cursor-e-resize shadow-md hover:scale-110 transition-transform"
								onMouseDown={(e) => handleMouseDown(e, "resize-e")}
								aria-label="Resize right side"
							/>
						</>
					)}

					{/* Rule of thirds grid lines */}
					<div className="absolute inset-0 pointer-events-none opacity-50">
						<div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/50" />
						<div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/50" />
						<div className="absolute top-1/3 left-0 right-0 h-px bg-white/50" />
						<div className="absolute top-2/3 left-0 right-0 h-px bg-white/50" />
					</div>
				</div>
			</div>
		</BaseNode>
	);
});

CropNodeComponent.displayName = "CropNodeComponent";

export { CropNodeComponent };
