import { z, type ZodTypeAny } from "zod";
import { BlurNodeConfigSchema } from "./configs/blur.config.js";
import { CompositorNodeConfigSchema } from "./configs/compositor.config.js";
import { CropNodeConfigSchema } from "./configs/crop.config.js";
import { FileNodeConfigSchema } from "./configs/file.config.js";
import { ImageGenNodeConfigSchema } from "./configs/image-gen.config.js";
import { LLMNodeConfigSchema } from "./configs/llm.config.js";
import { MaskNodeConfigSchema } from "./configs/mask.config.js";
import { ModulateNodeConfigSchema } from "./configs/modulate.config.js";
import { NoteNodeConfigSchema } from "./configs/note.config.js";
import { PaintNodeConfigSchema } from "./configs/paint.config.js";
import { PreviewNodeConfigSchema } from "./configs/preview.config.js";
import { ResizeNodeConfigSchema } from "./configs/resize.config.js";
import { SpeechToTextNodeConfigSchema } from "./configs/speech-to-text.config.js";
import { TextMergerNodeConfigSchema } from "./configs/text-merger.config.js";
import { TextNodeConfigSchema } from "./configs/text.config.js";
import { TextToSpeechNodeConfigSchema } from "./configs/text-to-speech.config.js";
import { VideoCompositorNodeConfigSchema } from "./configs/video-compositor.config.js";
import { VideoGenExtendNodeConfigSchema } from "./configs/video-gen-extend.config.js";
import { VideoGenFirstLastFrameNodeConfigSchema } from "./configs/video-gen-first-last-frame.config.js";
import { VideoGenNodeConfigSchema } from "./configs/video-gen.config.js";

export const NodeConfigSchema: ZodTypeAny = z.union([
    TextNodeConfigSchema,
    TextMergerNodeConfigSchema,
    FileNodeConfigSchema,
    ImageGenNodeConfigSchema,
    PreviewNodeConfigSchema,
    MaskNodeConfigSchema,
    PaintNodeConfigSchema,
    BlurNodeConfigSchema,
    ModulateNodeConfigSchema,
    NoteNodeConfigSchema,
    CropNodeConfigSchema,
    CompositorNodeConfigSchema,
    LLMNodeConfigSchema,
    ResizeNodeConfigSchema,
    VideoGenNodeConfigSchema,
    VideoGenExtendNodeConfigSchema,
    VideoGenFirstLastFrameNodeConfigSchema,
    SpeechToTextNodeConfigSchema,
    TextToSpeechNodeConfigSchema,
    VideoCompositorNodeConfigSchema,
]);

export {
    BlurNodeConfigSchema,
    CompositorNodeConfigSchema,
    CropNodeConfigSchema,
    FileNodeConfigSchema,
    ImageGenNodeConfigSchema,
    LLMNodeConfigSchema,
    MaskNodeConfigSchema,
    ModulateNodeConfigSchema,
    NoteNodeConfigSchema,
    PaintNodeConfigSchema,
    PreviewNodeConfigSchema,
    ResizeNodeConfigSchema,
    SpeechToTextNodeConfigSchema,
    TextMergerNodeConfigSchema,
    TextNodeConfigSchema,
    TextToSpeechNodeConfigSchema,
    VideoCompositorNodeConfigSchema,
    VideoGenExtendNodeConfigSchema,
    VideoGenFirstLastFrameNodeConfigSchema,
    VideoGenNodeConfigSchema,
};
