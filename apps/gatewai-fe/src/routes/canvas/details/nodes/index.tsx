import { AgentNodeComponent } from "./agent";
import { BlurNodeComponent } from "./blur";
import { CropNodeComponent } from "./crop";
import { FileNodeComponent } from "./file";
import { ImageGenNodeComponent } from "./image-gen";
import { LlmNodeComponent } from "./llm";
import { PaintNodeComponent } from "./paint";
import { ResizeNodeComponent } from "./resize";
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
};

// Export components
export {
	nodeTypes,
	LlmNodeComponent,
	TextNodeComponent,
	ResizeNodeComponent,
	ImageGenNodeComponent,
	BlurNodeComponent,
	CropNodeComponent,
	FileNodeComponent,
	PaintNodeComponent,
};
