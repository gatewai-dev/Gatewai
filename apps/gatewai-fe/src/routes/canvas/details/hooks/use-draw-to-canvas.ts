import { useViewport } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import CanvasWorker from "./canvas.worker.ts?worker";

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
	// Setup Worker and ResizeObserver
	useEffect(() => {
		if (!workerRef.current) {
			workerRef.current = new CanvasWorker();
			workerRef.current.onmessage = (e) => {
				if (e.data.type === "CANVAS_INITIALIZED") {
					setRenderHeight(e.data.payload.renderHeight);
				}
			};
		}

		const canvas = canvasRef.current;
		if (!canvas) return;

		// Initialize Offscreen
		if (!canvas.getAttribute("data-offscreen-init")) {
			const offscreen = canvas.transferControlToOffscreen();
			workerRef.current.postMessage(
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
		if (imageUrl && workerRef.current && containerWidth > 0) {
			workerRef.current.postMessage({
				type: "DRAW_IMAGE",
				payload: {
					imageUrl,
					canvasWidth: containerWidth,
					zoom: zoom,
					dpr: window.devicePixelRatio || 1,
				},
			});
		}
	}, [imageUrl, containerWidth, zoom]);

	return { renderHeight };
}

export { useDrawToCanvas };
