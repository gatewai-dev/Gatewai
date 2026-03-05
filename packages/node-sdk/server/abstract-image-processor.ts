import type { FileData, NodeResult } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import { injectable } from "inversify";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	GraphResolvers,
	MediaService,
	NodeProcessor,
	StorageService,
} from "./types.js";

@injectable()
export abstract class AbstractImageProcessor implements NodeProcessor {
	constructor(
		protected storage: StorageService,
		protected media: MediaService,
		protected graph: GraphResolvers,
	) {}

	protected abstract getPixiRunFunction(): any;

	protected abstract getPixiExecuteArgs(
		node: BackendNodeProcessorCtx["node"],
		imageUrl: string,
		apiKey?: string,
	): any;

	protected getImageInput(ctx: BackendNodeProcessorCtx): FileData | null {
		return this.graph.getInputValue(ctx.data, ctx.node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;
	}

	protected async getImageUrl(
		ctx: BackendNodeProcessorCtx,
		imageInput: FileData,
	): Promise<string | null> {
		return this.media.resolveFileDataUrl(imageInput);
	}

	async process(
		ctx: BackendNodeProcessorCtx,
	): Promise<BackendNodeProcessorResult<any>> {
		try {
			const { node, data } = ctx;
			const imageInput = this.getImageInput(ctx);

			if (!imageInput) {
				return { success: false, error: "No image input provided" };
			}

			const imageUrl = await this.getImageUrl(ctx, imageInput);
			if (!imageUrl) {
				return { success: false, error: "Failed to resolve image URL" };
			}

			const executeArgs = this.getPixiExecuteArgs(node, imageUrl, data.apiKey);

			const { dataUrl, ...dimensions } =
				await this.media.backendPixiService.execute(
					node.id,
					executeArgs,
					this.getPixiRunFunction(),
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

			const key = `${(data.task ?? node).id}/${Date.now()}.png`;
			const { signedUrl, key: tempKey } =
				await this.storage.uploadToTemporaryStorageFolder(
					uploadBuffer,
					mimeType,
					key,
				);

			const newGeneration = {
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
			newResult.selectedOutputIndex = 0;

			return { success: true, newResult };
		} catch (err: unknown) {
			return {
				success: false,
				error: err instanceof Error ? err.message : "Image processing failed",
			};
		}
	}
}
