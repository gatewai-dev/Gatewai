import { memo } from "react";
import {
	CentralPlayButton,
	MediaShell,
	SharedControlBar,
} from "../media-chrome";

const VideoRenderer = memo(({ src }: { src: string }) => {
	return (
		<MediaShell>
			{/** biome-ignore lint/a11y/useMediaCaption: No caption exists */}
			<video
				slot="media"
				src={src}
				preload="metadata"
				playsInline
				className="w-full h-full bg-transparent"
			/>
			<CentralPlayButton />
			<SharedControlBar />
		</MediaShell>
	);
});

export { VideoRenderer };
