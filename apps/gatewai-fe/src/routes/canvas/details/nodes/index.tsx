
import { TextNodeComponent } from './text';
import { LlmNodeComponent } from './llm';
import { GPTImage1NodeComponent } from './gpt-image';
import { BlurNodeComponent } from './blur';
import { FileNodeComponent } from './file';
import { ResizeNodeComponent } from './resize';


// Node types mapping
const nodeTypes = {
  LLM: LlmNodeComponent,
  Text: TextNodeComponent,
  GPTImage1: GPTImage1NodeComponent,
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
  GPTImage1NodeComponent,
  BlurNodeComponent,
  FileNodeComponent,
};