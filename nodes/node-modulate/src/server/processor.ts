import { TOKENS } from "@gatewai/core/di";
import type { FileData } from "@gatewai/core/types";
import type {
    BackendNodeProcessorCtx,
    GraphResolvers,
    MediaService,
    StorageService,
} from "@gatewai/node-sdk/server";
import { AbstractImageProcessor } from "@gatewai/node-sdk/server";
import { inject, injectable } from "inversify";
import { ModulateNodeConfigSchema } from "../metadata.js";
import { applyModulate } from "../shared/pixi-modulate-run.js";

@injectable()
export class ModulateProcessor extends AbstractImageProcessor {
    constructor(
        @inject(TOKENS.STORAGE) storage: StorageService,
        @inject(TOKENS.MEDIA) media: MediaService,
        @inject(TOKENS.GRAPH_RESOLVERS) graph: GraphResolvers,
    ) {
        super(storage, media, graph);
    }

    protected getPixiRunFunction() {
        return applyModulate;
    }

    protected getPixiExecuteArgs(
        node: BackendNodeProcessorCtx["node"],
        imageUrl: string,
        apiKey?: string
    ) {
        const modulateConfig = ModulateNodeConfigSchema.parse(node.config);
        return {
            imageUrl,
            config: modulateConfig,
            apiKey,
        };
    }

    protected async getImageUrl(ctx: BackendNodeProcessorCtx, imageInput: FileData) {
        const arrayBuffer = await this.graph.loadMediaBuffer(imageInput);
        const buffer = Buffer.from(arrayBuffer);
        return this.media.bufferToDataUrl(buffer, "image/png");
    }
}
