import { memo } from "react";
import { MediaShell, SharedControlBar } from "../media-chrome";

const AudioRenderer = memo(
	({ src, title }: { src: string; title?: string }) => {
		return (
			<MediaShell isAudio>
				{/** biome-ignore lint/a11y/useMediaCaption: No caption exists */}
				<audio slot="media" src={src} preload="metadata" />
				<div className=" inset-0 flex items-center px-3  pointer-events-none">
					<div className="flex flex-col">
						<span className="text-white/40 text-xs font-medium uppercase tracking-widest">
							Audio Track
						</span>
						{title && (
							<span className="text-white/90 text-sm truncate max-w-md">
								{title}
							</span>
						)}
					</div>
				</div>

				<SharedControlBar hideFullscreen />
			</MediaShell>
		);
	},
);

export { AudioRenderer };
