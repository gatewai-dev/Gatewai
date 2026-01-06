import {
	MediaControlBar,
	MediaController,
	MediaFullscreenButton,
	MediaMuteButton,
	MediaPlayButton,
	MediaTimeRange,
} from "media-chrome/react";
import type { ReactNode } from "react";

// Shared styles for the MediaController
const SHARED_MEDIA_THEME = {
	"--media-range-track-height": "2px",
	"--media-range-thumb-background": "white",
	"--media-range-thumb-width": "8px",
	"--media-range-thumb-height": "8px",
	"--media-range-bar-color": "rgba(255, 255, 255, 0.9)",
	"--media-range-track-background": "rgba(255, 255, 255, 0.1)",
	"--media-control-background": "transparent",
	"--media-control-hover-background": "transparent",
} as React.CSSProperties;

// A shared layout wrapper to maintain visual consistency
const MediaShell = ({
	children,
	isAudio = false,
}: {
	children: ReactNode;
	isAudio?: boolean;
}) => (
	<div
		className={`
        relative w-full max-w-4xl mx-auto overflow-hidden rounded-xl shadow-2xl bg-black group select-none ring-1 ring-white/10
        ${isAudio ? "h-24" : ""}
    `}
	>
		<MediaController
			className="w-full h-full block"
			style={SHARED_MEDIA_THEME}
			noHotkeys={isAudio}
		>
			{children}
		</MediaController>
	</div>
);

// Shared Play Button for the center of the UI
const CentralPlayButton = () => (
	<div
		slot="centered-chrome"
		className="pointer-events-none absolute inset-0 flex items-center justify-center"
	>
		<MediaPlayButton className="w-10 h-10 p-2 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 opacity-0 scale-90 group-hover:media-paused:opacity-100 group-hover:media-paused:scale-100 transition-all duration-300 pointer-events-auto" />
	</div>
);

// Shared Bottom Control Bar
const SharedControlBar = ({
	hideFullscreen = false,
	showControlsAlways = false, // Added prop
}: {
	hideFullscreen?: boolean;
	showControlsAlways?: boolean;
}) => (
	<div className="absolute inset-x-0 bottom-0 pointer-events-none">
		<MediaControlBar
			className={`
                w-full h-10 px-3 flex items-center gap-2 bg-linear-to-b from-black/60 to-black/20 pointer-events-auto transition-all duration-300
                ${
									showControlsAlways
										? "opacity-100 translate-y-0"
										: "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
								}
            `}
		>
			<MediaPlayButton className="w-4 h-4 text-white/90 hover:text-white transition-colors" />
			<MediaTimeRange className="grow" />
			<div className="flex items-center gap-2">
				<MediaMuteButton className="w-4 h-4 text-white/90 hover:text-white transition-colors" />
				{!hideFullscreen && (
					<MediaFullscreenButton className="w-4 h-4 text-white/90 hover:text-white transition-colors" />
				)}
			</div>
		</MediaControlBar>
	</div>
);

export { SHARED_MEDIA_THEME, MediaShell, CentralPlayButton, SharedControlBar };
