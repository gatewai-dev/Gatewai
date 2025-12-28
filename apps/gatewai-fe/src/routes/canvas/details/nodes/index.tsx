
import { TextNodeComponent } from './text';
import { LlmNodeComponent } from './llm';
import { ImageGenNodeComponent } from './image-gen';
import { BlurNodeComponent } from './blur';
import { FileNodeComponent } from './file';
import { ResizeNodeComponent } from './resize';
import { AgentNodeComponent } from './agent';
import { CropNodeComponent } from './crop';
import { PaintNodeComponent } from './paint';


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