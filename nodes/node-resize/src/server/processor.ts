import { TOKENS } from "@gatewai/core/di";
import type {
    BackendNodeProcessorCtx,
    GraphResolvers,
    MediaService,
    StorageService,
} from "@gatewai/node-sdk/server";
import { AbstractImageProcessor } from "@gatewai/node-sdk/server";
import { inject, injectable } from "inversify";
import { ResizeNodeConfigSchema } from "../metadata.js";
import { applyResize } from "../shared/pixi-resize-run.js";

@injectable()
export class ResizeProcessor extends AbstractImageProcessor {
    constructor(
        @inject(TOKENS.STORAGE) storage: StorageService,
        @inject(TOKENS.MEDIA) media: MediaService,
        @inject(TOKENS.GRAPH_RESOLVERS) graph: GraphResolvers,
    ) {
        super(storage, media, graph);
    }

    protected getPixiRunFunction() {
        return applyResize;
    }

    protected getPixiExecuteArgs(
        node: BackendNodeProcessorCtx["node"],
        imageUrl: string,
        apiKey?: string
    ) {
        const resizeConfig = ResizeNodeConfigSchema.parse(node.config);
        return {
            imageUrl,
            options: resizeConfig,
            apiKey,
        };
    }
}
