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
	Modulate: ModulateNodeComponent,
	Export: ExportNodeComponent,
	Compositor: CompositorNodeComponent,
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
	ModulateNodeComponent,
	ExportNodeComponent,
	CompositorNodeComponent,
};
