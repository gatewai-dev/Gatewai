import type { BlurNodeConfig } from "./configs/blur.config.js";
import type {
	CompositorLayer,
	CompositorNodeConfig,
} from "./configs/compositor.config.js";
import type { CropNodeConfig } from "./configs/crop.config.js";
import type { FileNodeConfig } from "./configs/file.config.js";
import type { ImageGenNodeConfig } from "./configs/image-gen.config.js";
import type { LLMNodeConfig } from "./configs/llm.config.js";
import type { MaskNodeConfig } from "./configs/mask.config.js";
import type { ModulateNodeConfig } from "./configs/modulate.config.js";
import type { NoteNodeConfig } from "./configs/note.config.js";
import type { PaintNodeConfig } from "./configs/paint.config.js";
import type { PreviewNodeConfig } from "./configs/preview.config.js";
import type { ResizeNodeConfig } from "./configs/resize.config.js";
import type { SpeechToTextNodeConfig } from "./configs/speech-to-text.config.js";
import type { TextNodeConfig } from "./configs/text.config.js";
import type { TextMergerNodeConfig } from "./configs/text-merger.config.js";
import type { TextToSpeechNodeConfig } from "./configs/text-to-speech.config.js";
import type {
	VideoCompositorLayer,
	VideoCompositorNodeConfig,
} from "./configs/video-compositor.config.js";
import type { VideoGenNodeConfig } from "./configs/video-gen.config.js";
import type { VideoGenExtendNodeConfig } from "./configs/video-gen-extend.config.js";
import type { VideoGenFirstLastFrameNodeConfig } from "./configs/video-gen-first-last-frame.config.js";

export type {
	BlurNodeConfig,
	CompositorLayer,
	CompositorNodeConfig,
	CropNodeConfig,
	FileNodeConfig,
	ImageGenNodeConfig,
	LLMNodeConfig,
	MaskNodeConfig,
	ModulateNodeConfig,
	NoteNodeConfig,
	PaintNodeConfig,
	PreviewNodeConfig,
	ResizeNodeConfig,
	SpeechToTextNodeConfig,
	TextMergerNodeConfig,
	TextNodeConfig,
	TextToSpeechNodeConfig,
	VideoCompositorLayer,
	VideoCompositorNodeConfig,
	VideoGenExtendNodeConfig,
	VideoGenFirstLastFrameNodeConfig,
	VideoGenNodeConfig,
};

export type AllNodeConfig =
	| TextNodeConfig
	| TextMergerNodeConfig
	| FileNodeConfig
	| ImageGenNodeConfig
	| PreviewNodeConfig
	| MaskNodeConfig
	| PaintNodeConfig
	| BlurNodeConfig
	| ModulateNodeConfig
	| NoteNodeConfig
	| CropNodeConfig
	| CompositorNodeConfig
	| LLMNodeConfig
	| ResizeNodeConfig
	| VideoGenNodeConfig
	| VideoGenExtendNodeConfig
	| VideoGenFirstLastFrameNodeConfig
	| SpeechToTextNodeConfig
	| TextToSpeechNodeConfig
	| VideoCompositorNodeConfig;
