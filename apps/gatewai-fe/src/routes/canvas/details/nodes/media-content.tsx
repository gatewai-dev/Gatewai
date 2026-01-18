import type { FileResult, ImagesResult, VideoGenResult } from "@gatewai/types";
import { FileIcon } from "lucide-react";
import { useMemo } from "react";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint } from "@/utils/file";
import { MediaDimensions } from "../misc/media-dimensions";
import { OutputSelector } from "../misc/output-selector";
import { AudioRenderer } from "./common/audio-renderer";
import { CanvasRenderer } from "./common/canvas-renderer";
import { VideoRenderer } from "./common/video-renderer";

function MediaContent({
	node,
	result,
}: {
	node: NodeEntityType;
	result: ImagesResult | FileResult | VideoGenResult;
}) {
	const selectedOutput = result.outputs[result.selectedOutputIndex];
	const outputItem = selectedOutput.items[0];
	const isImage = outputItem.data.entity?.mimeType.startsWith("image");
	const isVideo = outputItem.data.entity?.mimeType.startsWith("video");
	const isAudio = outputItem.data.entity?.mimeType.startsWith("audio");
	const isOther = !isImage && !isVideo && !isAudio;
	const hasMoreThanOneOutput = result.outputs.length > 1;

	const assetUrl = useMemo(() => {
		if (!outputItem.data.entity?.id) return null;
		return GetAssetEndpoint(outputItem.data.entity);
	}, [outputItem.data.entity]);

	const assetName = useMemo(() => {
		return outputItem.data.entity?.name;
	}, [outputItem.data.entity]);
	console.log(outputItem.data.entity?.name);
	return (
		<div className="relative h-full w-full group">
			{hasMoreThanOneOutput && (
				<div className="absolute top-1 left-1 z-10">
					<OutputSelector node={node} />
				</div>
			)}
			{isImage && assetUrl && <CanvasRenderer imageUrl={assetUrl} />}
			{isVideo && assetUrl && <VideoRenderer src={assetUrl} />}
			{isAudio && assetUrl && (
				<AudioRenderer title={assetName} src={assetUrl} />
			)}
			{isOther && (
				<div className="flex flex-col items-center gap-2">
					<FileIcon className="w-5 h-5" />{" "}
					<span>{outputItem.data.entity?.name}</span>
				</div>
			)}
			<div className="absolute bottom-1 left-1 z-10">
				<MediaDimensions node={node} />
			</div>
		</div>
	);
}

export { MediaContent };
