import {
	MediaControlBar,
	MediaController,
	MediaFullscreenButton,
	MediaMuteButton,
	MediaPlayButton,
	MediaSeekBackwardButton,
	MediaSeekForwardButton,
	MediaTimeDisplay,
	MediaTimeRange,
	MediaVolumeRange,
} from "media-chrome";
import { memo } from "react";

const VideoRenderer = memo(({ src }: { src: string }) => {
	return (
		<MediaController className="w-full h-auto block">
			<video
				slot="media"
				src={src}
				preload="auto"
				muted
				playsInline
				className="w-full h-auto"
			/>
			<MediaControlBar>
				<MediaPlayButton></MediaPlayButton>
				<MediaTimeDisplay></MediaTimeDisplay>
				<MediaTimeRange></MediaTimeRange>
				<MediaMuteButton></MediaMuteButton>
				<MediaVolumeRange></MediaVolumeRange>
				<MediaFullscreenButton></MediaFullscreenButton>
			</MediaControlBar>
		</MediaController>
	);
});

export { VideoRenderer };
