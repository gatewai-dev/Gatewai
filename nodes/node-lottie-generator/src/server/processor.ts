import fs from "node:fs";
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
import { get_schema_path, LottieValidator } from "@lottie-animation-community/lottie-specs/src/validator-node.js";
import Ajv2020 from "ajv/dist/2020.js";
import { inject, injectable } from "inversify";
import { z } from "zod";
import { LottieNodeConfigSchema } from "../metadata.js";
import type { LottieResult } from "../shared/index.js";
import { LOTTIE_HELPER_API_DOCS, LOTTIE_HELPERS_CODE } from "./lottie-helpers.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 4;
const DEFAULT_CANVAS = 512;
const DEFAULT_FPS = 30;
const DEFAULT_DURATION = 3; // seconds

// ═══════════════════════════════════════════════════════════════════════════════
//  SANITIZER — auto-patches LLM hallucinations before schema validation
// ═══════════════════════════════════════════════════════════════════════════════

interface LottieLayer {
    ty: number;
    ef?: unknown[];
    ks?: Record<string, unknown>;
    [key: string]: unknown;
}

interface LottieAsset {
    layers?: LottieLayer[];
    [key: string]: unknown;
}

interface LottieJSON {
    v?: string;
    fr?: number;
    ip?: number;
    op?: number;
    w?: number;
    h?: number;
    ddd?: number;
    layers?: LottieLayer[];
    assets?: LottieAsset[];
    markers?: unknown[];
    [key: string]: unknown;
}

function hasPaint(shapes: unknown[]): boolean {
    if (!shapes || !Array.isArray(shapes)) return false;
    for (const s of shapes) {
        if (!s || typeof s !== "object") continue;
        const ty = (s as any).ty;
        // Check for Lottie paint properties
        if (ty === 'fl' || ty === 'st' || ty === 'gf' || ty === 'gs') return true;
        // Recursively check groups
        if (ty === 'gr' && Array.isArray((s as any).it)) {
            if (hasPaint((s as any).it)) return true;
        }
    }
    return false;
}

/**
 * Recursively patches the most common LLM mistakes:
 *  1. Groups missing their `tr` block (or `tr` not last)
 *  2. Primitives (el/rc/sr) missing the `d` direction field
 *  3. 3D coordinate arrays where 2D is required (ddd:0)
 *  4. Missing `st` on layers
 */
function sanitizeLottie(obj: unknown): unknown {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
        return obj.map(sanitizeLottie);
    }

    const o = obj as Record<string, unknown>;

    // Fix 1: shape group — tr must exist and be last
    if (o.ty === "gr" && Array.isArray(o.it)) {
        const items = o.it as Record<string, unknown>[];
        const trIdx = items.findIndex((x) => x && x.ty === "tr");
        if (trIdx === -1) {
            // Inject a safe default transform
            items.push({
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
                sk: { a: 0, k: 0 },
                sa: { a: 0, k: 0 },
            });
        } else if (trIdx !== items.length - 1) {
            // Move tr to last position
            const [tr] = items.splice(trIdx, 1);
            items.push(tr);
        }
        o.it = items;
    }

    // Fix 2: primitives must have direction d:1
    if (["el", "rc", "sr"].includes(o.ty as string) && o.d === undefined) {
        o.d = 1;
    }

    // Fix 3: strip 3D z components from 2D animation (ddd:0)
    if (o.ty !== undefined && typeof o.ks === "object" && o.ks !== null) {
        const ks = o.ks as Record<string, unknown>;
        for (const prop of ["p", "a", "s"]) {
            if (prop in ks) {
                ks[prop] = strip3D(ks[prop]);
            }
        }
    }

    // Fix 3b: strip 3D from shape group transforms
    if (o.ty === "tr") {
        for (const prop of ["p", "a", "s"]) {
            if (prop in o) {
                o[prop] = strip3D(o[prop]);
            }
        }
    }

    // Fix 4: layers must have st field
    const LAYER_TYPES = new Set([0, 1, 2, 3, 4, 5, 6, 13, 14]);
    if (typeof o.ty === "number" && LAYER_TYPES.has(o.ty) && o.st === undefined) {
        o.st = 0;
    }

    // Recurse
    for (const key of Object.keys(o)) {
        o[key] = sanitizeLottie(o[key]);
    }

    return o;
}

