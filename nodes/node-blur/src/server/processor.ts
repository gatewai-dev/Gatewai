import { TOKENS } from "@gatewai/core/di";
import type {
    BackendNodeProcessorCtx,
    GraphResolvers,
    MediaService,
    StorageService,
} from "@gatewai/node-sdk/server";
import { AbstractImageProcessor } from "@gatewai/node-sdk/server";
import { inject, injectable } from "inversify";
import { applyBlur, BlurNodeConfigSchema } from "../shared/index.js";

@injectable()
export class BlurProcessor extends AbstractImageProcessor {
    constructor(
        @inject(TOKENS.STORAGE) storage: StorageService,
        @inject(TOKENS.MEDIA) media: MediaService,
        @inject(TOKENS.GRAPH_RESOLVERS) graph: GraphResolvers,
    ) {
        super(storage, media, graph);
    }

    protected getPixiRunFunction() {
        return applyBlur;
    }

    protected getPixiExecuteArgs(
        node: BackendNodeProcessorCtx["node"],
        imageUrl: string,
        apiKey?: string
    ) {
        const validatedConfig = BlurNodeConfigSchema.parse(node.config);
        return {
            imageUrl,
            options: validatedConfig,
            apiKey,
        };
    }

    protected getImageInput(ctx: BackendNodeProcessorCtx) {
        return this.graph.getInputValue(ctx.data, ctx.node.id, true, {
            label: "Input",
        })?.data as any;
    }
}
