import type { Node, NodeTemplate, NodeType } from "@gatewai/db";
import type { NodeData } from "./filedata.js";
import type { FileData } from "./node-result.js";

export type NodeWithFileType<T extends NodeData> = Node & {
  fileData: FileData | null;
  data: T;
  template: NodeTemplate & {
    inputTypes: { inputType: NodeType }[];
    outputTypes: { outputType: NodeType }[];
  };
}

