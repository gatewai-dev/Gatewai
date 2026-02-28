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
    ty: number;
    ef?: unknown[];
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

export interface ValidationResult {
    valid: boolean;
    warnings: string[];
    errors: string[];
}

// ---------------------------------------------------------------------------
// SANITIZER: Automatically patches LLM hallucinations before validation
// ---------------------------------------------------------------------------
function sanitizeLottie(obj: any): any {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = sanitizeLottie(obj[i]);
        }
        return obj;
    }

    // Fix 1: Groups (gr) MUST have a Transform (tr) as the VERY LAST item
    if (obj.ty === "gr" && Array.isArray(obj.it)) {
        const trIndex = obj.it.findIndex((item: any) => item && item.ty === "tr");
        if (trIndex !== -1) {
            // If transform exists but isn't last, move it to the end
            if (trIndex !== obj.it.length - 1) {
                const tr = obj.it.splice(trIndex, 1)[0];
                obj.it.push(tr);
            }
        } else {
            // If missing entirely, inject a default 2D transform to prevent engine crashes
            obj.it.push({
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 },
                sk: { a: 0, k: 0 },
                sa: { a: 0, k: 0 }
            });
        }
    }

    // Fix 2: Primitives MUST have a Path Direction (d)
    if (["rc", "el", "sr"].includes(obj.ty)) {
        if (obj.d === undefined) {
            obj.d = 1; // 1 = Clockwise
        }
    }

    // Recursively sanitize all object properties
    for (const key in obj) {
        obj[key] = sanitizeLottie(obj[key]);
    }

    return obj;
}

// Recursively search for expression strings in any object
function hasExpressions(obj: unknown, path = ""): string[] {
    const found: string[] = [];

    if (typeof obj === "string") {
        if (
            obj.includes("$bm_") ||
            obj.includes("wiggle(") ||
            obj.includes("loopOut") ||
            obj.includes("loopIn") ||
            obj.includes("linear(") ||
            obj.includes("ease(") ||
            obj.includes("thisComp") ||
            obj.includes("thisLayer")
        ) {
            found.push(`Expression detected at ${path}: "${obj.slice(0, 60)}..."`);
        }
    } else if (Array.isArray(obj)) {
        obj.forEach((item, i) => found.push(...hasExpressions(item, `${path}[${i}]`)));
    } else if (obj && typeof obj === "object") {
        for (const [key, value] of Object.entries(obj)) {
            if (key === "x" && typeof value === "string" && value.trim().length > 0) {
                found.push(`Expression at ${path}.x: "${value.slice(0, 60)}"`);
            } else {
                found.push(...hasExpressions(value, `${path}.${key}`));
            }
        }
    }

    return found;
}

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

const SVG_UNSUPPORTED_LAYER_TYPES = new Set([6, 7, 8, 9, 13, 14]);

