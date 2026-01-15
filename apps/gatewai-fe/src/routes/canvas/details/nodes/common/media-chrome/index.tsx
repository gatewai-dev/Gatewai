import {
	MediaControlBar,
	MediaController,
	MediaFullscreenButton,
	MediaMuteButton,
	MediaPlayButton,
	MediaTimeDisplay,
	MediaTimeRange,
	MediaVolumeRange,
} from "media-chrome/react";
import type { CSSProperties, ReactNode } from "react";

const REMOTION_THEME: CSSProperties = {
	// Remotion uses a very thin track and a specific white thumb
	"--media-range-track-height": "4px",
	"--media-range-track-border-radius": "2px",
	"--media-range-thumb-background": "#fff",
	"--media-range-thumb-width": "12px",
	"--media-range-thumb-height": "12px",
	"--media-range-thumb-border-radius": "50%",
	"--media-range-bar-color": "#fff",
	"--media-range-track-background": "rgba(255, 255, 255, 0.2)",
	"--media-control-background": "transparent",
	"--media-control-hover-background": "rgba(255, 255, 255, 0.1)",
	"--media-icon-color": "#fff",
	"--media-button-padding": "8px",
} as CSSProperties;

const MediaShell = ({
	children,
	isAudio = false,
}: {
	children: ReactNode;
	isAudio?: boolean;
}) => (
	<div
		className={`
      relative w-full max-w-4xl mx-auto overflow-hidden rounded-md bg-black group select-none
      ${isAudio ? "h-24" : "aspect-video"}
    `}
	>
		<MediaController
			className="w-full h-full"
			style={REMOTION_THEME}
			noHotkeys={isAudio}
		>
			{children}
		</MediaController>
	</div>
);

const SharedControlBar = ({
	hideFullscreen = false,
}: {
	hideFullscreen?: boolean;
}) => (
	<div className="absolute inset-x-0 bottom-0 flex flex-col pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity duration-200 bg-linear-to-t from-black/80 via-black/40 to-transparent">
		<MediaControlBar className="w-full h-4 px-2 flex items-center justify-between pointer-events-auto bg-transparent">
			<div className="flex items-center gap-1">
				<MediaPlayButton className="hover:scale-110 transition-transform" />
				<MediaMuteButton />
				<MediaVolumeRange className="w-0 overflow-hidden group-hover/volume:w-20 transition-all duration-200" />
				<div className="flex items-center px-2 text-[13px] font-mono text-white/90 tabular-nums">
					<MediaTimeDisplay showDuration />
				</div>
			</div>

			<div className="flex items-center gap-1">
				<div className="flex items-center group/volume"></div>

				{!hideFullscreen && (
					<MediaFullscreenButton className="hover:scale-110 transition-transform" />
				)}
			</div>
		</MediaControlBar>
		<div className="w-full pointer-events-auto">
			<MediaTimeRange className="w-full cursor-pointer" />
		</div>
	</div>
);

// Large center play button that fades in/out
const CentralPlayButton = () => (
	<div
		slot="centered-chrome"
		className="pointer-events-none absolute inset-0 flex items-center justify-center"
	>
		<MediaPlayButton
			mediaPaused
			className="w-16 h-16 p-4 rounded-full bg-black/40 backdrop-blur-md border border-white/20 opacity-0 scale-90 group-hover:media-paused:opacity-100 group-hover:media-paused:scale-100 transition-all duration-300 pointer-events-auto"
		/>
	</div>
);

export { MediaShell, CentralPlayButton, SharedControlBar };
