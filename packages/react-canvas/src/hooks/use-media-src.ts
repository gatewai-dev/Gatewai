import { GetAssetEndpoint } from "@gatewai/core/browser";
import type { VideoGenResult } from "@gatewai/core/types";
import { useNodeResult } from "@gatewai/react-canvas";
import type { NodeEntityType } from "@gatewai/react-store";
import { useMemo } from "react";

type MediaTypes = "Image" | "Video" | "Audio";

function useMediaInputSrc(nodeId: NodeEntityType["id"], type: MediaTypes) {
	const { result } = useNodeResult(nodeId);

	const mediaOutputItem = useMemo(() => {
		const nodeResult = result as VideoGenResult;
		const outputItem = nodeResult?.outputs?.[nodeResult.selectedOutputIndex];
		if (outputItem) {
			return outputItem.items.find((f) => f.type === type)?.data;
		}
		return null;
	}, [result, type]);

	const mediaSrc = mediaOutputItem?.entity
		? GetAssetEndpoint(mediaOutputItem?.entity)
		: null;

	return mediaSrc;
}

export { useMediaInputSrc };
