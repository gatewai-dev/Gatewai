import type { OutputItem, VideoCompositorNodeConfig } from "@gatewai/types";
import { memo, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { useAppSelector } from "@/store";
import type { HandleEntityType } from "@/store/handles";
import { makeSelectNodeById } from "@/store/nodes";
import { useCanvasCtx } from "../../../routes/canvas/details/ctx/canvas-ctx";
import { useNodeResult } from "../../../routes/canvas/details/processor/processor-ctx";
import { VideoDesignerEditor } from "../video-editor";

type InputOutputItems =
	| OutputItem<"Text">
	| OutputItem<"Image">
	| OutputItem<"Video">
	| OutputItem<"Audio">;

const VideoCompositorView = memo(() => {
	const nav = useNavigate();
	const { nodeId, canvasId } = useParams();
	if (!nodeId) {
		throw new Error("Node Id is missing");
	}
	const node = useAppSelector(makeSelectNodeById(nodeId));
	const { inputs } = useNodeResult(nodeId);
	const { onNodeConfigUpdate, moveViewportToNode } = useCanvasCtx();
	const initialLayers = useMemo(() => {
		const items = new Map<HandleEntityType["id"], InputOutputItems>();

		for (const key of Object.keys(inputs)) {
			const value = inputs[key];
			const handleId = key;
			if (value.outputItem) {
				items.set(handleId, value.outputItem as InputOutputItems);
			}
		}
		return items;
	}, [inputs]);

	const closeAndFocusOnNode = () => {
		nav(`/canvas/${canvasId}`);
		setTimeout(() => {
			moveViewportToNode(node.id);
		}, 500);
	};

	const onSave = (config: VideoCompositorNodeConfig) => {
		onNodeConfigUpdate({ id: node.id, newConfig: config });
		if (!canvasId) {
			throw new Error("Canvas id is missing in parameters");
		}
		closeAndFocusOnNode();
	};
	return (
		<div className="inset-0 h-screen w-screen">
			{node && (
				<VideoDesignerEditor
					onClose={() => closeAndFocusOnNode()}
					onSave={onSave}
					initialLayers={initialLayers}
					node={node}
				/>
			)}
		</div>
	);
});

export { VideoCompositorView };
