import { DataType } from "@gatewai/db";
import type { BackendNodeProcessor } from "@gatewai/node-sdk";
import type {
	FileData,
	ModulateNodeConfig,
	ModulateResult,
	NodeResult,
} from "@gatewai/types";

const modulateProcessor: BackendNodeProcessor = async ({
	node,
	data,
	graph,
	storage,
	media,
}) => {
	try {
		const imageInput = graph.getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;
		const modulateConfig = node.config as ModulateNodeConfig;

		if (!imageInput) {
			return { success: false, error: "No image input provided" };
		}

		const arrayBuffer = await graph.loadMediaBuffer(imageInput);
		const buffer = Buffer.from(arrayBuffer);
		const base64Data = media.bufferToDataUrl(buffer, "image/png");

		const { dataUrl, ...dimensions } =
			await media.backendPixiService.processModulate(
				base64Data,
				modulateConfig,
				undefined,
				data.apiKey,
			);

		const uploadBuffer = Buffer.from(await dataUrl.arrayBuffer());
		const mimeType = dataUrl.type;

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle)
			return { success: false, error: "Output handle is missing." };

		const newResult: NodeResult = structuredClone(
			node.result as NodeResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const key = `${node.id}/${Date.now()}.png`;
		const { signedUrl, key: tempKey } = await storage.uploadToTemporaryFolder(
			uploadBuffer,
			mimeType,
			key,
		);

		const newGeneration: ModulateResult["outputs"][number] = {
			items: [
				{
					type: DataType.Image,
					data: {
						processData: {
							dataUrl: signedUrl,
							tempKey,
							mimeType,
							...dimensions,
						},
					},
					outputHandleId: outputHandle.id,
				},
			],
		};

		newResult.outputs = [newGeneration];
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		return {
			success: false,
			error: err instanceof Error ? err.message : "Modulate processing failed",
		};
	}
};

export default modulateProcessor;
