import { useEffect, useRef, useState } from "react";

function useDrawToCanvas(
	canvasRef: React.RefObject<HTMLCanvasElement | null>,
	zoom: number,
	imageUrl?: string | null,
) {
	const workerRef = useRef<Worker | null>(null);
	const [renderHeight, setRenderHeight] = useState<number | undefined>(
		undefined,
	);
	const [containerWidth, setContainerWidth] = useState(0);
	const prevZoomRef = useRef(zoom);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Setup Worker and ResizeObserver
	useEffect(() => {
		if (!workerRef.current) {
			workerRef.current = new Worker(
				new URL("./canvas.worker.ts", import.meta.url),
				{ type: "module" },
			);
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

export { useDrawToCanvas };