function checkLayers(layers: LottieLayer[], context = "root"): { warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    layers.forEach((layer, i) => {
        const name = (layer.nm as string) ?? `Layer ${i}`;
        const type = layer.ty;

        if (SVG_UNSUPPORTED_LAYER_TYPES.has(type)) {
            errors.push(`[${context}] "${name}" uses unsupported layer type: ${LAYER_TYPE_NAMES[type] ?? type} (ty:${type})`);
        }

        if (layer.ef && Array.isArray(layer.ef) && layer.ef.length > 0) {
            warnings.push(`[${context}] "${name}" has ${layer.ef.length} effect(s) — AE effects are not supported in Remotion's SVG renderer`);
        }

        if (type === 5) {
            warnings.push(`[${context}] "${name}" is a Text layer — animated text (TextAnimator) may not render correctly`);
        }

        if (layer.tm !== undefined) {
            warnings.push(`[${context}] "${name}" uses time remapping (tm) — may cause frame-seeking issues in Remotion`);
        }

        if (layer.st === undefined) {
            errors.push(`[${context}] "${name}" is missing required "st" (start time) field — must be set to 0 or a valid frame offset`);
        }

        const ks = layer.ks as Record<string, any> | undefined;
        if (ks) {
            const pos = ks.p;
            if (pos) {
                const checkPosKeyframes = (k: any) => {
                    if (Array.isArray(k)) {
                        k.forEach((kf: any) => {
                            if (kf && typeof kf === "object" && Array.isArray(kf.s) && kf.s.length === 3) {
                                errors.push(`[${context}] "${name}" has 3D position keyframe [x,y,z] but ddd=0 (2D mode) — use [x,y] instead`);
                            }
                            if (kf && typeof kf === "object" && Array.isArray(kf.e) && kf.e.length === 3) {
                                errors.push(`[${context}] "${name}" has 3D position end keyframe [x,y,z] but ddd=0 (2D mode) — use [x,y] instead`);
                            }
                        });
                    }
                };
                if (pos.a === 1) checkPosKeyframes(pos.k);
                if (pos.a === 0 && Array.isArray(pos.k) && pos.k.length === 3) {
                    errors.push(`[${context}] "${name}" has static 3D position [x,y,z] but ddd=0 (2D mode) — use [x,y] instead`);
                }
            }

            const anchor = ks.a;
            if (anchor) {
                if (anchor.a === 0 && Array.isArray(anchor.k) && anchor.k.length === 3) {
                    errors.push(`[${context}] "${name}" has 3D anchor point [x,y,z] but ddd=0 (2D mode) — use [x,y] instead`);
                }
            }

            const scale = ks.s;
            if (scale) {
                const checkScaleKeyframes = (k: any) => {
                    if (Array.isArray(k)) {
                        k.forEach((kf: any) => {
                            if (kf && typeof kf === "object" && Array.isArray(kf.s) && kf.s.length === 3) {
                                errors.push(`[${context}] "${name}" has 3D scale keyframe [sx,sy,sz] but ddd=0 (2D mode) — use [sx,sy] instead`);
                            }
                            if (kf && typeof kf === "object" && Array.isArray(kf.e) && kf.e.length === 3) {
                                errors.push(`[${context}] "${name}" has 3D scale end keyframe [sx,sy,sz] but ddd=0 (2D mode) — use [sx,sy] instead`);
                            }
                        });
                    }
                };
                if (scale.a === 1) checkScaleKeyframes(scale.k);
                if (scale.a === 0 && Array.isArray(scale.k) && scale.k.length === 3) {
                    errors.push(`[${context}] "${name}" has static 3D scale [sx,sy,sz] but ddd=0 (2D mode) — use [sx,sy] instead`);
                }
            }

            if (scale?.a === 1 && Array.isArray(scale.k)) {
                scale.k.forEach((kf: any, ki: number) => {
                    if (kf && typeof kf === "object" && Array.isArray(kf.s)) {
                        const valLen = kf.s.length;
                        const ixLen = kf.i?.x?.length ?? valLen;
                        const oxLen = kf.o?.x?.length ?? valLen;
                        if (ixLen !== 1 && ixLen !== valLen) {
                            errors.push(`[${context}] "${name}" scale keyframe[${ki}] easing i.x has ${ixLen} values but scale has ${valLen} components — use either 1 (shared) or ${valLen} (per-component) easing values`);
                        }
                        if (oxLen !== 1 && oxLen !== valLen) {
                            errors.push(`[${context}] "${name}" scale keyframe[${ki}] easing o.x has ${oxLen} values but scale has ${valLen} components — use either 1 (shared) or ${valLen} (per-component) easing values`);
                        }
                    }
                });
            }
        }
    });

    return { warnings, errors };
}

