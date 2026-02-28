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

interface LottieLayer {
    ty: number; // layer type
    ef?: unknown[]; // effects
    ks?: {
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

interface LottieAsset {
    layers?: LottieLayer[];
    [key: string]: unknown;
}

interface LottieJSON {
    v?: string;
    layers?: LottieLayer[];
    assets?: LottieAsset[];
    [key: string]: unknown;
}

export interface ValidationResult {
    valid: boolean;
    warnings: string[];
    errors: string[];
}

// Recursively search for expression strings in any object
function hasExpressions(obj: unknown, path = ""): string[] {
    const found: string[] = [];

    if (typeof obj === "string") {
        // Lottie expressions are typically JS code strings stored in "x" keys
        if (obj.includes("$bm_") || obj.includes("wiggle(") || obj.includes("loopOut") || obj.includes("loopIn") || obj.includes("linear(") || obj.includes("ease(") || obj.includes("thisComp") || obj.includes("thisLayer")) {
            found.push(`Expression detected at ${path}: "${obj.slice(0, 60)}..."`);
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((item, i) => found.push(...hasExpressions(item, `${path}[${i}]`)));
    } else if (obj && typeof obj === "object") {
        for (const [key, value] of Object.entries(obj)) {
            // "x" is the expression key in Lottie's property model
            if (key === "x" && typeof value === "string" && value.trim().length > 0) {
                found.push(`Expression at ${path}.x: "${value.slice(0, 60)}"`);
            } else {
                found.push(...hasExpressions(value, `${path}.${key}`));
            }
        }
    }

    return found;
}

// Layer type 6 = precomp, type 5 = text, etc.
const LAYER_TYPE_NAMES: Record<number, string> = {
    0: "Precomp",
    1: "Solid",
    2: "Image",
    3: "Null",
    4: "Shape",
    5: "Text",
    6: "Audio",
    7: "Video Placeholder",
    8: "Image Sequence",
    9: "Video",
    10: "Image Placeholder",
    11: "Guide",
    12: "Adjustment",
    13: "Camera",
    14: "Light",
};

const SVG_UNSUPPORTED_LAYER_TYPES = new Set([6, 7, 8, 9, 13, 14]); // Audio, Video, Camera, Light etc.

function checkLayers(layers: LottieLayer[], context = "root"): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    layers.forEach((layer, i) => {
        const name = (layer.nm as string) ?? `Layer ${i}`;
        const type = layer.ty;

        // Unsupported layer types in SVG renderer
        if (SVG_UNSUPPORTED_LAYER_TYPES.has(type)) {
            errors.push(`[${context}] "${name}" uses unsupported layer type: ${LAYER_TYPE_NAMES[type] ?? type} (ty:${type})`);
        }

        // Effects array — most AE effects are unsupported
        if (layer.ef && Array.isArray(layer.ef) && layer.ef.length > 0) {
            warnings.push(`[${context}] "${name}" has ${layer.ef.length} effect(s) — AE effects are not supported in Remotion's SVG renderer`);
        }

        // Text layers have limited support
        if (type === 5) {
            warnings.push(`[${context}] "${name}" is a Text layer — animated text (TextAnimator) may not render correctly`);
        }

        // Check for time remapping (tm) — can break goToAndStop()
        if (layer.tm !== undefined) {
            warnings.push(`[${context}] "${name}" uses time remapping (tm) — may cause frame-seeking issues in Remotion`);
        }
    });

    return { warnings, errors };
}

export function validateLottieForRemotion(json: LottieJSON): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // 1. Basic structure check
    if (!json.layers || !Array.isArray(json.layers)) {
        errors.push("Invalid Lottie file: missing root layers array");
        return { valid: false, warnings, errors };
    }

    // 2. Check root layers
    const rootCheck = checkLayers(json.layers, "root");
    warnings.push(...rootCheck.warnings);
    errors.push(...rootCheck.errors);

    // 3. Check asset layers (precomps)
    if (json.assets && Array.isArray(json.assets)) {
        json.assets.forEach((asset) => {
            if (asset.layers && Array.isArray(asset.layers)) {
                const assetName = (asset.id as string) ?? "unknown";
                const assetCheck = checkLayers(asset.layers, `asset:${assetName}`);
                warnings.push(...assetCheck.warnings);
                errors.push(...assetCheck.errors);
            }
        });
    }

    // 4. Expression scan (deep)
    const expressionHits = hasExpressions(json);
    if (expressionHits.length > 0) {
        expressionHits.forEach((hit) => {
            errors.push(`Expression found — will not render deterministically: ${hit}`);
        });
    }

    // 5. Marker-based navigation (Remotion uses frame numbers, not markers)
    if (json.markers && Array.isArray(json.markers) && (json.markers as unknown[]).length > 0) {
        warnings.push(`File uses ${(json.markers as unknown[]).length} marker(s) — Remotion doesn't use Lottie markers; ensure timing is frame-based`);
    }

    return {
        valid: errors.length === 0,
        warnings,
        errors,
    };
}

/** Maximum retry attempts for generation + validation. */
const MAX_RETRIES = 3;

let lottieValidatorInstance: any = null;

function getLottieValidator() {
    if (!lottieValidatorInstance) {
        const schemaPath = get_schema_path();
        const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

        // Handle common/ESM interop ways of importing Ajv2020
        const AjvClass = (Ajv2020 as any).default || (Ajv2020 as any).Ajv2020 || Ajv2020;
        lottieValidatorInstance = new LottieValidator(AjvClass, schema);
    }
    return lottieValidatorInstance;
}

const LottieSandboxResultSchema = z.object({
    lottie: z.any().describe("The generated Lottie JSON object"),
    width: z.number().describe("The width of the Lottie animation"),
    height: z.number().describe("The height of the Lottie animation"),
    fps: z.number().describe("The framerate of the Lottie animation"),
    duration: z.number().describe("The duration of the Lottie animation in seconds"),
}).superRefine((val, ctx) => {
    // 1. Existing Remotion-specific validation
    const result = validateLottieForRemotion(val.lottie as LottieJSON);
    if (!result.valid) {
        result.errors.forEach((err) => {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: err,
                path: ["lottie"]
            });
        });
    }

