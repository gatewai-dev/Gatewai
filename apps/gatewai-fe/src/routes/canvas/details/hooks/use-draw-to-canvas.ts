import { useEffect, useRef } from "react";
import CanvasWorker from "./canvas.worker.ts?worker";

function useDrawToCanvas(
	canvasRef: React.RefObject<HTMLCanvasElement | null>,
	imageUrl?: string | null,
) {
	const workerRef = useRef<Worker | null>(null);
	const isInitialized = useRef(false);

	useEffect(() => {
		// 2. Initialize using the Vite-imported constructor
		if (!workerRef.current) {
			workerRef.current = new CanvasWorker();
		}

		const canvas = canvasRef.current;
		// The rest of your logic...
		if (canvas && !isInitialized.current) {
			try {
				const offscreen = canvas.transferControlToOffscreen();
				workerRef.current.postMessage(
					{ type: "INIT_CANVAS", payload: { canvas: offscreen } },
					[offscreen],
				);
				isInitialized.current = true;
			} catch (e) {
				// Handle cases where transferControlToOffscreen might fail
				console.warn("OffscreenCanvas not supported or already transferred", e);
			}
		}

		if (imageUrl && workerRef.current) {
			workerRef.current.postMessage({
				type: "DRAW_IMAGE",
				payload: { imageUrl },
			});
		}
	}, [imageUrl, canvasRef.current]);
}

export { useDrawToCanvas };
