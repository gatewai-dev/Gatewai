
import { TextNodeComponent } from './text';
import { LlmNodeComponent } from './llm';
import { ImageGenNodeComponent } from './image-gen';
import { BlurNodeComponent } from './blur';
import { FileNodeComponent } from './file';
import { ResizeNodeComponent } from './resize';
import { AgentNodeComponent } from './agent';


// Node types mapping
const nodeTypes = {
  LLM: LlmNodeComponent,
  Text: TextNodeComponent,
  ImageGen: ImageGenNodeComponent,
  Blur: BlurNodeComponent,
  Resize: ResizeNodeComponent,
  File: FileNodeComponent,
  Agent: AgentNodeComponent,
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