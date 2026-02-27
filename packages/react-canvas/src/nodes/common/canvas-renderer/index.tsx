import CanvasWorker from "@gatewai/media/canvas-worker?worker";
import { useViewport } from "@xyflow/react";
import {
	forwardRef,
	memo,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";

function useDrawToCanvas(
	canvasRef: React.RefObject<HTMLCanvasElement | null>,
	imageUrl?: string | null,
	width?: number,
	height?: number,
) {
	const { zoom } = useViewport();
	const workerRef = useRef<Worker | null>(null);
	const [renderHeight, setRenderHeight] = useState<number | undefined>(
		undefined,
	);
	const [containerWidth, setContainerWidth] = useState(0);
	const prevZoomRef = useRef(zoom);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Setup Worker and ResizeObserver
	useEffect(() => {
		let worker = workerRef.current;
		if (!worker) {
			worker = new CanvasWorker();
			workerRef.current = worker;
		}

		const activeWorker = worker!;

		activeWorker.onmessage = async (e) => {
			if (e.data.type === "CANVAS_INITIALIZED") {
				setRenderHeight(e.data.payload.renderHeight);
			} else if (e.data.type === "REQUEST_SVG_DECODE") {
				const { imageUrl, canvasWidth, zoom, dpr, width, height } =
					e.data.payload;
				try {
					const response = await fetch(imageUrl, { credentials: "include" });
					const blob = await response.blob();
					const isSvg =
						blob.type.includes("svg") ||
						imageUrl.toLowerCase().includes(".svg");
					const img = new Image();
					const objectUrl = URL.createObjectURL(blob);
					img.src = objectUrl;
					await new Promise((res, rej) => {
						img.onload = res;
						img.onerror = rej;
					});

					let bitmap: ImageBitmap;
					if (isSvg || !img.naturalWidth || !img.naturalHeight) {
						let resizeWidth =
							width && width > 0 ? width : img.naturalWidth || 1024;
						let resizeHeight =
							height && height > 0 ? height : img.naturalHeight || 1024;

						// Use ratio if possible
						if (resizeWidth && resizeHeight) {
							const ratio = 1024 / Math.min(resizeWidth, resizeHeight);
							if (ratio > 1) {
								resizeWidth = Math.max(1024, Math.round(resizeWidth * ratio));
								resizeHeight = Math.max(1024, Math.round(resizeHeight * ratio));
							}
						}

						bitmap = await createImageBitmap(img, {
							resizeWidth,
							resizeHeight,
						});
					} else {
						bitmap = await createImageBitmap(img);
					}

					URL.revokeObjectURL(objectUrl);

					activeWorker.postMessage(
						{
							type: "DRAW_IMAGE_BITMAP",
							payload: { bitmap, canvasWidth, zoom, dpr },
						},
						[bitmap],
					);
				} catch (err) {
					console.error("Main thread SVG decode failed:", err);
				}
			}
		};

		const canvas = canvasRef.current;
		if (!canvas) return;

		// Initialize Offscreen
		if (!canvas.getAttribute("data-offscreen-init")) {
			const offscreen = canvas.transferControlToOffscreen();
			activeWorker.postMessage(
				{ type: "INIT_CANVAS", payload: { canvas: offscreen } },
				[offscreen],
			);
			canvas.setAttribute("data-offscreen-init", "true");
		}

		// Track Resize
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setContainerWidth(entry.contentRect.width);
			}
		});

		resizeObserver.observe(canvas);
		return () => resizeObserver.disconnect();
	}, [canvasRef.current]);

	// Redraw when image, width, or zoom changes
	useEffect(() => {
		if (workerRef.current && imageUrl && containerWidth > 0) {
			const draw = () => {
				workerRef.current?.postMessage({
					type: "DRAW_IMAGE",
					payload: {
						imageUrl,
						canvasWidth: containerWidth,
						zoom: zoom,
						dpr: window.devicePixelRatio || 1,
						width,
						height,
					},
				});
			};

			const isZoomChange = zoom !== prevZoomRef.current;
			prevZoomRef.current = zoom;

			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			if (isZoomChange) {
				timeoutRef.current = setTimeout(() => {
					draw();
					timeoutRef.current = null;
				}, 100);
			} else {
				draw();
			}
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [imageUrl, containerWidth, zoom, width, height]);

	return { renderHeight };
}

interface CanvasRendererProps {
	imageUrl?: string;
	width?: number;
	height?: number;
}

const CanvasRenderer = memo(
	forwardRef<HTMLCanvasElement, CanvasRendererProps>(
		({ imageUrl, width, height }, ref) => {
			const internalRef = useRef<HTMLCanvasElement | null>(null);
			// Sync the forwarded ref with our internal ref
			// biome-ignore lint/style/noNonNullAssertion: Not important
			useImperativeHandle(ref, () => internalRef.current!);
			const { renderHeight } = useDrawToCanvas(
				internalRef,
				imageUrl,
				width,
				height,
			);

			return (
				<canvas
					ref={internalRef}
					className="w-full flex"
					height={renderHeight}
					style={{
						height: renderHeight ? `${renderHeight}px` : "auto",
					}}
				/>
			);
		},
	),
);

export { useDrawToCanvas, CanvasRenderer };
