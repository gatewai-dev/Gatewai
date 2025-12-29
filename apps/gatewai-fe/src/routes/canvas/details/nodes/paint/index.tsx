import type { OutputItem, PaintNodeConfig, PaintResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { Brush, Eraser } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAppSelector } from "@/store";
import { makeSelectEdgesByTargetNodeId } from "@/store/edges";
import { makeSelectHandlesByNodeId } from "@/store/handles";
import { makeSelectNodeById, } from "@/store/nodes";
import { useNodeImageUrl, useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { PaintNode } from "../node-props";
import { useCanvasCtx } from "../../ctx/canvas-ctx";
import { Input } from "@/components/ui/input";

const PaintNodeComponent = memo((props: NodeProps<PaintNode>) => {
  const { onNodeResultUpdate, onNodeConfigUpdate } = useCanvasCtx();
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

	const inputImageUrl = useNodeImageUrl(inputNodeId);

	const imageRef = useRef<HTMLImageElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [brushSize, setBrushSize] = useState(20);
	const [brushColor, setBrushColor] = useState("#444");
	const [tool, setTool] = useState<"brush" | "eraser">("brush");

	const isDrawingRef = useRef(false);
	const lastPositionRef = useRef<{ x: number; y: number } | null>(null);
	const needsUpdateRef = useRef(false);
	const initializedRef = useRef(false);
  	const skipNextSyncRef = useRef(false);

	const containerStyle = inputImageUrl
		? undefined
		: { aspectRatio: `${nodeConfig?.width} / ${nodeConfig?.height}` };
	console.log({ inputImageUrl });
	const updateConfig = useCallback(
		(dataUrl: string) => {
			onNodeConfigUpdate({ id: props.id, newConfig: { ...nodeConfig, paintData: dataUrl } });
		},
		[nodeConfig, onNodeConfigUpdate, props.id],
	);

  const drawMask = useCallback(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!inputImageUrl && nodeConfig?.backgroundColor) {
    ctx.fillStyle = nodeConfig.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (nodeConfig?.paintData) {
    if (!maskImageRef.current || maskImageRef.current.src !== nodeConfig.paintData) {
      maskImageRef.current = new Image();
      maskImageRef.current.src = nodeConfig.paintData;
      maskImageRef.current.onload = () => {
        if (ctx) ctx.drawImage(maskImageRef.current, 0, 0, canvas.width, canvas.height);
      };
    } else if (maskImageRef.current && ctx) {
      ctx.drawImage(maskImageRef.current, 0, 0, canvas.width, canvas.height);
    }
  }
}, [inputImageUrl, nodeConfig]);

	// Set up canvas dimensions on image load
	const handleImageLoad = useCallback(() => {
		const image = imageRef.current;
		const canvas = canvasRef.current;
		if (!image || !canvas) return;

		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.lineCap = "round";
		ctx.lineJoin = "round";

    drawMask();
	}, [drawMask]);

	useEffect(() => {
		if (inputImageUrl) return;
		if (initializedRef.current) return;

		const canvas = canvasRef.current;
		if (!canvas) return;

		canvas.width = nodeConfig?.width;
		canvas.height = nodeConfig?.height;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.lineCap = "round";
		ctx.lineJoin = "round";

    drawMask();
		initializedRef.current = true;
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
				updateConfig(canvas.toDataURL("image/webp"));
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
				console.log('UUU')
				updateConfig(canvas.toDataURL("image/webp"));
			}
		}
	}, [updateConfig]);

	useEffect(() => {
		document.addEventListener("mouseup", handleMouseUp);
		return () => {
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [handleMouseUp]);

	console.log("PaintNodeComponent render", {
		inputImageUrl,
	});

	return (
		<BaseNode {...props}>
			<div className="flex flex-col gap-3">
				<div
					className="w-full overflow-hidden bg-black/5 min-h-[100px] relative select-none"
					style={{
						...containerStyle,
						backgroundColor: inputImageUrl
							? nodeConfig.backgroundColor
							: undefined,
					}}
				>
					{inputImageUrl && (
						<img
							ref={imageRef}
							src={inputImageUrl}
							className="block w-full h-auto pointer-events-none"
							alt="Input for masking"
							draggable={false}
							onLoad={handleImageLoad}
						/>
					)}
					<canvas
						ref={canvasRef}
						className="absolute inset-0 w-full h-auto cursor-crosshair z-10"
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
					/>
				</div>
				<div className="flex flex-col flex-wrap gap-4 items-start text-sm">
					<div className="flex justift-between w-full">
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
								<Input
									id="brush-color"
									type="color"
									value={brushColor}
									onChange={(e) => setBrushColor(e.target.value)}
									className="w-8 h-8 p-1 rounded border bg-background"
								/>
							</div>
						</div>
					</div>
					<Button variant="link" className="underline text-xs" onClick={handleClear} size="sm">
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
			</div>
		</BaseNode>
	);
});

PaintNodeComponent.displayName = "PaintNodeComponent";

export { PaintNodeComponent };