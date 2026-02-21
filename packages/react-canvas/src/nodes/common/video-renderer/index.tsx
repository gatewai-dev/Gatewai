import type { VirtualVideoData } from "@gatewai/core/types";
import { memo } from "react";
import { MediaPlayer } from "../remotion-player";

const VideoRenderer = memo(
	({
		src,
		durationMs,
		virtualVideo,
	}: {
		src?: string;
		durationMs?: number;
		virtualVideo?: VirtualVideoData;
	}) => {
		return (
			<MediaPlayer
				src={src}
				virtualVideo={virtualVideo}
				type="Video"
				durationMs={durationMs}
			/>
		);
	},
);

export { VideoRenderer };