    // 2. Official Lottie Spec Validation
    try {
        const validator = getLottieValidator();
        const errors = validator.validate(val.lottie, false); // pass false to suppress warnings

        if (errors && Array.isArray(errors) && errors.length > 0) {
            errors.forEach((err: any) => {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Lottie Spec Error: ${err.message || JSON.stringify(err)}`,
                    path: ["lottie"]
                });
            });
        }
    } catch (err: any) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Failed to validate against official Lottie spec: ${err.message}`,
            path: ["lottie"]
        });
    }
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
            const systemPrompt = `You are a world-class Lottie animation engineer. Your job is to write JavaScript code that programmatically constructs a rich, high-quality Lottie JSON animation based on the user's prompt. The output will be rendered inside a Remotion player, so correctness and visual quality are critical.

You have access to the following global variables:
- \`prompt\` (string): The user's animation request.
- \`sourceLottie\` (string | null): A serialised Lottie JSON string if the user wants to edit an existing animation; otherwise \`null\`.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED RETURN VALUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You MUST return a plain JavaScript object — not a JSON string, not markdown — with these exact keys:

return {
    lottie:   <Object>  // The complete, valid Lottie JSON object (parsed, not stringified)
    width:    <number>  // Canvas width in pixels
    height:   <number>  // Canvas height in pixels
    fps:      <number>  // Frames per second (30 or 60 recommended)
    duration: <number>  // Total duration in seconds (e.g. 2.0)
};

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOTTIE SPEC REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every generated Lottie object MUST include:
  • v   — version string, e.g. "5.12.1"
  • fr  — frame rate (match the fps you return)
  • ip  — in-point, always 0
  • op  — out-point = Math.round(fps * duration)
  • w   — width (match the width you return)
  • h   — height (match the height you return)
  • nm  — a short descriptive name for the animation
  • ddd — always 0 (no 3-D)
  • assets — [] unless you are embedding pre-comps or images
  • layers — array of at least one layer with real keyframe data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. DIMENSIONS & TIMING
   - Default: 512 × 512 px, 30 fps. Use 60 fps only for fast/smooth motion.
   - Keep duration between 1 s and 8 s unless the prompt explicitly asks for longer.
   - Align op exactly: op = Math.round(fr * duration).

2. LAYER STRUCTURE
   - Use Shape Layers (ty: 4) for vector graphics — they are the most portable and Remotion-friendly.
   - Use Null Layers (ty: 3) as parent controllers to orchestrate complex motion — attach child layers via the \`parent\` field.
   - Avoid Image Layers (ty: 2) unless the prompt explicitly requires bitmap imagery.
   - Give every layer a unique \`ind\` (integer, 1-based) and a descriptive \`nm\`.

3. ANIMATION PRINCIPLES — MAKE IT FEEL ALIVE
   Apply at least one of the following to every animated property:
   a) Easing — use Bézier handles on keyframes. For a natural ease-in-out:
      i: { x: [0.42], y: [0] }   (ease-in handle)
      o: { x: [0.58], y: [1] }   (ease-out handle)
   b) Overshoot / spring — slightly exceed the target value then settle.
   c) Stagger — offset start frames of sibling elements by 3–6 frames for organic feel.
   d) Secondary motion — e.g. a bouncing ball should also squash/stretch (scale keyframes).

4. KEYFRAME FORMAT
   Each animated property uses the "a": 1 / "k": [...] form:
   {
     "a": 1,
     "k": [
       { "t": <frame>, "s": [<value>], "e": [<nextValue>], "i": { "x": [...], "y": [...] }, "o": { "x": [...], "y": [...] } },
       { "t": <lastFrame>, "s": [<finalValue>] }
     ]
   }
   Static properties use "a": 0 / "k": <value>.

5. COLOURS
   Lottie colours are normalised RGBA arrays in [0,1] range — NOT hex, NOT 0–255.
   Example: pure red = [1, 0, 0, 1].
   Use visually appealing, on-brand palettes. Avoid flat grey or pure black unless the prompt asks.

6. SHAPES (Shape Layer items — \`it\` array)
   Common shape types:
   - \`el\` = Ellipse    { ty: "el", p: {a,k}, s: {a,k} }
   - \`rc\` = Rectangle  { ty: "rc", p: {a,k}, s: {a,k}, r: {a,k} }
   - \`sr\` = Polystar   { ty: "sr", ... }
   - \`sh\` = Path       { ty: "sh", ks: { a, k: <BezierShape|keyframes> } }
   - \`fl\` = Fill       { ty: "fl", c: {a,k}, o: {a,k} }
   - \`st\` = Stroke     { ty: "st", c: {a,k}, o: {a,k}, w: {a,k}, lc: 2, lj: 2 }
   - \`tr\` = Transform  { ty: "tr", p, a, s, r, o, sk, sa } — REQUIRED in every shape group
   - \`gr\` = Group      { ty: "gr", it: [...shapes, transform] }

7. TRANSFORM BLOCK (tr) — required on every shape group and layer
   {
     "ty": "tr",
     "p":  { "a": 0, "k": [256, 256] },   // position (x, y)
     "a":  { "a": 0, "k": [0, 0] },        // anchor point
     "s":  { "a": 0, "k": [100, 100] },    // scale (%)
     "r":  { "a": 0, "k": 0 },             // rotation (degrees)
     "o":  { "a": 0, "k": 100 },           // opacity (%)
     "sk": { "a": 0, "k": 0 },             // skew
     "sa": { "a": 0, "k": 0 }              // skew axis
   }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REMOTION-SPECIFIC RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Remotion renders Lottie frame-by-frame using lottie-web's \`goToAndStop()\`. This means:

✅ SAFE — use freely:
  - Position, scale, rotation, opacity keyframes on shapes and layers
  - Fill & stroke colour keyframes
  - Trim paths (tm)
  - Shape path morphing with consistent vertex counts
  - Repeater (rp) shapes
  - Null parent/child hierarchies

⚠️  CONDITIONAL — test before using:
  - Expressions that reference \`time\` or \`thisComp\` — only use if the result is deterministic per frame
  - Time-remapping — only on pre-comps with simple speed changes

❌ AVOID — causes flickering or broken output:
  - Expressions that call \`Math.random()\` or produce non-deterministic results per frame
  - Expressions that depend on playback state (e.g. \`loopOut()\`, \`wiggle()\`)
  - Audio layers (ty: 6) — not supported in Remotion's Lottie component
  - Very large embedded image assets (use SVG shapes instead)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDITING AN EXISTING ANIMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If \`sourceLottie\` is not null:
  1. Parse it: \`const anim = JSON.parse(sourceLottie);\`
  2. Apply only the changes described in \`prompt\` — preserve all other layers, timing, and assets.
  3. Return the mutated \`anim\` object as the \`lottie\` field.
  4. Derive \`width\`, \`height\`, \`fps\`, and \`duration\` from the parsed object unless the prompt asks to change them:
     fps = anim.fr; width = anim.w; height = anim.h; duration = (anim.op - anim.ip) / anim.fr;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Return a JavaScript \`return { lottie, width, height, fps, duration }\` statement.
- Do NOT wrap output in markdown code fences.
- Do NOT JSON.stringify the lottie value — return the actual object.
- Ensure all numeric keyframe arrays have consistent lengths (e.g. both "s" and "e" must have the same array length for a given property).
- Validate mentally: op must equal Math.round(fr * duration), layer ip/op must be within [0, op].


CRITICAL:

Generate a Lottie animation that avoids After Effects expressions, uses only standard shape layers and keyframes, and renders correctly with SVG renderer. Ensure the animation works with frame-by-frame seeking via goToAndStop() without relying on expression-based calculations.
`;

            // ── Setup Code-Gen Agent ─────────────────────────────────
            const { agent, resultStore } = createCodeGenAgent<z.infer<typeof LottieSandboxResultSchema>>({
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
            const validatedResult = await runCodeGenAgent<z.infer<typeof LottieSandboxResultSchema>>({
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