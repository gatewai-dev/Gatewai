import "reflect-metadata";
import { VideoRendererService } from "./apps/gatewai-backend/src/lib/video-renderer.service.js";

async function main() {
	const service = new VideoRendererService();

	try {
		console.log("Starting test render...");
		const result = await service.renderComposition({
			compositionId: "CompositionScene",
			width: 1280,
			height: 720,
			fps: 30,
			durationInFrames: 30, // 1 second
			inputProps: {
				layers: [],
			},
			onProgress: (p) => {
				console.log(
					`Progress: ${Math.round(p.progress * 100)}% (${p.renderedFrames} rendered)`,
				);
			},
		});

		console.log("Success! File saved to:", result.filePath);
	} catch (err) {
		console.error("Render failed:", err);
	}
}

main();
