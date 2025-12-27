
import { TextNodeComponent } from './text';
import { LlmNodeComponent } from './llm';
import { ImageGenNodeComponent } from './image-gen';
import { BlurNodeComponent } from './blur';
import { FileNodeComponent } from './file';
import { ResizeNodeComponent } from './resize';


// Node types mapping
const nodeTypes = {
  LLM: LlmNodeComponent,
  Text: TextNodeComponent,
  ImageGen: ImageGenNodeComponent,
  Blur: BlurNodeComponent,
  Resize: ResizeNodeComponent,
  File: FileNodeComponent,
};

// Export components
export {
  nodeTypes,
  LlmNodeComponent,
  TextNodeComponent,
  ResizeNodeComponent,
  ImageGenNodeComponent,
  BlurNodeComponent,
  FileNodeComponent,
};