import type { VirtualVideoData } from "@gatewai/core/types";
import type { ReactNode } from "react";
import { memo } from "react";
import { MediaPlayer } from "../remotion-player";

const VideoRenderer = memo(
	({
		src,
		durationMs,
		virtualVideo,
		controls,
		className,
		children,
		overlay,
	}: {
		src?: string;
		durationMs?: number;
		virtualVideo?: VirtualVideoData;
		controls?: boolean;
		className?: string;
		children?: ReactNode;
		overlay?: ReactNode;
	}) => {
		return (
			<MediaPlayer
				src={src}
				virtualVideo={virtualVideo}
				type="Video"
				controls={controls}
				durationMs={durationMs}
				className={className}
				overlay={overlay}
			>
				{children}
			</MediaPlayer>
		);
	},
);

export { VideoRenderer };
