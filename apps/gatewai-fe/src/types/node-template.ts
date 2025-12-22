import type { NodeTemplate, NodeTemplateInput, NodeTemplateOutput } from "@gatewai/types";

export type NodeTemplateWithIO = NodeTemplate & {
  inputTypes: NodeTemplateInput[];
  outputTypes: NodeTemplateOutput[];
}