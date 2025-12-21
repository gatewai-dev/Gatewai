import type { Node, NodeTemplate, NodeType } from "@gatewai/db";
import type { FileData, NodeData } from "./filedata.js";

export type NodeWithFileType<T extends NodeData> = Node & {
  fileData: FileData | null;
  data: T;
  template: NodeTemplate & {
    inputTypes: { inputType: NodeType }[];
    outputTypes: { outputType: NodeType }[];
  };
}

