// canvas.worker.ts

// Define the message types for better internal clarity
type WorkerMessage =
	| { type: "INIT_CANVAS"; payload: { canvas: OffscreenCanvas } }
	| {
			type: "DRAW_IMAGE";
			payload: {
				imageUrl: string;
				zoom: number;
				canvasWidth: number;
				dpr: number;
			};
	  }
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
			const { imageUrl, canvasWidth, zoom, dpr } = e.data.payload;

			try {
				const response = await fetch(imageUrl);
				const blob = await response.blob();
				const bitmap = await createImageBitmap(blob);

				const aspectRatio = bitmap.height / bitmap.width;

				const cssHeight = canvasWidth * aspectRatio;

				const drawingWidth = canvasWidth * zoom * dpr;
				const drawingHeight = cssHeight * zoom * dpr;

				// Update internal canvas resolution
				canvas.width = drawingWidth;
				canvas.height = drawingHeight;

				ctx.clearRect(0, 0, canvas.width, canvas.height);
				ctx.drawImage(bitmap, 0, 0, drawingWidth, drawingHeight);

				// Send back the CSS height (not the drawing height) to maintain layout
				self.postMessage({
					type: "CANVAS_INITIALIZED",
					payload: { renderHeight: cssHeight },
				});

				bitmap.close();
			} catch (err) {
				console.error(err);
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

export {};
