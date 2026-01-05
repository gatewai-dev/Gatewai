import { memo } from "react";
import {
	CentralPlayButton,
	MediaShell,
	SharedControlBar,
} from "../media-chrome";

const AudioRenderer = memo(
	({
		src,
		title,
		showControlsAlways = false, // Added prop
	}: {
		src: string;
		title?: string;
		showControlsAlways?: boolean;
	}) => {
		return (
			<MediaShell isAudio showControlsAlways={showControlsAlways}>
				<audio slot="media" src={src} preload="metadata" />

				{/* Added pointer-events-none here to stop the overlay from blocking the progress bar */}
				<div className="absolute inset-0 flex items-center px-6 pb-6 pointer-events-none">
					<div className="flex flex-col">
						<span className="text-white/40 text-xs font-medium uppercase tracking-widest">
							Audio Track
						</span>
						<span className="text-white/90 text-sm truncate max-w-md">
							{title || "Unknown Source"}
						</span>
					</div>
				</div>

				<CentralPlayButton />
				<SharedControlBar
					hideFullscreen
					showControlsAlways={showControlsAlways}
				/>
			</MediaShell>
		);
	},
);

export { AudioRenderer };
