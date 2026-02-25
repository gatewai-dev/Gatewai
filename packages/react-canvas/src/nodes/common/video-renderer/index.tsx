import type { VirtualMediaData } from "@gatewai/core/types";
import type { ReactNode } from "react";
import { memo } from "react";
import { MediaPlayer } from "../remotion-player";

const VideoRenderer = memo(
	({
		durationMs,
		virtualMedia,
		controls,
		className,
		children,
		overlay,
	}: {
		durationMs?: number;
		virtualMedia?: VirtualMediaData;
		controls?: boolean;
		className?: string;
		children?: ReactNode;
		overlay?: ReactNode;
	}) => {
		return (
			<MediaPlayer
				virtualMedia={virtualMedia}
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
