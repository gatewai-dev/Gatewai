import type { Node, NodeTemplate } from "@gatewai/db";
import type { AllNodeConfig } from "./config/index.js";
import type { FileData, NodeResult } from "./node-result.js";

export type NodeWithFileType<
	T extends AllNodeConfig,
	R extends NodeResult | null,
> = Node & {
	fileData: FileData | null;
	config: T;
	result: R;
	template: NodeTemplate;
};
