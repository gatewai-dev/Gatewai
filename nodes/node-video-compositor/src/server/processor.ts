import { TOKENS } from "@gatewai/core/di";
import type { ExtendedLayer, VirtualMediaData } from "@gatewai/core/types";
import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
} from "@gatewai/node-sdk/server";
import {
    createVirtualMedia,
    getActiveMediaMetadata,
} from "@gatewai/remotion-compositions/server";
import { inject, injectable } from "inversify";
import type { VideoCompositorNodeConfig } from "../shared/config.js";

const DEFAULT_DURATION_MS = 5000;

@injectable()
export class VideoCompositorProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<any>> {
        try {
            const config = (node.config as unknown as VideoCompositorNodeConfig) ?? {};
            const layerUpdates = config.layerUpdates ?? {};

            const width = config.width ?? 1080;
            const height = config.height ?? 1080;
            const fps = config.FPS ?? 24;
            const backgroundColor = config.backgroundColor ?? "#000000";

            let maxZ = 0;
            for (const update of Object.values(layerUpdates)) {
                maxZ = Math.max(maxZ, (update as ExtendedLayer).zIndex ?? 0);
            }

            let durationInMS = 0;

            const compositionChildren: VirtualMediaData[] = [];
            const inputHandlesWithValues = this.graph.getAllInputValuesWithHandle(
                data,
                node.id,
            );

            for (const inputEntry of inputHandlesWithValues) {
                const handleId = inputEntry.handle?.id;
                if (!handleId) continue;

                const item = inputEntry.value;
                if (!item) continue;

                const saved = (layerUpdates[handleId] ?? {}) as Partial<ExtendedLayer>;

                let childVV: VirtualMediaData | undefined;
                let sourceText: string | undefined;

                if (item.type === "Video" || item.type === "Audio") {
                    childVV = item.data as VirtualMediaData;
                } else if (item.type === "Image" || item.type === "SVG") {
                    childVV = createVirtualMedia(item.data, item.type);
                } else if (item.type === "Text") {
                    sourceText = (item.data as string) || "";
                    childVV = createVirtualMedia(item.data, item.type);
                } else if (item.type === "Lottie") {
                    childVV = createVirtualMedia(item.data, item.type);
                } else if (item.type === "Caption") {
                    childVV = createVirtualMedia(item.data, item.type);
                } else {
                    continue;
                }

                if (!childVV) continue;

                const activeMeta = getActiveMediaMetadata(childVV);

                let layerDurationInMS = 0;
                if (item.type === "Video" || item.type === "Audio" || item.type === "Lottie") {
                    const actualMS = activeMeta?.durationMs ?? 0;
                    const requestedDurationMS = saved.durationInMS;

                    if (actualMS > 0) {
                        layerDurationInMS = requestedDurationMS ? Math.max(1, Math.min(requestedDurationMS, actualMS)) : actualMS;
                    } else {
                        layerDurationInMS = Math.max(1, requestedDurationMS || DEFAULT_DURATION_MS);
                    }
                } else if (item.type === "Caption") {
                    const actualMS = activeMeta?.durationMs ?? 0;
                    layerDurationInMS = saved.durationInMS || (actualMS > 0 ? actualMS : DEFAULT_DURATION_MS);
                } else {
                    layerDurationInMS = saved.durationInMS ?? DEFAULT_DURATION_MS;
                }

                const layerOpWidth = saved.width ?? activeMeta?.width ?? width;
                const layerOpHeight = saved.height ?? activeMeta?.height ?? height;

                const layerOp: VirtualMediaData = {
                    metadata: {
                        ...activeMeta,
                        width: layerOpWidth,
                        height: layerOpHeight,
                        durationMs: layerDurationInMS,
                    },
                    operation: {
                        op: "layer",
                        x: saved.x ?? 0,
                        y: saved.y ?? 0,
                        width: layerOpWidth,
                        height: layerOpHeight,
                        rotation: saved.rotation ?? 0,
                        scale: saved.scale ?? 1,
                        opacity: saved.opacity ?? 1,
                        startFrame: saved.startFrame ?? 0,
                        durationInMS: layerDurationInMS,
                        zIndex: saved.zIndex ?? 0,
                        // Content & Styling
                        text: item.type === "Text" ? sourceText : saved.text,
                        fontSize: saved.fontSize ?? (item.type === "Text" ? 60 : undefined),
                        fontFamily:
                            saved.fontFamily ?? (item.type === "Text" ? "Inter" : undefined),
                        fontStyle: saved.fontStyle,
                        fontWeight: saved.fontWeight,
                        textDecoration: saved.textDecoration,
                        fill: saved.fill ?? (item.type === "Text" ? "#ffffff" : undefined),
                        align: saved.align,
                        verticalAlign: saved.verticalAlign,
                        letterSpacing: saved.letterSpacing,
                        lineHeight: saved.lineHeight,
                        padding: saved.padding,
                        stroke: saved.stroke,
                        strokeWidth: saved.strokeWidth,
                        backgroundColor: saved.backgroundColor,
                        borderColor: saved.borderColor,
                        borderWidth: saved.borderWidth,
                        borderRadius: saved.borderRadius,
                        autoDimensions: saved.autoDimensions,
                        animations: saved.animations,
                        speed: saved.speed,
                        lottieLoop: saved.lottieLoop,
                        lottieFrameRate: saved.lottieFrameRate,
                        lottieDurationMs: saved.lottieDurationMs,
                        captionPreset: saved.captionPreset,
                        useRoundedTextBox: saved.useRoundedTextBox,
                    },
                    children: [childVV],
                };

                const layerEnd =
                    ((saved.startFrame ?? 0) / fps) * 1000 +
                    (layerDurationInMS ?? DEFAULT_DURATION_MS);
                if (layerEnd > durationInMS) durationInMS = layerEnd;

                compositionChildren.push(layerOp);
            }

            const outputVV: VirtualMediaData = {
                metadata: {
                    width,
                    height,
                    fps,
                    durationMs: durationInMS,
                },
                operation: {
                    op: "compose",
                    width,
                    height,
                    fps,
                    backgroundColor,
                    metadata: {
                        durationMs: durationInMS,
                        width,
                        height,
                        fps,
                    },
                },
                children: compositionChildren,
            };

            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );

            if (!outputHandle) {
                return { success: true, newResult: { outputs: [], selectedOutputIndex: 0 } as any };
            }

            return {
                success: true,
                newResult: {
                    selectedOutputIndex: 0,
                    outputs: [
                        {
                            items: [
                                {
                                    type: "Video" as const,
                                    data: outputVV,
                                    outputHandleId: outputHandle.id,
                                },
                            ],
                        },
                    ],
                } as any,
            };
        } catch (err: unknown) {
            if (err instanceof Error) {
                return { success: false, error: err.message };
            }
            return { success: false, error: "Composition processing failed" };
        }
    }
}
