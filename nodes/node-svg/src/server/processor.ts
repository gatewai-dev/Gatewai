import { createCodeGenAgent, runCodeGenAgent } from "@gatewai/ai-agent";
import {
    type EnvConfig,
    extractSvgDimensions,
    generateId,
    logger,
    type StorageService,
} from "@gatewai/core";
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
import { SVG_HELPER_API_DOCS, SVG_HELPERS_CODE } from "./svg-helpers.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 4;
const DEFAULT_CANVAS_SIZE = 1024;

// ─── Zod schema ──────────────────────────────────────────────────────────────

const SvgSandboxResultSchema = z.object({
    svg: z
        .string()
        .min(1, "SVG string must not be empty")
        .refine((s) => s.trimStart().startsWith("<svg"), {
            message: 'SVG string must start with an <svg element, not a backtick or markdown fence',
        }),
});

// ─── System prompt factory ────────────────────────────────────────────────────

function buildSystemPrompt(isEditing: boolean, canvasW: number, canvasH: number): string {
    return `You are an expert SVG graphics engineer.
Your sole task is to write JavaScript code that generates a visually stunning, high-quality SVG.

## Available globals (access directly — no imports needed)
- \`prompt\`    {string}  The user's graphic request
${isEditing ? "- `sourceSvg` {string}  The existing SVG XML you must modify" : "- `sourceSvg` {null}    No source SVG (create from scratch)"}

## Helper library (pre-loaded — all functions are already global)

${SVG_HELPER_API_DOCS}

## Required return format
Your code MUST return an object with a single \`svg\` property:
\`\`\`js
return {
  svg: '<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">...</svg>'
};
\`\`\`

## Canvas & structure rules
- Always use a ${canvasW}×${canvasH} canvas with \`xmlns\`, \`width\`, \`height\`, and \`viewBox\`.
- Put all \`<defs>\` content first (gradients, filters, patterns).
- Use \`svgRoot(w, h, content, defs)\` to assemble the final SVG — it handles the wrapper correctly.
- The returned string must be raw SVG XML — NOT wrapped in backticks, code fences, or quotes.

## Design philosophy
- Favour procedural generation: loops, Math functions, and helpers over hand-coded coordinates.
- Layer depth: background gradient → midground shapes → foreground detail → highlights.
- Use \`linearGradient\` / \`radialGradient\` for fills rather than flat colours.
- Add \`dropShadowFilter\` or \`glowFilter\` for dimensionality.
- Pick a harmonious palette with \`harmonicPalette(baseHue, n)\` or \`gradientPalette(h1, h2, n)\`.
- Use \`seedRand(42)\` for reproducible pseudo-randomness when scattering elements.

## Composition patterns (pick what fits the prompt)
\`\`\`js
// ── Example 1: Concentric rings with glow ───────────────────────
const cx = ${canvasW} / 2, cy = ${canvasH} / 2;
const rng = seedRand(7);
const palette = harmonicPalette(200, 6);
const defs = [
  radialGradient('bg', cx, cy, Math.max(${canvasW}, ${canvasH}) * 0.8, [['0%', '#0a0a1a'], ['100%', '#000']]),
  glowFilter('glow', palette[0], 12),
].join('');
let shapes = rect(0, 0, ${canvasW}, ${canvasH}, { fill: 'url(#bg)' });
for (let i = 0; i < 8; i++) {
  const r = 80 + i * 55;
  const color = palette[i % palette.length];
  shapes += circle(cx, cy, r, {
    fill: 'none', stroke: color,
    'stroke-width': 2 + rng() * 4,
    'stroke-opacity': 0.6 + rng() * 0.4,
    filter: 'url(#glow)',
  });
}
return { svg: svgRoot(${canvasW}, ${canvasH}, shapes, defs) };

// ── Example 2: Edit mode — change fill colours ──────────────────
const updated = sourceSvg
  .replace(/fill="#[0-9a-fA-F]{3,6}"/g, (m, i) =>
    \`fill="\${hsl((i * 37) % 360, 70, 55)}"\`
  );
return { svg: updated };
\`\`\`

${isEditing
            ? `## Editing an existing SVG
- Parse \`sourceSvg\` with string operations or regex — no DOM APIs available.
- When replacing elements, preserve the outer \`<svg>\` wrapper exactly (attributes + namespace).
- Only modify what the prompt asks for; keep everything else intact.
- Return the full modified SVG string (not a diff or partial).`
            : ""
        }

## What NOT to do
- Do NOT use \`import\`, \`require\`, \`export\`, \`async\`, \`await\`, \`fetch\`, or DOM APIs.
- Do NOT return a partial SVG or an object without the \`svg\` key.
- Do NOT JSON.stringify the SVG string before returning.
`.trim();
}

