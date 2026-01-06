import type { NodeType } from "@gatewai/db";
import { Panel } from "@xyflow/react";
import { memo, type ReactNode, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/store";
import { type NodeEntityType, selectSelectedNodes } from "@/store/nodes";
import { NODE_ICON_MAP } from "../../../node-templates/node-palette/icon-map";
import { ImageGenNodeConfigComponent } from "./image-gen";
import { LLMNodeConfigComponent } from "./llm/llm-config";
import { SpeechToTextNodeConfigComponent } from "./speec-to-text";
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
	SpeechToText: SpeechToTextNodeConfigComponent,
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

const NodesWithConfigForm = Object.keys(NodeConfigFormMap);
const NodeConfigPanel = memo(() => {
	const selectedNodes = useAppSelector(selectSelectedNodes);
	if (
		!selectedNodes ||
		selectedNodes.length === 0 ||
		!selectedNodes.some((n) => NodesWithConfigForm.includes(n.type))
	) {
		return null;
	}

	return (
		<Panel
			position="bottom-right"
			className="bg-background right-0 top-0 m-0! flex flex-col max-w-96"
		>
			<div className="border-0 bg-background p-4 rounded-md shadow-md flex flex-col justify-between grow">
				<div>
					<div className="space-y-4">
						{selectedNodes.map((node) => (
							<NodeConfigItem key={node.id} node={node} />
						))}
					</div>
				</div>
			</div>
		</Panel>
	);
});

export { NodeConfigPanel };
