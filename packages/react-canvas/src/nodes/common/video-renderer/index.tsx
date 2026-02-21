import type { VirtualVideoData } from "@gatewai/core/types";
import { memo } from "react";
import { MediaPlayer } from "../remotion-player";

const VideoRenderer = memo(
	({
		src,
		durationMs,
		virtualVideo,
		controls,
		className,
	}: {
		src?: string;
		durationMs?: number;
		virtualVideo?: VirtualVideoData;
		controls?: boolean;
		className?: string;
	}) => {
		return (
			<MediaPlayer
				src={src}
				virtualVideo={virtualVideo}
				type="Video"
				controls={controls}
				durationMs={durationMs}
				className={className}
			/>
		);
	},
);

export { VideoRenderer };