// ─── Processor ────────────────────────────────────────────────────────────────

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
            // ── Resolve inputs ───────────────────────────────────────────
            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            if (!userPrompt?.trim()) {
                return { success: false, error: "Prompt is required." };
            }

            const sourceSvgInput = this.graph.getInputValue(data, node.id, false, {
                dataType: DataType.SVG,
                label: "Source SVG (Editing)",
            })?.data as FileData | undefined;

            // ── Load source SVG ──────────────────────────────────────────
            let sourceSvgContent: string | null = null;
            if (sourceSvgInput) {
                const arrayBuffer = await this.graph.loadMediaBuffer(sourceSvgInput);
                sourceSvgContent = Buffer.from(arrayBuffer).toString("utf-8");
            }

            const isEditing = sourceSvgContent !== null;

            // ── Resolve canvas dimensions from config ────────────────────
            const nodeConfig = SvgNodeConfigSchema.parse(node.config);
            const canvasW = nodeConfig.autoDimensions ? DEFAULT_CANVAS_SIZE : nodeConfig.width;
            const canvasH = nodeConfig.autoDimensions ? DEFAULT_CANVAS_SIZE : nodeConfig.height;

            // ── Setup agent ──────────────────────────────────────────────
            const agentModel = this.aiProvider.getAgentModel<any>(nodeConfig.model);

            const { agent, resultStore } = createCodeGenAgent<{ svg: string }>({
                name: "SvgGenAgent",
                model: agentModel,
                systemPrompt: buildSystemPrompt(isEditing, canvasW, canvasH),
                preamble: SVG_HELPERS_CODE,
                globals: {
                    prompt: userPrompt,
                    sourceSvg: sourceSvgContent,
                },
                resultSchema: SvgSandboxResultSchema,
                maxRetries: MAX_RETRIES,
                timeoutMs: 10_000,
            });

            // ── Run agent ────────────────────────────────────────────────
            const result = await runCodeGenAgent<{ svg: string }>({
                agent,
                resultStore,
                prompt: isEditing
                    ? `Edit the provided SVG as follows: ${userPrompt}`
                    : `Create an SVG: ${userPrompt}`,
            });

            if (!result?.svg) {
                return { success: false, error: "Agent failed to return a valid SVG." };
            }

            // ── Validate basic SVG structure ─────────────────────────────
            const svgContent = result.svg.trim();
            if (!svgContent.includes("<svg") || !svgContent.includes("</svg>")) {
                return {
                    success: false,
                    error: "Agent returned malformed SVG (missing opening or closing tag).",
                };
            }

            // ── Upload to storage ────────────────────────────────────────
            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle) {
                return { success: false, error: "Output handle is missing." };
            }

            const buffer = Buffer.from(svgContent, "utf-8");
            const randId = generateId();
            const fileName = `${node.name}_${randId}.svg`;
            const key = `assets/${fileName}`;
            const bucket = this.env.GCS_ASSETS_BUCKET;
            const contentType = "image/svg+xml";

            await this.storage.uploadToStorage(buffer, key, contentType, bucket);

            // ── Derive display dimensions ────────────────────────────────
            let width: number;
            let height: number;

            if (nodeConfig.autoDimensions) {
                const dim = extractSvgDimensions(buffer);
                ({ width, height } = normaliseDimensions(dim?.w, dim?.h));
            } else {
                ({ width, height } = normaliseDimensions(canvasW, canvasH));
            }

            // ── Persist asset record ─────────────────────────────────────
            const asset = await this.prisma.fileAsset.create({
                data: {
                    name: fileName,
                    userId: data.canvas.userId,
                    bucket,
                    key,
                    size: buffer.length,
                    width,
                    height,
                    mimeType: contentType,
                },
            });

            // ── Build result ─────────────────────────────────────────────
            const newResult = (
                structuredClone(node.result as unknown as SvgResult) ?? {
                    outputs: [],
                    selectedOutputIndex: 0,
                }
            );

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
            return {
                success: false,
                error: err instanceof Error ? err.message : "SVG Generation failed",
            };
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise raw SVG intrinsic dimensions to a bounded display size.
 * Preserves aspect ratio while capping the longer edge at TARGET_PX.
 */
function normaliseDimensions(
    rawW: number | undefined,
    rawH: number | undefined,
    targetPx = 512,
): { width: number; height: number } {
    if (!rawW || !rawH || rawW <= 0 || rawH <= 0) {
        return { width: targetPx, height: targetPx };
    }
    if (rawW >= rawH) {
        return {
            width: targetPx,
            height: Math.round(targetPx * (rawH / rawW)),
        };
    }
    return {
        width: Math.round(targetPx * (rawW / rawH)),
        height: targetPx,
    };
}