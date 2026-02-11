// types.ts
import type { z } from "zod";

import type {
	BlurNodeConfigSchema,
	CompositorLayerSchema,
	CompositorNodeConfigSchema,
	CropNodeConfigSchema,
	FileNodeConfigSchema,
	GlobalCompositeOperation,
	ImageGenNodeConfigSchema,
	LLMNodeConfigSchema,
	MaskNodeConfigSchema,
	ModulateNodeConfigSchema,
	NodeConfigSchema,
	NoteNodeConfigSchema,
	PaintNodeConfigSchema,
	PreviewNodeConfigSchema,
	ResizeNodeConfigSchema,
	SpeechToTextNodeConfigSchema,
	TextMergerNodeConfigSchema,
	TextNodeConfigSchema,
	TextToSpeechNodeConfigSchema,
	VideoCompositorLayerSchema,
	VideoCompositorNodeConfigSchema,
	VideoGenExtendNodeConfigSchema,
	VideoGenFirstLastFrameNodeConfigSchema,
	VideoGenNodeConfigSchema,
} from "./schemas.js";

// Extract the TypeScript type from the schema
export type GlobalCompositeOperationType = z.infer<
	typeof GlobalCompositeOperation
>;

export type TextNodeConfig = z.infer<typeof TextNodeConfigSchema>;
export type TextMergerNodeConfig = z.infer<typeof TextMergerNodeConfigSchema>;
export type FileNodeConfig = z.infer<typeof FileNodeConfigSchema>;
export type ImageGenConfig = z.infer<typeof ImageGenNodeConfigSchema>;
export type PreviewNodeConfig = z.infer<typeof PreviewNodeConfigSchema>;
export type MaskNodeConfig = z.infer<typeof MaskNodeConfigSchema>;
export type PaintNodeConfig = z.infer<typeof PaintNodeConfigSchema>;
export type BlurNodeConfig = z.infer<typeof BlurNodeConfigSchema>;
export type ModulateNodeConfig = z.infer<typeof ModulateNodeConfigSchema>;
export type NoteNodeConfig = z.infer<typeof NoteNodeConfigSchema>;
export type CropNodeConfig = z.infer<typeof CropNodeConfigSchema>;
export type CompositorNodeConfig = z.infer<typeof CompositorNodeConfigSchema>;
export type CompositorLayer = z.infer<typeof CompositorLayerSchema>;
export type LLMNodeConfig = z.infer<typeof LLMNodeConfigSchema>;
export type ResizeNodeConfig = z.infer<typeof ResizeNodeConfigSchema>;
export type VideoGenNodeConfig = z.infer<typeof VideoGenNodeConfigSchema>;
export type VideoGenExtendNodeConfig = z.infer<
	typeof VideoGenExtendNodeConfigSchema
>;
export type VideoGenFirstLastFrameNodeConfig = z.infer<
	typeof VideoGenFirstLastFrameNodeConfigSchema
>;
export type SpeechToTextNodeConfig = z.infer<
	typeof SpeechToTextNodeConfigSchema
>;
export type TextToSpeechNodeConfig = z.infer<
	typeof TextToSpeechNodeConfigSchema
>;
export type VideoCompositorNodeConfig = z.infer<
	typeof VideoCompositorNodeConfigSchema
>;
export type VideoCompositorLayer = z.infer<typeof VideoCompositorLayerSchema>;

// Union Type for All Node Configs
export type AllNodeConfig = z.infer<typeof NodeConfigSchema>;
