import { useEffect } from "react";

function useDrawToCanvas(
	canvasRef: React.RefObject<HTMLCanvasElement | null>,
	imageUrl?: string | null,
) {
	useEffect(() => {
		if (!canvasRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		if (!imageUrl) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			return;
		}

		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = imageUrl;
		console.log("drw");
		img.onload = () => {
			canvas.width = img.width;
			canvas.height = img.height;
			canvas.style.width = "100%";
			canvas.style.height = "auto";
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0);
		};
	}, [imageUrl, canvasRef.current]);
}

export { useDrawToCanvas };