export function validateLottieForRemotion(json: LottieJSON): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!json.layers || !Array.isArray(json.layers)) {
        errors.push("Invalid Lottie file: missing root layers array");
        return { valid: false, warnings, errors };
    }

    if (json.fr === undefined) errors.push('Missing required top-level field "fr" (frame rate)');
    if (json.ip === undefined) errors.push('Missing required top-level field "ip" (in-point)');
    if (json.op === undefined) errors.push('Missing required top-level field "op" (out-point)');
    if (json.w === undefined) errors.push('Missing required top-level field "w" (width)');
    if (json.h === undefined) errors.push('Missing required top-level field "h" (height)');
    if (json.ddd === undefined) errors.push('Missing required top-level field "ddd" (3D flag) — should be 0 for 2D');

    if (json.ddd !== undefined && json.ddd !== 0) {
        errors.push(`Top-level "ddd" is ${json.ddd} — only ddd:0 (2D) is supported by Remotion's SVG renderer`);
    }

    if (json.fr && json.ip !== undefined && json.op !== undefined) {
        if (json.op <= json.ip) {
            errors.push(`"op" (${json.op}) must be greater than "ip" (${json.ip})`);
        }
    }

    const rootCheck = checkLayers(json.layers, "root");
    warnings.push(...rootCheck.warnings);
    errors.push(...rootCheck.errors);

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

    const expressionHits = hasExpressions(json);
    if (expressionHits.length > 0) {
        expressionHits.forEach((hit) => {
            errors.push(`Expression found — will not render deterministically: ${hit}`);
        });
    }

    if (json.markers && Array.isArray(json.markers) && json.markers.length > 0) {
        warnings.push(`File uses ${json.markers.length} marker(s) — Remotion doesn't use Lottie markers; ensure timing is frame-based`);
    }

    return {
        valid: errors.length === 0,
        warnings,
        errors,
    };
}

const MAX_RETRIES = 3;

let lottieValidatorInstance: any = null;

