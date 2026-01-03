import "media-chrome"; // This registers the custom elements globally
import { memo } from "react";

const VideoRenderer = memo(({ src }: { src: string }) => {
	return (
		<div className="relative overflow-hidden rounded-xl shadow-2xl">
			{/* @ts-ignore - Custom elements often need TS ignore or a declarations file */}
			<media-controller className="w-full h-auto block">
				<video
					slot="media"
					src={src}
					preload="auto"
					muted
					playsInline
					className="w-full h-auto"
				/>

				{/* Glassmorphism Control Bar */}
				<media-control-bar
					className="m-2 rounded-lg border border-white/20 bg-white/10 backdrop-blur-md shadow-lg"
					style={{
						backgroundColor: "rgba(255, 255, 255, 0.1)",
						backdropFilter: "blur(12px)",
						WebkitBackdropFilter: "blur(12px)",
						border: "1px solid rgba(255, 255, 255, 0.2)",
					}}
				>
					<media-play-button className="hover:bg-white/10 rounded-md transition-colors"></media-play-button>
					<media-time-display className="text-white text-sm font-medium"></media-time-display>
					<media-time-range className="flex-grow"></media-time-range>
					<media-mute-button className="hover:bg-white/10 rounded-md transition-colors"></media-mute-button>
					<media-volume-range></media-volume-range>
					<media-fullscreen-button className="hover:bg-white/10 rounded-md transition-colors"></media-fullscreen-button>
				</media-control-bar>
			</media-controller>
		</div>
	);
});

export { VideoRenderer };
