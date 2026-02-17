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

		activeWorker.onmessage = (e) => {
			if (e.data.type === "CANVAS_INITIALIZED") {
				setRenderHeight(e.data.payload.renderHeight);
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
	}, [imageUrl, containerWidth, zoom]);

	return { renderHeight };
}

interface CanvasRendererProps {
	imageUrl?: string;
}

const CanvasRenderer = memo(
	forwardRef<HTMLCanvasElement, CanvasRendererProps>(({ imageUrl }, ref) => {
		const internalRef = useRef<HTMLCanvasElement | null>(null);
		// Sync the forwarded ref with our internal ref
		// biome-ignore lint/style/noNonNullAssertion: Not important
		useImperativeHandle(ref, () => internalRef.current!);
		const { renderHeight } = useDrawToCanvas(internalRef, imageUrl);

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
	}),
);

export { useDrawToCanvas, CanvasRenderer };
