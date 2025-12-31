import type { PaintNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { Brush, Eraser } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ColorInput } from "@/components/util/color-input";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store";
import { makeSelectEdgesByTargetNodeId } from "@/store/edges";
import { makeSelectNodeById } from "@/store/nodes";
import { useCanvasCtx } from "../../ctx/canvas-ctx";
import { useNodeFileOutputUrl } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { DimensionsConfig } from "../common/dimensions";
import type { PaintNode } from "../node-props";

const PaintNodeComponent = memo((props: NodeProps<PaintNode>) => {
	const { onNodeConfigUpdate } = useCanvasCtx();
	const edges = useAppSelector(makeSelectEdgesByTargetNodeId(props.id));
	const inputNodeId = useMemo(() => {
		if (!edges || !edges[0]) {
			return undefined;
		}
		return edges[0].source;
	}, [edges]);

	const node = useAppSelector(makeSelectNodeById(props.id));
	const nodeConfig = node?.config as PaintNodeConfig;
	const maskImageRef = useRef<HTMLImageElement | null>(null);

	const inputImageUrl = useNodeFileOutputUrl(inputNodeId);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [brushSize, setBrushSize] = useState(20);
	const [brushColor, setBrushColor] = useState("#444444");
	const [tool, setTool] = useState<"brush" | "eraser">("brush");

	const [containerStyle, setContainerStyle] = useState<
		React.CSSProperties | undefined
	>(undefined);
	const [canvasStyle, setCanvasStyle] = useState<React.CSSProperties>({});

	const isDrawingRef = useRef(false);
	const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
	const needsUpdateRef = useRef(false);
	const skipNextSyncRef = useRef(false);

	const updateConfig = useCallback(
		(cfg: Partial<PaintNodeConfig>) => {
			onNodeConfigUpdate({
				id: props.id,
				newConfig: { ...nodeConfig, ...cfg },
			});
		},
		[nodeConfig, onNodeConfigUpdate, props.id],
	);

	const drawMask = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		if (nodeConfig?.paintData) {
			if (
				!maskImageRef.current ||
				maskImageRef.current.src !== nodeConfig.paintData
			) {
				maskImageRef.current = new Image();
				maskImageRef.current.src = nodeConfig.paintData;
				maskImageRef.current.onload = () => {
					if (ctx && maskImageRef.current)
						ctx.drawImage(
							maskImageRef.current,
							0,
							0,
							canvas.width,
							canvas.height,
						);
				};
			} else if (maskImageRef.current && ctx) {
				ctx.drawImage(maskImageRef.current, 0, 0, canvas.width, canvas.height);
			}
		}
	}, [nodeConfig]);

	useEffect(() => {
		const setupCanvasAndStyles = async () => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			ctx.lineCap = "round";
			ctx.lineJoin = "round";

			setCanvasStyle({ background: "transparent" });

			if (inputImageUrl) {
				const img = new Image();
				img.src = inputImageUrl;
				await new Promise<void>((resolve, reject) => {
					img.onload = () => resolve();
					img.onerror = reject;
				});

				setContainerStyle({
					aspectRatio: `${img.naturalWidth} / ${img.naturalHeight}`,
					backgroundImage: `url(${inputImageUrl})`,
					backgroundColor: nodeConfig?.backgroundColor ?? "#ffffff",
					backgroundSize: "contain",
					backgroundPosition: "center",
					backgroundRepeat: "no-repeat",
				});

				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
			} else if (nodeConfig) {
				setContainerStyle({
					aspectRatio: `${nodeConfig.width} / ${nodeConfig.height}`,
					backgroundColor: nodeConfig.backgroundColor,
					backgroundImage: "none",
				});

				canvas.width = nodeConfig.width;
				canvas.height = nodeConfig.height;
			}

			drawMask();
		};

		setupCanvasAndStyles();
	}, [inputImageUrl, nodeConfig, drawMask]);

	useEffect(() => {
		if (skipNextSyncRef.current) {
			skipNextSyncRef.current = false;
			return;
		}

		drawMask();
	}, [drawMask]);

	const getScaledCoordinates = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas) return { x: 0, y: 0 };

			const rect = canvas.getBoundingClientRect();
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;

			return {
				x: (e.clientX - rect.left) * scaleX,
				y: (e.clientY - rect.top) * scaleY,
			};
		},
		[],
	);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			e.preventDefault();
			e.stopPropagation();
			const { x, y } = getScaledCoordinates(e);
			const ctx = canvasRef.current?.getContext("2d");
			if (!ctx) return;

			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineWidth = brushSize;
			ctx.globalAlpha = 1;
			if (tool === "brush") {
				ctx.globalCompositeOperation = "source-over";
				ctx.strokeStyle = brushColor;
			} else {
				ctx.globalCompositeOperation = "destination-out";
			}
			isDrawingRef.current = true;
			lastPositionRef.current = { x, y };
			needsUpdateRef.current = true;
		},
		[brushSize, tool, brushColor, getScaledCoordinates],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (!isDrawingRef.current) return;

			const { x, y } = getScaledCoordinates(e);
			const ctx = canvasRef.current?.getContext("2d");
			if (!ctx || !lastPositionRef.current) return;

			ctx.lineTo(x, y);
			ctx.stroke();
			lastPositionRef.current = { x, y };
		},
		[getScaledCoordinates],
	);

	const handleMouseUp = useCallback(() => {
		isDrawingRef.current = false;
		lastPositionRef.current = null;
		if (needsUpdateRef.current) {
			const canvas = canvasRef.current;
			if (canvas) {
				skipNextSyncRef.current = true;
				updateConfig({ paintData: canvas.toDataURL("image/png") });
			}
			needsUpdateRef.current = false;
		}
	}, [updateConfig]);

	const handleClear = useCallback(() => {
		const canvas = canvasRef.current;
		if (canvas) {
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				updateConfig({ paintData: canvas.toDataURL("image/png") });
			}
		}
	}, [updateConfig]);

	useEffect(() => {
		document.addEventListener("mouseup", handleMouseUp);
		return () => {
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [handleMouseUp]);

	return (
		<BaseNode {...props}>
			<div className="flex flex-col gap-3">
				<div
					className="media-container w-full overflow-hidden relative select-none"
					style={containerStyle}
				>
					<canvas
						ref={canvasRef}
						className="absolute inset-0 w-full cursor-crosshair z-10"
						style={canvasStyle}
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
					/>
				</div>
				<div className="flex flex-col flex-wrap gap-4 items-start text-sm">
					<div className="flex justify-between w-full">
						<div className="grow">
							<div className="flex gap-2">
								<Button
									size="icon"
									variant={tool === "brush" ? "default" : "outline"}
									onClick={() => setTool("brush")}
								>
									<Brush className="h-4 w-4" />
								</Button>
								<Button
									size="icon"
									variant={tool === "eraser" ? "default" : "outline"}
									onClick={() => setTool("eraser")}
								>
									<Eraser className="h-4 w-4" />
								</Button>
								<div className="flex items-center gap-1">
									<Label htmlFor="brush-color">Color</Label>
									<ColorInput
										id="brush-color"
										value={brushColor}
										onChange={(e) => setBrushColor(e)}
										className="w-8 h-8 p-1 rounded border bg-background"
									/>
								</div>
							</div>
						</div>
						<Button
							variant="link"
							className="underline text-xs"
							onClick={handleClear}
							size="sm"
						>
							Clear
						</Button>
					</div>
					<div className="flex items-center gap-1">
						<Label htmlFor="brush-size">Size</Label>
						<Slider
							id="brush-size"
							min={1}
							max={100}
							step={1}
							value={[brushSize]}
							onValueChange={(value) => setBrushSize(value[0])}
							className="w-20"
						/>
						<span>{brushSize}</span>
					</div>
				</div>
				<Separator />
				{node && nodeConfig?.backgroundColor && (
					<div className="flex items-center gap-2">
						<DimensionsConfig node={node} disabled={inputImageUrl != null} />
						<Separator orientation="vertical" className=" h-full" />
						<div className="flex flex-col items-start gap-1">
							<Label
								htmlFor="bg-color"
								className={cn({
									"text-gray-600": inputImageUrl != null,
								})}
							>
								Background
							</Label>
							<ColorInput
								id="bg-color"
								disabled={inputImageUrl != null}
								value={nodeConfig?.backgroundColor}
								onChange={(e) => {
									updateConfig({ backgroundColor: e });
								}}
								className="w-8 h-8 p-1 rounded border bg-background"
							/>
						</div>
					</div>
				)}
			</div>
		</BaseNode>
	);
});

PaintNodeComponent.displayName = "PaintNodeComponent";

export { PaintNodeComponent };
