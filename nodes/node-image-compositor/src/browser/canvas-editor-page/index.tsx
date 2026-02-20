import type { OutputItem } from "@gatewai/core/types";
import { useCanvasCtx, useNodeResult } from "@gatewai/react-canvas";
import type { HandleEntityType } from "@gatewai/react-store";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { memo, useMemo } from "react";

import type { CompositorNodeConfig } from "@/shared/compositor.config.js";
import { ImageDesignerEditor } from "../canvas-editor/index.js";

const CompositorView = memo(
	({
		nodeId,
		closeCallback,
	}: {
		nodeId: string;
		closeCallback: () => void;
	}) => {
		const node = useAppSelector(makeSelectNodeById(nodeId));
		const { inputs, isProcessed } = useNodeResult(nodeId);
		const { onNodeConfigUpdate } = useCanvasCtx();
		const initialLayers = useMemo(() => {
			const items = new Map<
				HandleEntityType["id"],
				OutputItem<"Text"> | OutputItem<"Image">
			>();

			for (const key of Object.keys(inputs)) {
				const value = inputs[key];
				const handleId = key;
				if (value.outputItem) {
					items.set(
						handleId,
						value.outputItem as OutputItem<"Text"> | OutputItem<"Image">,
					);
				}
			}
			return items;
		}, [inputs]);

		const onSave = (config: CompositorNodeConfig) => {
			onNodeConfigUpdate({ id: node.id, newConfig: config });
			closeCallback();
		};

		return (
			<div className="inset-0 h-screen w-screen">
				{node && isProcessed && (
					<ImageDesignerEditor
						onClose={() => closeCallback()}
						onSave={onSave}
						initialLayers={initialLayers}
						node={node}
					/>
				)}
			</div>
		);
	},
);

export { CompositorView };
