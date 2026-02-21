import { memo } from "react";
import { MediaPlayer } from "../remotion-player";

const VideoRenderer = memo(
	({ src, durationMs }: { src: string; durationMs?: number }) => {
		return <MediaPlayer src={src} durationMs={durationMs} />;
	},
);

export { VideoRenderer };
