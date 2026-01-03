// canvas.worker.ts

// Define the message types for better internal clarity
type WorkerMessage =
	| { type: "INIT_CANVAS"; payload: { canvas: OffscreenCanvas } }
	| { type: "DRAW_IMAGE"; payload: { imageUrl: string } }
	| { type: "CLEAR" };

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

// Listen for messages from the main thread
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const { type } = e.data;

	switch (type) {
		case "INIT_CANVAS":
			canvas = e.data.payload.canvas;
			ctx = canvas.getContext("2d", { alpha: true });
			break;

		case "DRAW_IMAGE": {
			if (!ctx || !canvas) return;
			const { imageUrl } = e.data.payload;

			try {
				// Fetch image and convert to ImageBitmap (this happens off-thread!)
				const response = await fetch(imageUrl);
				const blob = await response.blob();
				const bitmap = await createImageBitmap(blob);

				// Update canvas dimensions to match the source image
				if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
					canvas.width = bitmap.width;
					canvas.height = bitmap.height;
				}

				// Render
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(bitmap, 0, 0);

				// Crucial: Close the bitmap to release GPU memory immediately
				bitmap.close();
			} catch (err) {
				console.error("Worker failed to fetch/draw image:", err);
			}
			break;
		}

		case "CLEAR":
			if (ctx && canvas) {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
			}
			break;
	}
};

// Export empty object to satisfy isolatedModules in tsconfig
export {};
