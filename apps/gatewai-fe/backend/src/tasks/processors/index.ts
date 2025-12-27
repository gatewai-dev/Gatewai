import { NodeType } from "@gatewai/db";
import blurProcessor from './blur.js';
import type { NodeProcessor } from "./types.js";
import resizeProcessor from "./resize.js";
import llmProcessor from "./llm.js";
import imageGenProcessor from "./image-gen.js";


const nodeProcessors: Partial<Record<NodeType, NodeProcessor>> = {
  [NodeType.Blur]: blurProcessor,
  [NodeType.Resize]: resizeProcessor,
  [NodeType.LLM]: llmProcessor,
  [NodeType.ImageGen]: imageGenProcessor,
  // No processing needed for these node types
  [NodeType.File]: async ({ node }) => {
    return { success: true, result: node.result };
  },
  [NodeType.Text]: async ({ node }) => {
    return { success: true, result: node.result };
  },
};

export { nodeProcessors }