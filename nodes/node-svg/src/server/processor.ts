import { createCodeGenAgent, runCodeGenAgent } from "@gatewai/ai-agent";
import { type EnvConfig, extractSvgDimensions, generateId, logger, type StorageService } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { FileData } from "@gatewai/core/types";
import { DataType, type PrismaClient } from "@gatewai/db";
import type {
    AIProvider,
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
} from "@gatewai/node-sdk/server";
import { inject, injectable } from "inversify";
import { z } from "zod";
import { SvgNodeConfigSchema } from "../metadata.js";
import type { SvgResult } from "../shared/index.js";

const MAX_RETRIES = 3;

/**
 * Result schema for the agent
 */
const SvgSandboxResultSchema = z.object({
    svg: z.string().describe("The generated SVG XML string"),
});

@injectable()
export class SvgProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.PRISMA) private prisma: PrismaClient,
        @inject(TOKENS.ENV) private env: EnvConfig,
        @inject(TOKENS.STORAGE) private storage: StorageService,
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
        @inject(TOKENS.AI_PROVIDER) private aiProvider: AIProvider,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<SvgResult>> {
        try {
            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            const sourceSvgInput = this.graph.getInputValue(data, node.id, false, {
                dataType: DataType.SVG,
                label: "Source SVG (Editing)",
            })?.data as FileData | undefined;

            const nodeConfig = SvgNodeConfigSchema.parse(node.config);
            const agentModel = this.aiProvider.getAgentModel<any>(nodeConfig.model);

            // Load source SVG content if provided
            let sourceSvgContent: string | null = null;
            if (sourceSvgInput) {
                const arrayBuffer = await this.graph.loadMediaBuffer(sourceSvgInput);
                sourceSvgContent = Buffer.from(arrayBuffer).toString("utf-8");
            }

            // ── System Prompt for Code-Gen Agent ──────────────────────
            const systemPrompt = `You are an expert SVG graphics programmer.
Your task is to write JavaScript code that generates a high-quality SVG based on the user's prompt.

You have access to the following global variables:
- \`prompt\`: The user's request (string)
- \`sourceSvg\`: The source SVG string if we are editing an existing SVG, otherwise null (string | null)

You MUST return a valid result object with an \`svg\` property containing the final SVG XML string.
Example return:
return { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><circle cx="512" cy="512" r="512" fill="red"/></svg>' };

Guidelines:
- Create visually stunning, modern, and highly detailed SVGs.
- Use a large canvas (e.g. 1024x1024) and set the \`xmlns\`, \`width\`, \`height\`, and \`viewBox\` properly.
- You do NOT need to use markdown to wrap your response since this is code execute.
- Use the available JavaScript Math functions and loops to construct complex procedural graphics if appropriate.
- If \`sourceSvg\` is provided, you must parse/manipulate it using string operations or regex, and return the modified SVG.`;

            // ── Setup Code-Gen Agent ─────────────────────────────────
            const { agent, resultStore } = createCodeGenAgent<{ svg: string }>({
                name: "SvgGenAgent",
                model: agentModel,
                systemPrompt,
                globals: {
                    prompt: userPrompt,
                    sourceSvg: sourceSvgContent,
                },
                resultSchema: SvgSandboxResultSchema,
                maxRetries: MAX_RETRIES,
                timeoutMs: 10_000,
            });

            // ── Run Agent ─────────────────────────────────────────────
            // The agent will loop, write code, run it, validate, and retry if needed.
            const result = await runCodeGenAgent<{ svg: string }>({
                agent,
                resultStore,
                prompt: userPrompt,
            });

            if (!result?.svg) {
                return { success: false, error: "Agent failed to return a valid SVG." };
            }

            const svgContent = result.svg;

            // ── Upload & store ───────────────────────────────────────
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
            logger.error({ err }, "SVG Generation Failed");
            return { success: false, error: err instanceof Error ? err.message : "SVG Generation failed" };
        }
    }
}
