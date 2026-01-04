import type { PaintNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { Brush, Eraser, PaintBucket } from "lucide-react";
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
import { GetAssetEndpoint } from "@/utils/file";
import { useCanvasCtx } from "../../ctx/canvas-ctx";
import {
	useNodeFileOutputUrl,
	useNodeResult,
} from "../../processor/processor-ctx";
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

	const inputNodeResult = useNodeResult(inputNodeId);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const previewRef = useRef<HTMLCanvasElement>(null);
	const inputCanvasRef = useRef<HTMLCanvasElement>(null);

	const [brushSize, setBrushSize] = useState(20);
	const [brushColor, setBrushColor] = useState("#444444");
	const [tool, setTool] = useState<"brush" | "eraser" | "fill">("brush");
	const [tolerance, setTolerance] = useState(40);

	const [containerStyle, setContainerStyle] = useState<
		React.CSSProperties | undefined
	>(undefined);
	const [canvasStyle, setCanvasStyle] = useState<React.CSSProperties>({});

	const isDrawingRef = useRef(false);
	const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
	const needsUpdateRef = useRef(false);
	const skipNextSyncRef = useRef(false);
	const previewDebounceRef = useRef<number | null>(null); // New: For debouncing fill preview

	const inputImageUrl = useMemo(() => {
		const result =
			inputNodeResult.result?.outputs[
				inputNodeResult.result?.selectedOutputIndex
			];
		if (!result) {
			return null;
		}
		const outputItem = result.items.find((f) => f.type === "Image");
		if (outputItem?.data.processData) {
			return outputItem?.data.processData.dataUrl;
		}
		if (outputItem?.data.entity) {
			return GetAssetEndpoint(outputItem?.data.entity.id);
		}
		return null;
	}, [inputNodeResult]);
	console.log({ inputImageUrl });
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

	const colorToRgb = useCallback((color: string): [number, number, number] => {
		const canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		const ctx = canvas.getContext("2d");
		if (!ctx) return [0, 0, 0];
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	}, []);

	const colorsSimilar = useCallback(
		(
			c1: [number, number, number, number],
			c2: [number, number, number, number],
			tol: number,
		): boolean => {
			if (c1[3] === 0 || c2[3] === 0) {
				return c1[3] === c2[3];
			}
			return (
				Math.max(
					Math.abs(c1[0] - c2[0]),
					Math.abs(c1[1] - c2[1]),
					Math.abs(c1[2] - c2[2]),
				) <= tol
			);
		},
		[],
	);

	const getPixel = useCallback(
		(
			data: Uint8ClampedArray,
			x: number,
			y: number,
			w: number,
		): [number, number, number, number] => {
			const i = (y * w + x) * 4;
			return [data[i], data[i + 1], data[i + 2], data[i + 3]];
		},
		[],
	);

	const setPixel = useCallback(
		(
			data: Uint8ClampedArray,
			x: number,
			y: number,
			w: number,
			r: number,
			g: number,
			b: number,
			a: number,
		) => {
			const i = (y * w + x) * 4;
			data[i] = r;
			data[i + 1] = g;
			data[i + 2] = b;
			data[i + 3] = a;
		},
		[],
	);

	const clearPreview = useCallback(() => {
		const preview = previewRef.current;
		if (!preview) return;
		const ctx = preview.getContext("2d");
		if (ctx) ctx.clearRect(0, 0, preview.width, preview.height);
	}, []);

	const performFloodFill = useCallback(
		(isPreview: boolean, posX: number, posY: number) => {
			const canvas = canvasRef.current;
			if (!canvas) return;
			const w = canvas.width;
			const h = canvas.height;
			const maskCtx = canvas.getContext("2d");
			if (!maskCtx) return;

			const inputCanvas = inputCanvasRef.current;
			const useInput = !!inputImageUrl && inputCanvas;
			const inputCtx = useInput ? inputCanvas.getContext("2d") : null;

			const colorData =
				useInput && inputCtx
					? inputCtx.getImageData(0, 0, w, h).data
					: maskCtx.getImageData(0, 0, w, h).data;

			const targetColor = getPixel(colorData, posX, posY, w);

			const [brushR, brushG, brushB] = colorToRgb(brushColor);

			const targetTol = tolerance; // 0-255

			const stack: { x: number; y: number }[] = [{ x: posX, y: posY }];
			const visited = new Uint8Array(w * h);

			let dataToModify: Uint8ClampedArray;
			let ctxToPut: CanvasRenderingContext2D;
			let alpha = 255;

			if (isPreview) {
				const preview = previewRef.current;
				if (!preview) return;
				ctxToPut = preview.getContext("2d")!;
				dataToModify = ctxToPut.createImageData(w, h).data;
				alpha = 128; // Semi-transparent for preview
			} else {
				ctxToPut = maskCtx;
				dataToModify = maskCtx.getImageData(0, 0, w, h).data;
			}

			while (stack.length > 0) {
				const p = stack.pop()!;
				const idx = p.y * w + p.x;
				if (visited[idx]) continue;
				visited[idx] = 1;

				const currentColor = getPixel(colorData, p.x, p.y, w);

				if (!colorsSimilar(currentColor, targetColor, targetTol)) continue;

				setPixel(dataToModify, p.x, p.y, w, brushR, brushG, brushB, alpha);

				if (p.x > 0) stack.push({ x: p.x - 1, y: p.y });
				if (p.x < w - 1) stack.push({ x: p.x + 1, y: p.y });
				if (p.y > 0) stack.push({ x: p.x, y: p.y - 1 });
				if (p.y < h - 1) stack.push({ x: p.x, y: p.y + 1 });
			}

			ctxToPut.putImageData(new ImageData(dataToModify, w, h), 0, 0);

			if (!isPreview) {
				needsUpdateRef.current = true;
			}
		},
		[
			brushColor,
			tolerance,
			inputImageUrl,
			getPixel,
			setPixel,
			colorToRgb,
			colorsSimilar,
		],
	);

	useEffect(() => {
		const setupCanvasAndStyles = async () => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			ctx.lineCap = "round";
			ctx.lineJoin = "round";

			setCanvasStyle({ background: "transparent" });

			const preview = previewRef.current;
			if (preview) {
				preview.width = canvas.width;
				preview.height = canvas.height;
			}

			let img: HTMLImageElement | undefined;

			if (inputImageUrl) {
				img = new Image();
				img.src = inputImageUrl;
				await new Promise<void>((resolve, reject) => {
					img!.onload = () => resolve();
					img!.onerror = reject;
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

				const inputCanvas = inputCanvasRef.current;
				if (inputCanvas) {
					inputCanvas.width = img.naturalWidth;
					inputCanvas.height = img.naturalHeight;
					const inputCtx = inputCanvas.getContext("2d");
					if (inputCtx) {
						inputCtx.drawImage(img, 0, 0);
					}
				}

				const preview = previewRef.current;
				if (preview) {
					preview.width = img.naturalWidth;
					preview.height = img.naturalHeight;
				}
			} else if (nodeConfig) {
				setContainerStyle({
					aspectRatio: `${nodeConfig.width} / ${nodeConfig.height}`,
					backgroundColor: nodeConfig.backgroundColor,
					backgroundImage: "none",
				});

				canvas.width = nodeConfig.width;
				canvas.height = nodeConfig.height;

				const preview = previewRef.current;
				if (preview) {
					preview.width = nodeConfig.width;
					preview.height = nodeConfig.height;
				}
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

	useEffect(() => {
		if (tool !== "fill") {
			clearPreview();
		}
	}, [tool, clearPreview]);

	const getScaledCoordinates = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas) return { x: 0, y: 0 };

			const rect = canvas.getBoundingClientRect();
			const scaleX = canvas.width / rect.width;
			const scaleY = canvas.height / rect.height;

			return {
				x: Math.floor((e.clientX - rect.left) * scaleX),
				y: Math.floor((e.clientY - rect.top) * scaleY),
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

			if (tool === "fill") {
				performFloodFill(false, x, y);
				clearPreview();
				return;
			}

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
		[
			brushSize,
			tool,
			brushColor,
			getScaledCoordinates,
			performFloodFill,
			clearPreview,
		],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const { x, y } = getScaledCoordinates(e);

			if (tool === "fill") {
				// Performance fix: Clear preview immediately on move (cheap operation).
				// Debounce the expensive flood fill to only run after 100ms of mouse inactivity.
				// This prevents running flood fill on every mouse move event, which fires rapidly.
				if (previewDebounceRef.current) {
					clearTimeout(previewDebounceRef.current);
				}
				clearPreview();
				const width = canvasRef.current?.width ?? 0;
				const height = canvasRef.current?.height ?? 0;
				const inBounds = x >= 0 && y >= 0 && x < width && y < height;
				if (inBounds) {
					previewDebounceRef.current = setTimeout(() => {
						performFloodFill(true, x, y);
						previewDebounceRef.current = null;
					}, 100);
				} else {
					previewDebounceRef.current = null;
				}
				return;
			}

			if (!isDrawingRef.current) return;

			const ctx = canvasRef.current?.getContext("2d");
			if (!ctx || !lastPositionRef.current) return;

			ctx.lineTo(x, y);
			ctx.stroke();
			lastPositionRef.current = { x, y };
		},
		[tool, getScaledCoordinates, clearPreview, performFloodFill],
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

	const handleMouseLeave = useCallback(() => {
		if (tool === "fill") {
			clearPreview();
			if (previewDebounceRef.current) {
				clearTimeout(previewDebounceRef.current);
				previewDebounceRef.current = null;
			}
		}
	}, [tool, clearPreview]);

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

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (previewDebounceRef.current) {
				clearTimeout(previewDebounceRef.current);
			}
		};
	}, []);

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
						onMouseLeave={handleMouseLeave}
					/>
					<canvas
						ref={previewRef}
						className="absolute inset-0 w-full h-full pointer-events-none z-20"
					/>
					<canvas ref={inputCanvasRef} className="hidden" />
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
								<Button
									size="icon"
									variant={tool === "fill" ? "default" : "outline"}
									onClick={() => setTool("fill")}
								>
									<PaintBucket className="h-4 w-4" />
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
					{tool !== "fill" && (
						<div className="flex items-center gap-1 text-xs">
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
					)}
					{tool === "fill" && (
						<div className={cn("flex items-center gap-1 text-xs")}>
							<Label htmlFor="tolerance">Tolerance</Label>
							<Slider
								id="tolerance"
								min={0}
								max={255}
								step={1}
								value={[tolerance]}
								onValueChange={(value) => setTolerance(value[0])}
								className="w-20"
							/>
							<span>{tolerance}</span>
						</div>
					)}
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
