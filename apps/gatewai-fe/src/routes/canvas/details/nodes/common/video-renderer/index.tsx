import "media-chrome"; // registers <media-* /> elements
import { memo, useRef } from "react";

const VideoRenderer = memo(({ src }: { src: string }) => {
	const controllerRef = useRef<HTMLElement>(null);

	return (
		<div className="relative w-full max-w-4xl mx-auto aspect-video overflow-hidden rounded-3xl shadow-2xl bg-black group select-none ring-1 ring-white/10">
			{/* @ts-ignore */}
			<media-controller
				ref={controllerRef}
				className="w-full h-full block"
				style={{
					// Apple-style interaction colors
					"--media-icon-color": "rgba(255, 255, 255, 0.9)",
					"--media-range-track-height": "4px",
					"--media-range-thumb-background": "white",
					"--media-range-thumb-width": "12px",
					"--media-range-thumb-height": "12px",
					"--media-range-bar-color": "rgba(255, 255, 255, 0.9)",
					"--media-range-track-background": "rgba(255, 255, 255, 0.2)",
					"--media-control-background": "transparent",
					"--media-control-hover-background": "rgba(255, 255, 255, 0.1)",
				}}
			>
				<video
					slot="media"
					src={src}
					preload="off"
					playsInline
					className="w-full h-full object-cover"
				/>
				<div
					slot="centered-chrome"
					className="pointer-events-none absolute inset-0 flex items-center justify-center"
				>
					<media-play-button
						className={`
              w-8 h-8 
			  p-1
              rounded-full 
              bg-black/20 backdrop-blur-md 
              border border-white/10 
              shadow-2xl 
              transition-all duration-500 ease-out 
              opacity-100 scale-100
              hover:scale-105 hover:bg-black/30
              media-playing:opacity-0 media-playing:scale-90 media-playing:pointer-events-none
              pointer-events-auto
            `}
					/>
				</div>

				{/* 2. FLOATING CONTROL BAR (Glassmorphism Pill)
          Appears on hover.
        */}
				<media-control-bar
					slot="bottom-chrome"
					className={`
            absolute bottom-6 left-1/2 -translate-x-1/2
            w-[90%] max-w-[600px]
            flex items-center gap-4 px-4 py-2
            rounded-full
            bg-white/10 backdrop-blur-2xl saturate-150
            border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]
            opacity-0 translate-y-4
            group-hover:opacity-100 group-hover:translate-y-0
            transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)
          `}
				>
					{/* Play/Pause (Mini) */}
					<media-play-button className="w-8 h-8 opacity-90 hover:opacity-100 transition-opacity" />

					{/* Integrated Scrubber */}
					<media-time-range className="flex-grow opacity-90 hover:opacity-100 transition-opacity" />

					{/* Mute Toggle */}
					<media-mute-button className="w-8 h-8 opacity-90 hover:opacity-100 transition-opacity" />

					{/* Fullscreen */}
					<media-fullscreen-button className="w-8 h-8 opacity-90 hover:opacity-100 transition-opacity" />
				</media-control-bar>

				{/* 3. TOP GRADIENT (Optional)
          Adds depth and makes top corners look premium 
        */}
				<div
					slot="top-chrome"
					className="w-full h-24 bg-gradient-to-b from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
				/>
			</media-controller>
		</div>
	);
});

export { VideoRenderer };
