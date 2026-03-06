import { memo } from "react";
import { MediaPlayer } from "../remotion-player";

const AudioRenderer = memo(
	({
		src,
		title,
		durationMs,
		virtualMedia,
	}: {
		src: string;
		title?: string;
		durationMs?: number;
		virtualMedia?: any;
	}) => {
		return (
			<MediaPlayer
				src={src}
				isAudio
				type="Audio"
				durationMs={durationMs}
				virtualMedia={virtualMedia}
			>
				<div className="absolute inset-0 flex items-center px-3 pointer-events-none">
					<div className="flex flex-col">
						<span className="text-white/40 text-[10px] font-medium uppercase tracking-widest">
							Audio Track
						</span>
						{title && (
							<span className="text-white/90 text-sm truncate max-w-sm">
								{title}
							</span>
						)}
					</div>
				</div>
			</MediaPlayer>
		);
	},
);

export { AudioRenderer };
