import { type EnvConfig, extractSvgDimensions, generateId, logger } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { FileData } from "@gatewai/core/types";
import { DataType, type PrismaClient } from "@gatewai/db";
import type {
    AIProvider,
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
    StorageService,
} from "@gatewai/node-sdk/server";
import { createUserContent, type GoogleGenAI, type PartListUnion } from "@google/genai";
import { inject, injectable } from "inversify";
import { SvgNodeConfigSchema } from "../metadata.js";
import type { SvgResult } from "../shared/index.js";

function extractSVG(text: string): string | null {
    // Simple extraction: look for `<svg...` and `</svg>`
    const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
    return svgMatch ? svgMatch[0] : null;
}

@injectable()
export class SvgProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.PRISMA) private prisma: PrismaClient,
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
        @inject(TOKENS.STORAGE) private storage: StorageService,
        @inject(TOKENS.ENV) private env: EnvConfig,
        @inject(TOKENS.AI_PROVIDER) private aiProvider: AIProvider,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<SvgResult>> {
        try {
            const genAI = this.aiProvider.getGemini<GoogleGenAI>();

            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            const sourceSvgInput = this.graph.getInputValue(data, node.id, false, {
                dataType: DataType.SVG,
                label: "Source SVG (Editing)",
            })?.data as FileData | undefined;

            const nodeConfig = SvgNodeConfigSchema.parse(node.config);

            const parts: PartListUnion = [];

            if (sourceSvgInput) {
                const arrayBuffer = await this.graph.loadMediaBuffer(sourceSvgInput);
                const buffer = Buffer.from(arrayBuffer);
                const svgText = buffer.toString("utf-8");
                parts.push(`Here is the source SVG to edit:\n\`\`\`xml\n${svgText}\n\`\`\``);
            }

            parts.push(userPrompt);

            const systemInstruction = "You are a specialized SVG generator. Provide only raw valid XML SVG code. Do not wrap the response in markdown blocks or explain it. Do not include markdown like ```xml. Always generate SVGs with a large 'width' and 'height' attribute (e.g., at least 1024x1024) for high-quality rendering, and ensure the 'viewBox' matches these dimensions unless user prompts otherwise.";

            const response = await genAI.models.generateContent({
                model: nodeConfig.model,
                contents: createUserContent(parts),
                config: {
                    systemInstruction,
                    temperature: nodeConfig.temperature,
                },
            });

            if (!response.text) return { success: false, error: "LLM response is empty" };

            const svgContent = extractSVG(response.text);
            if (!svgContent) {
                logger.error(`Failed to extract SVG from response: ${response.text}`);
                return { success: false, error: "Response did not contain valid SVG" };
            }

            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle) return { success: false, error: "Output handle is missing." };

            const buffer = Buffer.from(svgContent, "utf-8");
            const randId = generateId();
            const fileName = `${node.name}_${randId}.svg`;
            const key = `assets/${fileName}`;
            const bucket = this.env.GCS_ASSETS_BUCKET;
            const contentType = "image/svg+xml";

            await this.storage.uploadToStorage(buffer, key, contentType, bucket);
            const size = buffer.length;

            // Parse viewBox to get actual width/height instead of 512x512
            const dim = extractSvgDimensions(buffer);
            const rawW = dim?.w || 0;
            const rawH = dim?.h || 0;

            let width = 512;
            let height = 512;

            if (rawW > 0 && rawH > 0) {
                const aspectRatio = rawW / rawH;
                if (rawW < rawH) {
                    width = 512;
                    height = Math.round(512 / aspectRatio);
                } else {
                    height = 512;
                    width = Math.round(512 * aspectRatio);
                }
            }

            const asset = await this.prisma.fileAsset.create({
                data: {
                    name: fileName,
                    userId: data.canvas.userId,
                    bucket,
                    key,
                    size,
                    width,
                    height,
                    mimeType: contentType,
                },
            });

            const newResult = structuredClone(node.result as unknown as SvgResult) ?? {
                outputs: [],
                selectedOutputIndex: 0,
            };

            newResult.outputs.push({
                items: [
                    {
                        type: DataType.SVG,
                        data: { entity: asset },
                        outputHandleId: outputHandle.id,
                    },
                ],
            });
            newResult.selectedOutputIndex = newResult.outputs.length - 1;

            return { success: true, newResult };
        } catch (err: unknown) {
            logger.error(err instanceof Error ? err.message : "SVG Generation Failed");
            return { success: false, error: "SVG Generation failed" };
        }
    }
}
