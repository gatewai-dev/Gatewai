
import { TextNodeComponent } from './text';
import { LlmNodeComponent } from './llm';
import { GPTImage1NodeComponent } from './gpt-image';
import { BlurNodeComponent } from './blur';


// Node types mapping
const nodeTypes = {
  LLM: LlmNodeComponent,
  Text: TextNodeComponent,
  GPTImage1: GPTImage1NodeComponent,
  Blur: BlurNodeComponent,
};

// Export components
export {
  nodeTypes,
  LlmNodeComponent,
  TextNodeComponent,
  GPTImage1NodeComponent,
  BlurNodeComponent,
};