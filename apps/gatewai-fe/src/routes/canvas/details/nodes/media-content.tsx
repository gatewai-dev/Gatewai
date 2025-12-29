import type { FileResult, ImagesResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { FileIcon } from "lucide-react";
import {
	MediaControlBar,
	MediaController,
	MediaMuteButton,
	MediaPlayButton,
	MediaTimeDisplay,
	MediaTimeRange,
	MediaVolumeRange,
} from "media-chrome/react";
import { GetAssetEndpoint } from "@/utils/file";
import { OutputSelector } from "./misc/output-selector";
import type { AnyNode } from "./node-props";

function MediaContent({
	node,
	result,
}: {
	node: NodeProps<AnyNode>;
	result: ImagesResult | FileResult;
}) {
	const selectedOutput = result.outputs[result.selectedOutputIndex];
	const outputItem = selectedOutput.items[0];
	const isImage = outputItem.data.entity?.mimeType.startsWith("image");
	const isVideo = outputItem.data.entity?.mimeType.startsWith("video");
	const isOther = !isVideo && !isImage;
	if (!outputItem.data.entity?.signedUrl) {
		return null;
	}
	const hasMoreThanOneOutput = result.outputs.length > 1;
	return (
		<div className="relative h-full w-full group">
			{hasMoreThanOneOutput && (
				<div className="absolute top-1 left-1 z-10">
					<OutputSelector node={node} />
				</div>
			)}
			{isImage && (
				<img
					src={GetAssetEndpoint(outputItem.data.entity.id)}
					alt={outputItem.data.entity.name}
					className="w-full h-full"
				/>
			)}
			{isVideo && (
				<div className="flex flex-col items-center gap-2">
					<MediaController>
						{/** biome-ignore lint/a11y/useMediaCaption: Unknown track */}
						<video
							slot="media"
							src={GetAssetEndpoint(outputItem.data.entity.id)}
							preload="auto"
						/>
						<MediaControlBar>
							<MediaPlayButton />
							<MediaTimeRange />
							<MediaTimeDisplay showDuration />
							<MediaMuteButton />
							<MediaVolumeRange />
						</MediaControlBar>
					</MediaController>
				</div>
			)}
			{isOther && (
				<div className="flex flex-col items-center gap-2">
					<FileIcon className="w-5 h-5" />{" "}
					<span>{outputItem.data.entity.name}</span>
				</div>
			)}
		</div>
	);
}

export { MediaContent };
