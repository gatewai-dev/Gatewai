import { memo } from "react";
import {
	CentralPlayButton,
	MediaShell,
	SharedControlBar,
} from "../media-chrome";

const AudioRenderer = memo(
	({ src, title }: { src: string; title?: string }) => {
		return (
			<MediaShell isAudio>
				<audio slot="media" src={src} preload="metadata" />

				<div className="absolute inset-0 flex items-center px-6 pb-6">
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
				<SharedControlBar hideFullscreen />
			</MediaShell>
		);
	},
);

export { AudioRenderer };
