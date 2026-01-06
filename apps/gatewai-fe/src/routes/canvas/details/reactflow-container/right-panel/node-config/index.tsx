import type { NodeType } from "@gatewai/db";
import { Panel } from "@xyflow/react";
import { Fragment, memo, type ReactNode, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
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
		<div className="flex flex-col gap-4" key={`${node.id}_cfg_component`}>
			<div className="flex items-center gap-2">
				<Icon />
				<h3 className="text-sm font-semibold">{node.name}</h3>
			</div>
			<ConfigComponent key={node.id} node={node} />
		</div>
	);
});

const NodesWithConfigForm = Object.keys(NodeConfigFormMap);
const NodeConfigPanel = memo(() => {
	const selectedNodes = useAppSelector(selectSelectedNodes);

	const isVisible = useMemo(() => {
		return (
			selectedNodes &&
			selectedNodes.length > 0 &&
			selectedNodes.some((n) => NodesWithConfigForm.includes(n.type))
		);
	}, [selectedNodes]);

	return (
		<Panel position="top-right" className="m-0! h-full pointer-events-none">
			<div
				className={cn(
					// Base Styles
					"h-full w-80 bg-background border-l shadow-2xl p-4 overflow-y-auto pointer-events-auto",
					// Animation Styles
					"transition-all duration-500 ease-in-out transform",
					// Toggle States
					isVisible
						? "translate-x-0 opacity-100"
						: "translate-x-full opacity-0",
				)}
			>
				<div className="flex flex-col">
					{/* We only map if visible to prevent unnecessary renders while hidden */}
					{isVisible &&
						selectedNodes?.map((node) => (
							<Fragment key={`${node.id}_cfg_section`}>
								<NodeConfigItem node={node} />
								<Separator className="my-5" />
							</Fragment>
						))}
				</div>
			</div>
		</Panel>
	);
});

export { NodeConfigPanel };
