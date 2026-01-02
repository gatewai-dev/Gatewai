import { useEffect, useRef } from "react";

function useDrawToCanvas(
	canvasRef: React.RefObject<HTMLCanvasElement | null>,
	imageUrl?: string | null,
) {
	// Keep track of the last processed image to prevent redundant draws
	const lastImageSrc = useRef<string | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d", { alpha: true });
		if (!ctx) return;

		// 1. Handle Empty State
		if (!imageUrl) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			lastImageSrc.current = null;
			return;
		}

		// 2. Prevent redundant loads if the URL hasn't changed
		if (imageUrl === lastImageSrc.current) return;

		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = imageUrl;

		img.onload = () => {
			// Update tracking ref
			lastImageSrc.current = imageUrl;

			// 3. Optimization: Only resize canvas if dimensions actually changed
			// Resizing a canvas is expensive and clears the buffer automatically
			if (canvas.width !== img.width || canvas.height !== img.height) {
				canvas.width = img.width;
				canvas.height = img.height;

				// Set display styles once
				canvas.style.width = "100%";
				canvas.style.height = "auto";
			}

			// 4. Draw
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0);
		};

		img.onerror = () => {
			console.error("Failed to load image for canvas:", imageUrl);
			lastImageSrc.current = null;
		};
	}, [imageUrl, canvasRef]);
}

export { useDrawToCanvas };
