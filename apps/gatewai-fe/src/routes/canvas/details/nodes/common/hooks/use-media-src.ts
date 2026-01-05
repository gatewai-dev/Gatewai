import type { VideoGenResult } from "@gatewai/types";
import { useMemo } from "react";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint } from "@/utils/file";
import { useNodeResult } from "../../../processor/processor-ctx";

type MediaTypes = "Image" | "Video" | "Audio";

function useMediaInputSrc(nodeId: NodeEntityType["id"], type: MediaTypes) {
	const { result } = useNodeResult(nodeId);

	const videoOutputItem = useMemo(() => {
		const nodeResult = result as VideoGenResult;
		const outputItem = nodeResult?.outputs[nodeResult.selectedOutputIndex];
		if (outputItem) {
			return outputItem.items.find((f) => f.type === type)?.data;
		}
		return null;
	}, [result, type]);

	const videoSrc = videoOutputItem?.entity?.id
		? GetAssetEndpoint(videoOutputItem?.entity?.id)
		: null;

	return videoSrc;
}

export { useMediaInputSrc };
