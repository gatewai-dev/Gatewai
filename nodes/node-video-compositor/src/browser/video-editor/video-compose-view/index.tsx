import type { OutputItem } from "@gatewai/core/types";
import { useCanvasCtx, useNodeResult } from "@gatewai/react-canvas";
import type { HandleEntityType } from "@gatewai/react-store";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { memo, useMemo } from "react";
import type { VideoCompositorNodeConfig } from "../../../shared/config.js";
import { VideoDesignerEditor } from "../video-editor/index.js";

type InputOutputItems =
	| OutputItem<"Text">
	| OutputItem<"Image">
	| OutputItem<"Video">
	| OutputItem<"Audio">;

const VideoCompositorView = memo(
	({
		nodeId,
		closeCallback,
	}: {
		nodeId: string;
		closeCallback: () => void;
	}) => {
		const node = useAppSelector(makeSelectNodeById(nodeId));
		const { inputs } = useNodeResult(nodeId);
		const { onNodeConfigUpdate } = useCanvasCtx();

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
			closeCallback();
		};

		const onSave = (config: VideoCompositorNodeConfig) => {
			onNodeConfigUpdate({ id: node.id, newConfig: config });
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
	},
);

export { VideoCompositorView };
