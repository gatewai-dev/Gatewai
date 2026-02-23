import { GetAssetEndpoint } from "@gatewai/core/browser";
import type { FileData, NodeResult } from "@gatewai/core/types";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	getActiveVideoMetadata,
	resolveVideoSourceUrl,
} from "@gatewai/remotion-compositions";
import { FileIcon } from "lucide-react";
import { useMemo } from "react";
import { MediaDimensions, OutputSelector } from "../../components";
import { AudioRenderer } from "./audio-renderer";
import { CanvasRenderer } from "./canvas-renderer";
import { MediaPlayer } from "./remotion-player";
import { VideoRenderer } from "./video-renderer";

function MediaContent({
	node,
	result,
}: {
	node: NodeEntityType;
	result: NodeResult;
}) {
	const selectedOutput =
		result.outputs?.[
		Math.min(result.selectedOutputIndex, result.outputs.length - 1)
		];
	const outputItem = selectedOutput?.items?.[0];

	const isImage = outputItem?.type === "Image";
	const isVideo = outputItem?.type === "Video";
	const isAudio = outputItem?.type === "Audio";
	const isText = outputItem?.type === "Text";
	const isOther = !isImage && !isVideo && !isAudio && !isText;
	const hasMoreThanOneOutput = result.outputs.length > 1;
	const assetUrl = useMemo(() => {
		if (!outputItem?.data) return null;
		if (outputItem.type === "Video") {
			return resolveVideoSourceUrl(outputItem.data);
		}
		const fileData = outputItem.data as FileData;
		if (!fileData.entity) return null;
		return GetAssetEndpoint(fileData.entity);
	}, [outputItem]);
	console.log({ assetUrl, result });
	const activeMeta = useMemo(() => {
		if (outputItem?.type === "Video") {
			return getActiveVideoMetadata(outputItem.data);
		}
		return null;
	}, [outputItem]);

	const durationMs = useMemo(() => {
		if (!outputItem?.data) return undefined;
		if (outputItem.type === "Video") {
			return activeMeta?.durationMs;
		}
		const fileData = outputItem.data as FileData;
		return fileData?.entity?.duration ?? fileData?.processData?.duration;
	}, [outputItem, activeMeta]);

	const assetName = useMemo(() => {
		if (!outputItem?.data) return undefined;
		if (outputItem.type === "Video") {
			return outputItem.data.source?.entity?.name;
		}
		return (outputItem.data as FileData)?.entity?.name;
	}, [outputItem]);
	if (!outputItem) {
		return null;
	}

	return (
		<div className="relative h-full w-full group">
			{hasMoreThanOneOutput && (
				<div className="absolute top-1 left-1 z-10">
					<OutputSelector node={node} />
				</div>
			)}
			{isImage && assetUrl && <CanvasRenderer imageUrl={assetUrl} />}
			{isVideo && (
				<VideoRenderer
					src={assetUrl || undefined}
					virtualVideo={outputItem.data}
					durationMs={durationMs}
				/>
			)}
			{isAudio && assetUrl && (
				<AudioRenderer
					title={assetName}
					src={assetUrl}
					durationMs={durationMs}
				/>
			)}
			{isText && <MediaPlayer type="Text" data={outputItem.data} />}
			{isOther && (
				<div className="flex flex-col items-center gap-2">
					<FileIcon className="w-5 h-5" />{" "}
					<span>{(outputItem?.data as FileData)?.entity?.name}</span>
				</div>
			)}
			{node && (
				<div className="absolute bottom-1 left-1 z-10">
					<MediaDimensions node={node} />
				</div>
			)}
		</div>
	);
}

export { MediaContent };
