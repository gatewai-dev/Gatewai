import { createCodeGenAgent, runCodeGenAgent } from "@gatewai/ai-agent";
import { type EnvConfig, generateId, logger } from "@gatewai/core";
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
import { createVirtualMedia } from "@gatewai/remotion-compositions/server";
import { inject, injectable } from "inversify";
import { z } from "zod";
import { LottieNodeConfigSchema } from "../metadata.js";
import type { LottieResult } from "../shared/index.js";

/** Maximum retry attempts for generation + validation. */
const MAX_RETRIES = 3;

const LottieSandboxResultSchema = z.object({
    lottie: z.any().describe("The generated Lottie JSON object"),
    width: z.number().describe("The width of the Lottie animation"),
    height: z.number().describe("The height of the Lottie animation"),
    fps: z.number().describe("The framerate of the Lottie animation"),
    duration: z.number().describe("The duration of the Lottie animation in seconds"),
});

@injectable()
export class LottieProcessor implements NodeProcessor {
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
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<LottieResult>> {
        try {
            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            const sourceLottieInput = this.graph.getInputValue(data, node.id, false, {
                dataType: DataType.Lottie,
                label: "Source Lottie (Editing)",
            })?.data as FileData | undefined;

            const nodeConfig = LottieNodeConfigSchema.parse(node.config);
            const agentModel = this.aiProvider.getAgentModel<any>(nodeConfig.model);

            let sourceLottieJson: string | null = null;
            if (sourceLottieInput) {
                const arrayBuffer = await this.graph.loadMediaBuffer(sourceLottieInput);
                sourceLottieJson = Buffer.from(arrayBuffer).toString("utf-8");
            }

            // ── System Prompt for Code-Gen Agent ──────────────────────
            const systemPrompt = `You are an expert Lottie animation programmer.
Your task is to write JavaScript code that generates a valid Lottie JSON object based on the user's prompt.

You have access to the following global variables:
- \`prompt\`: The user's request (string)
- \`sourceLottie\`: The source Lottie JSON string if we are editing an existing animation, otherwise null (string | null)

You MUST return a valid result object with the following properties:
- \`lottie\`: The final Lottie JSON object (not a string, the actual parsed object).
- \`width\`: The width of the animation (number).
- \`height\`: The height of the animation (number).
- \`fps\`: The framerate of the animation (number).
- \`duration\`: The duration of the animation in seconds (number).

Example return:
return {
    lottie: { v: "5.7.4", fr: 30, ip: 0, op: 60, w: 512, h: 512, nm: "Example", ddd: 0, assets: [], layers: [...] },
    width: 512,
    height: 512,
    fps: 30,
    duration: 2.0
};

Guidelines:
- Generate a valid Root Lottie Object containing 'v', 'fr', 'ip', 'op', 'w', 'h', and 'layers' properties.
- Set width (w) and height (h) to 512, framerate (fr) to 30 or 60, unless specified otherwise.
- The 'layers' array should include the actual animation data.
- Do NOT return markdown or stringified JSON. Construct the JS object programmatically and return it.
- If \`sourceLottie\` is provided, parse it using \`JSON.parse(sourceLottie)\`, manipulate it, and return the mutated object.`;

            // ── Setup Code-Gen Agent ─────────────────────────────────
            const { agent, resultStore } = createCodeGenAgent<{
                lottie: any; width: number; height: number; fps: number; duration: number
            }>({
                name: "LottieGenAgent",
                model: agentModel,
                systemPrompt,
                globals: {
                    prompt: userPrompt,
                    sourceLottie: sourceLottieJson,
                },
                resultSchema: LottieSandboxResultSchema,
                maxRetries: MAX_RETRIES,
                timeoutMs: 10_000,
            });

            // ── Run Agent ─────────────────────────────────────────────
            const validatedResult = await runCodeGenAgent<{
                lottie: any; width: number; height: number; fps: number; duration: number
            }>({
                agent,
                resultStore,
                prompt: userPrompt,
            });

            if (!validatedResult?.lottie) {
                return { success: false, error: "Agent failed to return a valid Lottie object." };
            }

            // ── Upload & store ───────────────────────────────────────
            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle) return { success: false, error: "Output handle is missing." };

            const buffer = Buffer.from(JSON.stringify(validatedResult.lottie), "utf-8");
            const randId = generateId();
            const fileName = `${node.name}_${randId}.json`;
            const key = `assets/${fileName}`;
            const bucket = this.env.GCS_ASSETS_BUCKET;
            const contentType = "application/json";

            await this.storage.uploadToStorage(buffer, key, contentType, bucket);
            const size = buffer.length;

            const durationInSec = validatedResult.duration;

            const asset = await this.prisma.fileAsset.create({
                data: {
                    name: fileName,
                    userId: data.canvas.userId,
                    bucket,
                    key,
                    size,
                    width: validatedResult.width,
                    height: validatedResult.height,
                    fps: Math.round(validatedResult.fps),
                    duration: durationInSec > 0 ? Math.round(durationInSec * 1000) : undefined,
                    mimeType: contentType,
                },
            });

            const newResult = structuredClone(node.result as unknown as LottieResult) ?? {
                outputs: [],
                selectedOutputIndex: 0,
            };

            newResult.outputs.push({
                items: [
                    {
                        type: DataType.Lottie,
                        data: createVirtualMedia({ entity: asset }),
                        outputHandleId: outputHandle.id,
                    },
                ],
            });
            newResult.selectedOutputIndex = newResult.outputs.length - 1;

            return { success: true, newResult };
        } catch (err: unknown) {
            logger.error({ err }, "Lottie Generation Failed");
            return { success: false, error: err instanceof Error ? err.message : "Lottie Generation failed" };
        }
    }
}
