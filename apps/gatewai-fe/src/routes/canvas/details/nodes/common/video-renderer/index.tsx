import {
	MediaControlBar,
	MediaController,
	MediaFullscreenButton,
	MediaMuteButton,
	MediaPlayButton,
	MediaTimeRange,
} from "media-chrome/react";
import { memo } from "react";

const VideoRenderer = memo(({ src }: { src: string }) => {
	return (
		<div className="relative w-full max-w-4xl mx-auto aspect-video overflow-hidden rounded-xl shadow-2xl bg-black group select-none ring-1 ring-white/10">
			<MediaController
				className="w-full h-full block"
				style={{
					"--media-range-track-height": "2px",
					"--media-range-thumb-background": "white",
					"--media-range-thumb-width": "8px",
					"--media-range-thumb-height": "8px",
					"--media-range-bar-color": "rgba(255, 255, 255, 0.9)",
					"--media-range-track-background": "rgba(255, 255, 255, 0.1)",
					"--media-control-background": "transparent",
					"--media-control-hover-background": "transparent",
				}}
			>
				<video
					slot="media"
					src={src}
					preload="metadata"
					playsInline
					className="w-full h-full object-cover"
				/>

				<div
					slot="centered-chrome"
					className="pointer-events-none absolute inset-0 flex items-center justify-center"
				>
					<MediaPlayButton className="w-10 h-10 p-2 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 opacity-0 scale-90 group-hover:media-paused:opacity-100 group-hover:media-paused:scale-100 transition-all duration-300 pointer-events-auto" />
				</div>

				<div className="absolute inset-x-0 bottom-0 pointer-events-none">
					<MediaControlBar
						className={`
                            w-full h-10 px-3
                            flex items-center gap-2
							bg-linear-to-b from-black/20 via-black/10
                            pointer-events-auto
                            translate-y-1 opacity-0
                            group-hover:translate-y-0 group-hover:opacity-100
                            transition-all duration-300
                        `}
					>
						<MediaPlayButton className="w-4 h-4 text-white/90 hover:text-white transition-colors" />

						<MediaTimeRange className="grow" />

						<div className="flex items-center gap-2">
							<MediaMuteButton className="w-4 h-4 text-white/90 hover:text-white transition-colors" />
							<MediaFullscreenButton className="w-4 h-4 text-white/90 hover:text-white transition-colors" />
						</div>
					</MediaControlBar>
				</div>
			</MediaController>
		</div>
	);
});

export { VideoRenderer };
