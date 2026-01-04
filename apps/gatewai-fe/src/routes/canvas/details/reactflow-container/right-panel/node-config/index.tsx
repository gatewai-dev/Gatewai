import type { NodeType } from "@gatewai/db";
import { memo, type ReactNode } from "react";
import { useAppSelector } from "@/store";
import { type NodeEntityType, selectSelectedNodes } from "@/store/nodes";
import { ImageGenNodeConfigComponent } from "./image-gen";
import { LLMNodeConfigComponent } from "./llm/llm-config";
import { VideoGenNodeConfigComponent } from "./video-gen";
import { VideoGenExtendNodeConfigComponent } from "./video-gen-extend";
import { VideoGenFirstLastFrameNodeConfigComponent } from "./video-gen-first-last-frame";

type NodeConfigComponentProps = {
	node: NodeEntityType;
};

const NodeConfigFormMap: Partial<
	Record<NodeType, (props: NodeConfigComponentProps) => ReactNode>
> = {
	LLM: LLMNodeConfigComponent,
	ImageGen: ImageGenNodeConfigComponent,
	VideoGen: VideoGenNodeConfigComponent,
	VideoGenExtend: VideoGenExtendNodeConfigComponent,
	VideoGenFirstLastFrame: VideoGenFirstLastFrameNodeConfigComponent,
};

const NodeConfigPanel = memo(() => {
	const selectedNodes = useAppSelector(selectSelectedNodes);
	if (!selectedNodes || selectedNodes.length === 0) {
		return null;
	}

	return (
		<div className="space-y-4">
			{selectedNodes.map((node) => {
				const ConfigComponent = NodeConfigFormMap[node.type] as
					| ((props: NodeConfigComponentProps) => ReactNode)
					| undefined;
				if (!ConfigComponent) {
					return null;
				}
				return <ConfigComponent key={node.id} node={node} />;
			})}
		</div>
	);
});

export { NodeConfigPanel };
