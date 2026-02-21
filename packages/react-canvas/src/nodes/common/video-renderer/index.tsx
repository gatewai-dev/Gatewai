import type { VirtualVideoData } from "@gatewai/core/types";
import { memo } from "react";
import { MediaPlayer } from "../remotion-player";

const VideoRenderer = memo(
	({
		src,
		durationMs,
		virtualVideo,
		className,
	}: {
		src?: string;
		durationMs?: number;
		virtualVideo?: VirtualVideoData;
		className?: string;
	}) => {
		return (
			<MediaPlayer
				src={src}
				virtualVideo={virtualVideo}
				type="Video"
				durationMs={durationMs}
				className={className}
			/>
		);
	},
);

export { VideoRenderer };
