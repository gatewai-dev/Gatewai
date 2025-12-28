import type { NodeWithFileType, NodeData } from "@gatewai/types";
import type { ReactNode } from "react";

export type NodeComponentProps<T extends NodeData> = {
	node: NodeWithFileType<T>;
};

export type BaseNodeComponentProps<T extends NodeData> =
	NodeComponentProps<T> & {
		children: ReactNode;
	};