/**
 * Strip the z-component from a static or animated 3D value,
 * converting [x, y, z] → [x, y] and keyframe arrays accordingly.
 */
function strip3D(val: unknown): unknown {
    if (!val || typeof val !== "object") return val;
    const v = val as Record<string, unknown>;

    if (v.a === 0) {
        // Static value
        if (Array.isArray(v.k) && v.k.length === 3) {
            v.k = [v.k[0], v.k[1]];
        }
    } else if (v.a === 1 && Array.isArray(v.k)) {
        // Animated value — strip 3D from each keyframe s/e
        v.k = (v.k as Record<string, unknown>[]).map((kf) => {
            const kfObj = { ...kf };
            if (Array.isArray(kfObj.s) && kfObj.s.length === 3) kfObj.s = [kfObj.s[0], kfObj.s[1]];
            if (Array.isArray(kfObj.e) && kfObj.e.length === 3) kfObj.e = [kfObj.e[0], kfObj.e[1]];
            return kfObj;
        });
    }
    return v;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  REMOTION VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

export interface ValidationResult {
    valid: boolean;
    warnings: string[];
    errors: string[];
}

const UNSUPPORTED_LAYER_TYPES = new Set([6, 7, 8, 9, 13, 14]);
const LAYER_TYPE_NAMES: Record<number, string> = {
    0: "Precomp", 1: "Solid", 2: "Image", 3: "Null", 4: "Shape",
    5: "Text", 6: "Audio", 7: "Video Placeholder", 8: "Image Sequence",
    9: "Video", 10: "Image Placeholder", 11: "Guide", 12: "Adjustment",
    13: "Camera", 14: "Light",
};

function checkLayers(
    layers: LottieLayer[],
    context: string,
    ddd: number,
): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    layers.forEach((layer, i) => {
        const name = (layer.nm as string) ?? `Layer ${i}`;
        const ty = layer.ty;

        if (UNSUPPORTED_LAYER_TYPES.has(ty)) {
            errors.push(
                `[${context}] "${name}" uses unsupported layer type ` +
                `${LAYER_TYPE_NAMES[ty] ?? ty} (ty:${ty}) — not supported in Remotion`,
            );
        }

        if (layer.ef && Array.isArray(layer.ef) && layer.ef.length > 0) {
            warnings.push(
                `[${context}] "${name}" has ${layer.ef.length} AE effect(s) — ` +
                `not rendered in Remotion's SVG engine`,
            );
        }

        if (ty === 5) {
            warnings.push(`[${context}] "${name}" is a Text layer — TextAnimator may not render correctly`);
        }

        if (layer.tm !== undefined) {
            warnings.push(`[${context}] "${name}" uses time remapping — may cause frame-seeking issues`);
        }

        if (layer.st === undefined) {
            errors.push(`[${context}] "${name}" is missing required "st" (start time) field`);
        }

        // 2D coordinate enforcement (ddd:0)
        if (ddd === 0 && layer.ks) {
            const ks = layer.ks as Record<string, unknown>;
            for (const prop of ["p", "a", "s"]) {
                if (!ks[prop]) continue;
                const pv = ks[prop] as Record<string, unknown>;
                if (pv.a === 0 && Array.isArray(pv.k) && pv.k.length === 3) {
                    errors.push(
                        `[${context}] "${name}" layer.ks.${prop} has 3D [x,y,z] but ddd=0 — use [x,y]`,
                    );
                }
                if (pv.a === 1 && Array.isArray(pv.k)) {
                    (pv.k as Record<string, unknown>[]).forEach((kf, ki) => {
                        if (Array.isArray(kf.s) && kf.s.length === 3) {
                            errors.push(
                                `[${context}] "${name}" layer.ks.${prop} keyframe[${ki}].s is 3D — use [x,y]`,
                            );
                        }
                        if (Array.isArray(kf.e) && kf.e.length === 3) {
                            errors.push(
                                `[${context}] "${name}" layer.ks.${prop} keyframe[${ki}].e is 3D — use [x,y]`,
                            );
                        }
                    });
                }
            }
        }
    });

    return { warnings, errors };
}

