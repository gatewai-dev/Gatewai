import { AgentNodeComponent } from "./agent";
import { BlurNodeComponent } from "./blur";
import { CompositorNodeComponent } from "./compose";
import { CropNodeComponent } from "./crop";
import { ExportNodeComponent } from "./export";
import { FileNodeComponent } from "./file";
import { ImageGenNodeComponent } from "./image-gen";
import { LlmNodeComponent } from "./llm";
import { ModulateNodeComponent } from "./modulate";
import { PaintNodeComponent } from "./paint";
import { PreviewNodeComponent } from "./preview";
import { ResizeNodeComponent } from "./resize";
import { SpeechToTextNodeComponent } from "./speech-to-text";
import { NoteNodeComponent } from "./sticky-note";
import { TextNodeComponent } from "./text";
import { TextToSpeechNodeComponent } from "./text-to-speech";
import { VideoGenNodeComponent } from "./video-gen";
import { VideoGenExtendNodeComponent } from "./video-gen-extend";
import { VideoGenFirstLastFrameNodeComponent } from "./video-gen-first-last-frame";

// Node types mapping
const nodeTypes = {
	LLM: LlmNodeComponent,
	Text: TextNodeComponent,
	ImageGen: ImageGenNodeComponent,
	Blur: BlurNodeComponent,
	Resize: ResizeNodeComponent,
	File: FileNodeComponent,
	Agent: AgentNodeComponent,
	Crop: CropNodeComponent,
	Paint: PaintNodeComponent,
	Note: NoteNodeComponent,
	Preview: PreviewNodeComponent,
	Modulate: ModulateNodeComponent,
	Export: ExportNodeComponent,
	Compositor: CompositorNodeComponent,
	VideoGen: VideoGenNodeComponent,
	VideoGenExtend: VideoGenExtendNodeComponent,
	VideoGenFirstLastFrame: VideoGenFirstLastFrameNodeComponent,
	SpeechToText: SpeechToTextNodeComponent,
	TextToSpeech: TextToSpeechNodeComponent,
};

export {
	nodeTypes,
	LlmNodeComponent,
	TextNodeComponent,
	ResizeNodeComponent,
	ImageGenNodeComponent,
	NoteNodeComponent,
	BlurNodeComponent,
	CropNodeComponent,
	FileNodeComponent,
	PaintNodeComponent,
	PreviewNodeComponent,
	ModulateNodeComponent,
	ExportNodeComponent,
	CompositorNodeComponent,
	VideoGenNodeComponent,
	VideoGenExtendNodeComponent,
	VideoGenFirstLastFrameNodeComponent,
	SpeechToTextNodeComponent,
	TextToSpeechNodeComponent,
};
