import type { VideoGenResult } from "@gatewai/core/types";
import type { NodeEntityType } from "@gatewai/react-store";
import { useMemo } from "react";
import { GetAssetEndpoint } from "@gatewai/core/browser";
import { useNodeResult } from "@gatewai/react-canvas";

type MediaTypes = "Image" | "Video" | "Audio";

function useMediaInputSrc(nodeId: NodeEntityType["id"], type: MediaTypes) {
	const { result } = useNodeResult(nodeId);

	const videoOutputItem = useMemo(() => {
		const nodeResult = result as VideoGenResult;
		const outputItem = nodeResult?.outputs?.[nodeResult.selectedOutputIndex];
		if (outputItem) {
			return outputItem.items.find((f) => f.type === type)?.data;
		}
		return null;
	}, [result, type]);

	const videoSrc = videoOutputItem?.entity?.id
		? GetAssetEndpoint(videoOutputItem?.entity)
		: null;

	return videoSrc;
}

export { useMediaInputSrc };
