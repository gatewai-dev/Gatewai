import type { NodeType } from "@gatewai/db";
import { memo, type ReactNode, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/store";
import { type NodeEntityType, selectSelectedNodes } from "@/store/nodes";
import { NODE_ICON_MAP } from "../../../node-templates/node-palette/icon-map";
import { ImageGenNodeConfigComponent } from "./image-gen";
import { LLMNodeConfigComponent } from "./llm/llm-config";
import { TextToSpeechNodeConfigComponent } from "./text-to-speech";
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
	TextToSpeech: TextToSpeechNodeConfigComponent,
};

const NodeConfigItem = memo(({ node }: NodeConfigComponentProps) => {
	const ConfigComponent = useMemo(() => {
		return NodeConfigFormMap[node.type] as
			| ((props: NodeConfigComponentProps) => ReactNode)
			| undefined;
	}, [node.type]);
	if (!ConfigComponent) {
		return null;
	}
	const Icon = NODE_ICON_MAP[node?.type]?.(node) || NODE_ICON_MAP.File?.(node);
	return (
		<div className="flex flex-col" key={`${node.id}_cfg_component`}>
			<div className="flex items-center gap-2">
				<Icon />
				<h3 className="text-sm">{node.name}</h3>
			</div>
			<Separator className="my-2" />
			<ConfigComponent key={node.id} node={node} />
		</div>
	);
});

const NodeConfigPanel = memo(() => {
	const selectedNodes = useAppSelector(selectSelectedNodes);
	if (!selectedNodes || selectedNodes.length === 0) {
		return null;
	}

	return (
		<div className="space-y-4">
			{selectedNodes.map((node) => (
				<NodeConfigItem key={node.id} node={node} />
			))}
		</div>
	);
});

export { NodeConfigPanel };