function hasExpressions(obj: unknown, path = ""): string[] {
    const found: string[] = [];
    const EXPRESSION_MARKERS = [
        "$bm_", "wiggle(", "loopOut", "loopIn", "linear(", "ease(",
        "thisComp", "thisLayer", "comp(", "footage(",
    ];

    if (typeof obj === "string") {
        if (EXPRESSION_MARKERS.some((m) => obj.includes(m))) {
            found.push(`Expression at ${path}: "${obj.slice(0, 80)}"`);
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((item, i) => found.push(...hasExpressions(item, `${path}[${i}]`)));
    } else if (obj && typeof obj === "object") {
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            if (key === "x" && typeof value === "string" && value.trim().length > 0) {
                found.push(`Expression at ${path}.x: "${value.slice(0, 80)}"`);
            } else {
                found.push(...hasExpressions(value, `${path}.${key}`));
            }
        }
    }
    return found;
}

export function validateLottieForRemotion(json: LottieJSON): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!json.layers || !Array.isArray(json.layers)) {
        errors.push("Missing root layers array");
        return { valid: false, warnings, errors };
    }

    // Required top-level fields
    for (const field of ["fr", "ip", "op", "w", "h", "ddd"] as const) {
        if (json[field] === undefined) errors.push(`Missing required top-level field "${field}"`);
    }

    if (json.ddd !== undefined && json.ddd !== 0) {
        errors.push(`"ddd" is ${json.ddd} — only ddd:0 (2D) is supported by Remotion`);
    }

    if (json.fr && json.ip !== undefined && json.op !== undefined) {
        if (json.op <= json.ip) {
            errors.push(`"op" (${json.op}) must be greater than "ip" (${json.ip})`);
        }
        if (json.op > json.fr * 300) {
            warnings.push(`Animation is very long (${(json.op / json.fr).toFixed(1)}s) — consider shorter for performance`);
        }
    }

    const ddd = json.ddd ?? 0;
    const rootCheck = checkLayers(json.layers, "root", ddd);
    warnings.push(...rootCheck.warnings);
    errors.push(...rootCheck.errors);

    if (json.assets && Array.isArray(json.assets)) {
        json.assets.forEach((asset) => {
            if (asset.layers && Array.isArray(asset.layers)) {
                const id = (asset.id as string) ?? "unknown";
                const check = checkLayers(asset.layers, `asset:${id}`, ddd);
                warnings.push(...check.warnings);
                errors.push(...check.errors);
            }
        });
    }

    const expressionHits = hasExpressions(json);
    expressionHits.forEach((hit) => {
        errors.push(`Expression found (non-deterministic in Remotion): ${hit}`);
    });

    if (json.markers && Array.isArray(json.markers) && json.markers.length > 0) {
        warnings.push(`File uses ${json.markers.length} marker(s) — Remotion ignores Lottie markers`);
    }

    return { valid: errors.length === 0, warnings, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOTTIE SPEC VALIDATOR (official community schema)
// ═══════════════════════════════════════════════════════════════════════════════

let _lottieValidator: LottieValidator | null = null;

function getLottieValidator(): LottieValidator {
    if (!_lottieValidator) {
        const schemaPath = get_schema_path();
        const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
        const AjvClass = (Ajv2020 as any).default ?? (Ajv2020 as any).Ajv2020 ?? Ajv2020;
        _lottieValidator = new LottieValidator(AjvClass, schema);
    }
    return _lottieValidator;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ZOD RESULT SCHEMA — validation pipeline
// ═══════════════════════════════════════════════════════════════════════════════

const LottieSandboxResultSchema = z
    .object({
        lottie: z.any().describe("The complete Lottie JSON object"),
        width: z.number().positive().describe("Canvas width in pixels"),
        height: z.number().positive().describe("Canvas height in pixels"),
        fps: z.number().positive().describe("Frames per second"),
        duration: z.number().positive().describe("Total duration in seconds"),
    })
    // Step 1: auto-patch hallucinations before any validation runs
    .transform((val) => {
        val.lottie = sanitizeLottie(val.lottie);
        return val;
    })
    // Step 2: Remotion compatibility checks
    .superRefine((val, ctx) => {
        const result = validateLottieForRemotion(val.lottie as LottieJSON);
        if (!result.valid) {
            result.errors.forEach((err) => {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: err, path: ["lottie"] });
            });
        }
    })
    // Step 3: official Lottie community spec
    .superRefine((val, ctx) => {
        try {
            const validator = getLottieValidator();
            const errors = validator.validate(val.lottie, false);
            if (errors && Array.isArray(errors) && errors.length > 0) {
                errors.forEach((err: unknown) => {
                    const msg = typeof err === "object" && err !== null
                        ? (err as { message?: string }).message ?? JSON.stringify(err)
                        : String(err);
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: `Lottie Spec: ${msg}`,
                        path: ["lottie"],
                    });
                });
            }
        } catch (err: unknown) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Spec validation threw: ${err instanceof Error ? err.message : String(err)}`,
                path: ["lottie"],
            });
        }
    });

// ═══════════════════════════════════════════════════════════════════════════════
//  SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(isEditing: boolean, w: number, h: number, fps: number, duration: number): string {
    return `\
