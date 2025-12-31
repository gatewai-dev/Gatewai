import { AgentNodeComponent } from "./agent";
import { BlurNodeComponent } from "./blur";
import { CropNodeComponent } from "./crop";
import { FileNodeComponent } from "./file";
import { ImageGenNodeComponent } from "./image-gen";
import { LlmNodeComponent } from "./llm";
import { PaintNodeComponent } from "./paint";
import { PreviewNodeComponent } from "./preview";
import { ResizeNodeComponent } from "./resize";
import { NoteNodeComponent } from "./sticky-note";
import { TextNodeComponent } from "./text";

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
};

// Export components
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
};