function getLottieValidator() {
    if (!lottieValidatorInstance) {
        const schemaPath = get_schema_path();
        const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
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
})
// Transform intercept: patch the LLM hallucinations before validation hits
.transform((val) => {
    val.lottie = sanitizeLottie(val.lottie);
    return val;
})
.superRefine((val, ctx) => {
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

    try {
        const validator = getLottieValidator();
        const errors = validator.validate(val.lottie, false);

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
Every generated Lottie object MUST include these top-level fields:
  • v   — version string, e.g. "5.12.1"
  • fr  — frame rate (MUST match the fps you return)
  • ip  — in-point, ALWAYS 0
  • op  — out-point = Math.round(fps * duration)
  • w   — width (MUST match the width you return)
  • h   — height (MUST match the height you return)
  • nm  — a short descriptive name for the animation
  • ddd — ALWAYS 0 (no 3-D). This is mandatory and non-negotiable.
  • assets — [] unless you are embedding pre-comps or images
  • layers — array of at least one layer with real keyframe data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: 2D-ONLY COORDINATE RULES (ddd: 0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Since ddd is ALWAYS 0 (2D mode), ALL coordinate arrays MUST use 2 components only.
Violating these rules will cause the validator to REJECT your output.

✅ CORRECT — 2D arrays:
  Position:     "k": [256, 128]           // [x, y]
  Anchor:       "k": [0, 0]               // [x, y]
  Scale:        "k": [100, 100]           // [sx%, sy%]
  Keyframe s/e: "s": [256, 128], "e": [256, 400]  // [x, y]

❌ WRONG — 3D arrays (will be REJECTED):
  Position:     "k": [256, 128, 0]        // DO NOT add a z component
  Anchor:       "k": [0, 0, 0]            // DO NOT add a z component
  Scale:        "k": [100, 100, 100]      // DO NOT add a z component
  Keyframe s/e: "s": [256, 128, 0]        // DO NOT add a z component

This applies to EVERY property on EVERY layer including layer ks.p, ks.a, ks.s,
and all shape group transform (tr) properties.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: REQUIRED LAYER FIELDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every layer object MUST have ALL of these fields. Missing any will REJECT your output:

{
  "ty":  4,          // layer type (4 = Shape)
  "nm":  "MyLayer",  // descriptive name
  "ind": 1,          // unique integer index, 1-based
  "ip":  0,          // layer in-point (frame), usually 0
  "op":  <op>,       // layer out-point (frame), must equal the root op
  "st":  0,          // ← REQUIRED start time offset (ALWAYS 0 unless intentionally delayed)
  "ks":  { ... },    // transform keyframes
  "shapes": [ ... ]  // for shape layers
}

The "st" field is NOT optional. Every single layer must have "st": 0.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY GUIDELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. DIMENSIONS & TIMING
   - Default: 512 × 512 px, 30 fps. Use 60 fps only for fast/smooth motion.
   - Keep duration between 1 s and 8 s unless the prompt explicitly asks for longer.
   - Align op exactly: op = Math.round(fr * duration).

2. LAYER STRUCTURE
   - Use Shape Layers (ty: 4) for vector graphics — most portable and Remotion-friendly.
   - Use Null Layers (ty: 3) as parent controllers; attach child layers via the \`parent\` field.
   - Avoid Image Layers (ty: 2) unless the prompt explicitly requires bitmap imagery.
   - Give every layer a unique \`ind\` (integer, 1-based) and a descriptive \`nm\`.

3. ANIMATION PRINCIPLES — MAKE IT FEEL ALIVE
   Apply at least one of the following to every animated property:
   a) Easing — use Bézier handles on keyframes. For natural ease-in-out:
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

   EASING ARRAY LENGTH RULE:
   The easing arrays i.x, i.y, o.x, o.y must have either:
   - 1 element (shared easing applied to all components), OR
   - Exactly as many elements as the value array (per-component easing).

5. COLOURS
   Lottie colours are normalised RGBA arrays in [0,1] range. Example: pure red = [1, 0, 0, 1].

6. SHAPES (Shape Layer items — \`it\` array)
   Common shape types:
   - \`el\` = Ellipse    { ty: "el", d: 1, p: {a,k}, s: {a,k} }
   - \`rc\` = Rectangle  { ty: "rc", d: 1, p: {a,k}, s: {a,k}, r: {a,k} }
   - \`sr\` = Polystar   { ty: "sr", d: 1, ... }
   - \`sh\` = Path       { ty: "sh", ks: { a, k: <BezierShape> } }
   - \`fl\` = Fill       { ty: "fl", c: {a,k}, o: {a,k} }
   - \`st\` = Stroke     { ty: "st", c: {a,k}, o: {a,k}, w: {a,k} }
   - \`tr\` = Transform  { ty: "tr", p, a, s, r, o, sk, sa }
   - \`gr\` = Group      { ty: "gr", it: [...shapes, transform] }

   Direction (d): All primitive shapes (el, rc, sr) MUST include a d: 1 property.

7. TRANSFORM BLOCK (tr) — required on every shape group
   CRITICAL: The \`tr\` object MUST be the VERY LAST element in the group's \`it\` array. If it is not the last item, the animation will crash.
   ALL values MUST be 2D (no z component):
   {
     "ty": "tr",
     "p":  { "a": 0, "k": [0, 0] },
     "a":  { "a": 0, "k": [0, 0] },
     "s":  { "a": 0, "k": [100, 100] },
     "r":  { "a": 0, "k": 0 },
     "o":  { "a": 0, "k": 100 },
     "sk": { "a": 0, "k": 0 },
     "sa": { "a": 0, "k": 0 }
   }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REMOTION-SPECIFIC RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Remotion renders Lottie frame-by-frame. Avoid expressions (\`Math.random()\`, \`loopOut()\`) or Audio layers (ty: 6).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EDITING AN EXISTING ANIMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If \`sourceLottie\` is not null:
  1. Parse it: \`const anim = JSON.parse(sourceLottie);\`
  2. Apply changes, FIX any 3D coordinate issues, and add missing "st" fields.
  3. Return the mutated \`anim\` object.

CRITICAL: Generate a valid Lottie animation that avoids expressions, uses standard shape layers, and renders cleanly frame-by-frame via SVG.
`;

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

            const validatedResult = await runCodeGenAgent<z.infer<typeof LottieSandboxResultSchema>>({
                agent,
                resultStore,
                prompt: userPrompt,
            });

            if (!validatedResult?.lottie) {
                return { success: false, error: "Agent failed to return a valid Lottie object." };
            }

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