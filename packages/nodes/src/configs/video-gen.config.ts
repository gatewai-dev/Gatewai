import { z } from "zod";
import { DimensionSchema } from "../common/schemas.js";

export const VIDEOGEN_NODE_MODELS = [
    "veo-3.1-generate-preview",
    "veo-3.1-fast-generate-preview",
] as const;

export const VIDEOGEN_ASPECT_RATIOS = ["16:9", "9:16"] as const;

export const VIDEOGEN_RESOLUTIONS = ["720p", "1080p"] as const;

export const VIDEOGEN_DURATIONS = ["4", "6", "8"] as const;

export const VIDEOGEN_PERSON_GENERATION_OPTIONS = [
    "allow_all",
    "allow_adult",
    "dont_allow",
] as const;

// Base VideoGen Schema (shared across video gen variants to avoid repetition)
const VideoGenBaseSchema = z.object({
    model: z.enum(VIDEOGEN_NODE_MODELS),
    aspectRatio: z.enum(VIDEOGEN_ASPECT_RATIOS).default("16:9"),
    resolution: z.enum(VIDEOGEN_RESOLUTIONS).default("720p"),
    personGeneration: z
        .enum(VIDEOGEN_PERSON_GENERATION_OPTIONS)
        .default("allow_adult"),
});

export const VideoGenNodeConfigSchema = z
    .object({
        prompt: z.string().optional(),
        negativePrompt: z.string().optional(),
        width: DimensionSchema,
        height: DimensionSchema,
        aspectRatio: z.enum(VIDEOGEN_ASPECT_RATIOS).default("16:9"),
        resolution: z.enum(VIDEOGEN_RESOLUTIONS).default("720p"),
        durationSeconds: z.enum(VIDEOGEN_DURATIONS).default("6"),
        personGeneration: z
            .enum(VIDEOGEN_PERSON_GENERATION_OPTIONS)
            .default("allow_adult"),
        model: z.enum(VIDEOGEN_NODE_MODELS).default("veo-3.1-generate-preview"),
        fps: z.number().int().min(1).max(60).optional(),
    })
    .strict();

export type VideoGenNodeConfig = z.infer<typeof VideoGenNodeConfigSchema>;
