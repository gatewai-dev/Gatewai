import {
	MediaControlBar,
	MediaController,
	MediaFullscreenButton,
	MediaMuteButton,
	MediaPlayButton,
	MediaTimeRange,
} from "media-chrome/react";
import React, { memo } from "react";

const VideoRenderer = memo(({ src }: { src: string }) => {
	return (
		<div className="relative w-full max-w-4xl mx-auto aspect-video overflow-hidden rounded-2xl shadow-2xl bg-black group select-none ring-1 ring-white/10">
			<MediaController
				className="w-full h-full block"
				style={{
					"--media-range-track-height": "2px", // Thinned track
					"--media-range-thumb-background": "white",
					"--media-range-thumb-width": "8px", // Thinned thumb
					"--media-range-thumb-height": "8px",
					"--media-range-bar-color": "rgba(255, 255, 255, 0.9)",
					"--media-range-track-background": "rgba(255, 255, 255, 0.15)",
					"--media-control-background": "transparent",
					"--media-control-hover-background": "rgba(255, 255, 255, 0.05)",
				}}
			>
				<video
					slot="media"
					src={src}
					preload="metadata"
					playsInline
					className="w-full h-full object-cover"
				/>

				{/* 1. CENTER PLAY BUTTON (Reduced to ~33%) */}
				<div
					slot="centered-chrome"
					className="pointer-events-none absolute inset-0 flex items-center justify-center"
				>
					<MediaPlayButton
						className={`
                            w-10 h-10 p-1.5
                            rounded-full 
                            bg-black/20 backdrop-blur-md 
                            border-[0.5px] border-white/20 
                            shadow-xl 
                            transition-all duration-500 ease-out 
                            opacity-0 scale-75
                            group-hover:media-paused:opacity-100 group-hover:media-paused:scale-100
                            hover:scale-105
                            pointer-events-auto
                        `}
					/>
				</div>

				{/* 2. MINI FLOATING CONTROL BAR */}
				<MediaControlBar
					className={`
                        absolute bottom-4 left-1/2 -translate-x-1/2
                        w-[70%] max-w-[400px] /* Narrower bar */
                        h-8 /* Reduced height */
                        flex items-center gap-2 px-3
                        rounded-full
                        bg-white/10 backdrop-blur-xl
                        border border-white/5 shadow-lg
                        
                        opacity-0 translate-y-2
                        group-hover:opacity-100 group-hover:translate-y-0
                        transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
                    `}
				>
					{/* Icons reduced to w-5 (approx 20px) */}
					<MediaPlayButton className="w-5 h-5 opacity-80 hover:opacity-100 transition-opacity" />

					<MediaTimeRange className="grow opacity-80 hover:opacity-100 transition-opacity" />

					<MediaMuteButton className="w-5 h-5 opacity-80 hover:opacity-100 transition-opacity" />

					<MediaFullscreenButton className="w-5 h-5 opacity-80 hover:opacity-100 transition-opacity" />
				</MediaControlBar>

				{/* 3. TOP GRADIENT (Subtle) */}
				<div className="w-full h-16 bg-linear-to-b from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
			</MediaController>
		</div>
	);
});

export { VideoRenderer };
