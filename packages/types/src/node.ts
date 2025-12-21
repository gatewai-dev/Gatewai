import type { Node, NodeTemplate, NodeType } from "@gatewai/db";
import type { AllNodeConfig } from "./filedata.js";
import type { FileData, NodeResult } from "./node-result.js";

export type NodeWithFileType<T extends AllNodeConfig, R extends NodeResult> = Node & {
  fileData: FileData | null;
  config: T;
  result: R;
  template: NodeTemplate & {
    inputTypes: { inputType: NodeType }[];
    outputTypes: { outputType: NodeType }[];
  };
}

