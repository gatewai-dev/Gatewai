import type { HandleEntityType } from "@gatewai/react-store";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import type { CompositorNodeConfig, OutputItem } from "@gatewai/types";
import { memo, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useParams } from "react-router";
import { ImageDesignerEditor } from "@/modules/canvas-editor";
import { useCanvasCtx } from "../../../ctx/canvas-ctx";
import { useNodeResult } from "../../../graph-engine/processor-ctx";

const CompositorView = memo(() => {
	const nav = useNavigate();
	const { nodeId, canvasId } = useParams();
	if (!nodeId) {
		throw new Error("Node Id is missing");
	}
	const node = useAppSelector(makeSelectNodeById(nodeId));
	const { inputs, isProcessed } = useNodeResult(nodeId);
	const { onNodeConfigUpdate, moveViewportToNode } = useCanvasCtx();
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

	const closeAndFocusOnNode = () => {
		nav(`/canvas/${canvasId}`);
		setTimeout(() => {
			moveViewportToNode(node.id);
			// Wait a bit so that reactflow renders
		}, 500);
	};

	const onSave = (config: CompositorNodeConfig) => {
		onNodeConfigUpdate({ id: node.id, newConfig: config });
		if (!canvasId) {
			throw new Error("Canvas id is missing in parameters");
		}
		closeAndFocusOnNode();
	};

	return (
		<div className="inset-0 h-screen w-screen">
			<Helmet>
				<title>Designer - Gatewai</title>
			</Helmet>
			{node && isProcessed && (
				<ImageDesignerEditor
					onClose={() => closeAndFocusOnNode()}
					onSave={onSave}
					initialLayers={initialLayers}
					node={node}
				/>
			)}
		</div>
	);
});

export { CompositorView };
