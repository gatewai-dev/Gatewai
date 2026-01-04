import { memo } from "react";
import {
	CentralPlayButton,
	MediaShell,
	SharedControlBar,
} from "../media-chrome";

const VideoRenderer = memo(({ src }: { src: string }) => {
	return (
		<MediaShell>
			<video
				slot="media"
				src={src}
				preload="metadata"
				playsInline
				className="w-full h-full object-cover"
			/>
			<CentralPlayButton />
			<SharedControlBar />
		</MediaShell>
	);
});

export { VideoRenderer };
