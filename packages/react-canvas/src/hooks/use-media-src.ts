import { GetAssetEndpoint } from "@gatewai/core/browser";
// Removed NodeResult
import { useNodeResult } from "@gatewai/react-canvas";
import type { NodeEntityType } from "@gatewai/react-store";
import { useMemo } from "react";

type MediaTypes = "Image" | "Video" | "Audio";

function useMediaInputSrc(nodeId: NodeEntityType["id"], type: MediaTypes) {
	const { result } = useNodeResult(nodeId);

	const mediaOutputItem = useMemo(() => {
		const nodeResult = result;
		const outputItem = nodeResult?.outputs?.[nodeResult.selectedOutputIndex];
		if (outputItem) {
			return outputItem.items.find((f: any) => f.type === type)?.data;
		}
		return null;
	}, [result, type]);
	if (
		!mediaOutputItem ||
		typeof mediaOutputItem !== "object" ||
		!("entity" in mediaOutputItem)
	) {
		return null;
	}
	const mediaSrc = mediaOutputItem?.entity
		? GetAssetEndpoint(mediaOutputItem?.entity)
		: null;

	return mediaSrc;
}

export { useMediaInputSrc };
