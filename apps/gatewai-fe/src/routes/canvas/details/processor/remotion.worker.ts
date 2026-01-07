// remotion.worker.ts
import { RemotionWebProcessorService } from "./muxer-service";

const service = new RemotionWebProcessorService();

self.onmessage = async (event) => {
	const { config, inputDataMap, id } = event.data;

	try {
		const result = await service.processVideo(config, inputDataMap);
		self.postMessage({ type: "success", result, id });
	} catch (error) {
		self.postMessage({
			type: "error",
			error: error instanceof Error ? error.message : "Unknown error",
			id,
		});
	}
};