You are a world-class Lottie animation engineer.
Your job is to write JavaScript that programmatically constructs a rich, valid Lottie JSON animation for a Remotion player.

## Globals available in the sandbox
- \`prompt\`        {string}  The user's animation request
${isEditing ? "- `sourceLottie` {string}  Existing Lottie JSON to modify" : "- `sourceLottie` {null}"}

${LOTTIE_HELPER_API_DOCS}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL VISUAL RULES (Violations will fail validation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. **SHAPES MUST BE PAINTED**: A geometry (ellipse/rect) without a \`fill()\` or \`stroke()\` is INVISIBLE. Always bundle them using \`makeShape(geometry, paint)\`.
2. **CENTERING**: Lottie draws from the top-left [0,0]. If you leave a layer at [0,0], it will be cut off. Always set the layer position to the center of the canvas: \`p: [${w / 2}, ${h / 2}]\`.
3. **BACKGROUND**: Always make \`ind: 1\` a \`solidLayer\` so the canvas isn't transparent.
4. **OPACITY & SCALE SCALES**: Opacity is 0-100 (NOT 0-1). Scale is [100, 100] (NOT [1, 1]).
5. **NO Z-AXIS**: Absolutely NO 3-element arrays. Use [x, y] only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You must wrap your planning in <thinking> tags to calculate coordinates and timelines, then return the object.

<thinking>
1. Canvas is ${w}x${h}. Center is [${w / 2}, ${h / 2}]. Duration is ${duration}s at ${fps}fps = ${fps * duration} frames.
2. I need a background solid layer (ind: 1).
3. I need a primary shape layer (ind: 2). I will position it at the center.
4. I will construct the shape using \`makeShape(ellipse([0,0], [100,100]), fill(hex("#ff0055")))\`.
</thinking>
\`\`\`js
const W = ${w}, H = ${h}, FPS = ${fps}, DUR = ${duration};
const cx = W / 2, cy = H / 2;

const bg = solidLayer({ nm: "Background", ind: 1, color: "#111111", w: W, h: H });

const circle = shapeLayer({
  nm: "Circle", ind: 2,
  ks: layerTransform({
    p: moveTo(0, sec(1, FPS), [cx, H + 100], [cx, cy]), // Slide up to center
    s: scaleTo(sec(1, FPS), sec(1.5, FPS), [100, 100], [120, 120]) // Pulse
  }),
  shapes: [
    makeShape(ellipse([0,0], [100,100]), fill(hex("#ff3366")))
  ]
});

return {
  lottie: createAnimation({ w: W, h: H, fr: FPS, duration: DUR, layers: [bg, circle] }),
  width: W, height: H, fps: FPS, duration: DUR,
};
\`\`\`
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PROCESSOR
// ═══════════════════════════════════════════════════════════════════════════════

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
            // ── Resolve inputs ────────────────────────────────────────────
            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            if (!userPrompt?.trim()) {
                return { success: false, error: "Prompt is required." };
            }

            const sourceLottieInput = this.graph.getInputValue(data, node.id, false, {
                dataType: DataType.Lottie,
                label: "Source Lottie (Editing)",
            })?.data as FileData | undefined;

            // ── Load source animation ─────────────────────────────────────
            let sourceLottieJson: string | null = null;
            if (sourceLottieInput) {
                const arrayBuffer = await this.graph.loadMediaBuffer(sourceLottieInput);
                sourceLottieJson = Buffer.from(arrayBuffer).toString("utf-8");
            }

            const isEditing = sourceLottieJson !== null;

            // ── Resolve config ────────────────────────────────────────────
            const nodeConfig = LottieNodeConfigSchema.parse(node.config);
            const agentModel = this.aiProvider.getAgentModel<any>(nodeConfig.model);

            const canvasW = nodeConfig.width ?? DEFAULT_CANVAS;
            const canvasH = nodeConfig.height ?? DEFAULT_CANVAS;
            const fps = nodeConfig.fps ?? DEFAULT_FPS;
            const duration = nodeConfig.duration ?? DEFAULT_DURATION;

            // ── Build & run agent ─────────────────────────────────────────
            const { agent, resultStore } = createCodeGenAgent<z.infer<typeof LottieSandboxResultSchema>>({
                name: "LottieGenAgent",
                model: agentModel,
                systemPrompt: buildSystemPrompt(isEditing, canvasW, canvasH, fps, duration),
                preamble: LOTTIE_HELPERS_CODE,
                globals: {
                    prompt: userPrompt,
                    sourceLottie: sourceLottieJson,
                },
                resultSchema: LottieSandboxResultSchema,
                maxRetries: MAX_RETRIES,
                timeoutMs: 15_000,
            });

            const validatedResult = await runCodeGenAgent<z.infer<typeof LottieSandboxResultSchema>>({
                agent,
                resultStore,
                prompt: isEditing
                    ? `Edit the provided Lottie animation: ${userPrompt}`
                    : `Create a Lottie animation: ${userPrompt}`,
            });

            if (!validatedResult?.lottie) {
                return { success: false, error: "Agent failed to return a valid Lottie object." };
            }

            // ── Upload ────────────────────────────────────────────────────
            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle) return { success: false, error: "Output handle is missing." };

            const jsonStr = JSON.stringify(validatedResult.lottie);
            const buffer = Buffer.from(jsonStr, "utf-8");
            const randId = generateId();
            const fileName = `${node.name}_${randId}.json`;
            const key = `assets/${fileName}`;
            const bucket = this.env.GCS_ASSETS_BUCKET;
            const contentType = "application/json";

            await this.storage.uploadToStorage(buffer, key, contentType, bucket);

            // ── Persist asset ─────────────────────────────────────────────
            const durationMs = Math.round(validatedResult.duration * 1000);

            const asset = await this.prisma.fileAsset.create({
                data: {
                    name: fileName,
                    userId: data.canvas.userId,
                    bucket,
                    key,
                    size: buffer.length,
                    width: Math.round(validatedResult.width),
                    height: Math.round(validatedResult.height),
                    fps: Math.round(validatedResult.fps),
                    duration: durationMs > 0 ? durationMs : undefined,
                    mimeType: contentType,
                },
            });

            // ── Build result ──────────────────────────────────────────────
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
            return {
                success: false,
                error: err instanceof Error ? err.message : "Lottie Generation failed",
            };
        }
    }
}