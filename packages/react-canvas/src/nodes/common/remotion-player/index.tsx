import type { ExtendedLayer, VirtualVideoData } from "@gatewai/core/types";
import {
	CompositionScene,
	SingleClipComposition,
} from "@gatewai/remotion-compositions";
import { Audio, Video } from "@remotion/media";
import type { PlayerRef } from "@remotion/player";
import { Player } from "@remotion/player";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
	MdFullscreen,
	MdPause,
	MdPlayArrow,
	MdRefresh,
	MdVolumeOff,
	MdVolumeUp,
} from "react-icons/md";
import { AbsoluteFill, Img } from "remotion";

const FPS = 24;

// ---------- Inner Remotion composition ----------

const MediaComposition: React.FC<{
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "Text" | string;
	data?: unknown;
	virtualVideo?: VirtualVideoData;
	layers?: ExtendedLayer[];
	viewportWidth?: number;
	viewportHeight?: number;
	children?: ReactNode;
}> = ({
	src,
	isAudio,
	type,
	data,
	virtualVideo,
	layers,
	viewportWidth,
	viewportHeight,
	children,
}) => {
	const resolvedType = type || (isAudio ? "Audio" : "Video");

	// Compositor mode: multiple layers
	if (layers && layers.length > 0) {
		return (
			<AbsoluteFill>
				<CompositionScene
					layers={layers}
					viewportWidth={viewportWidth ?? 1920}
					viewportHeight={viewportHeight ?? 1080}
				/>
				{children}
			</AbsoluteFill>
		);
	}

	return (
		<AbsoluteFill>
			{resolvedType === "Video" && virtualVideo ? (
				<SingleClipComposition virtualVideo={virtualVideo} />
			) : resolvedType === "Video" && src ? (
				<Video
					src={src}
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
				/>
			) : resolvedType === "Audio" && src ? (
				<Audio src={src} />
			) : resolvedType === "Image" && src ? (
				<Img
					src={src}
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
				/>
			) : resolvedType === "Text" ? (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: "white",
						fontSize: "40px",
						whiteSpace: "pre-wrap",
						textAlign: "center",
						padding: "20px",
					}}
				>
					{typeof data === "string" ? data : JSON.stringify(data)}
				</div>
			) : null}
			{children}
		</AbsoluteFill>
	);
};

// ---------- Custom Controls ----------

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

const CustomControls = ({
	playerRef,
	containerRef,
	durationInFrames,
	fps,
	isAudio,
}: {
	playerRef: React.RefObject<PlayerRef | null>;
	containerRef: React.RefObject<HTMLDivElement | null>;
	durationInFrames: number;
	fps: number;
	isAudio?: boolean;
}) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentFrame, setCurrentFrame] = useState(0);
	const [isBuffering, setIsBuffering] = useState(false);
	const [isMuted, setIsMuted] = useState(false);

	// Track current frame via Remotion's frameupdate event
	useEffect(() => {
		const p = playerRef.current;
		if (!p) return;
		const onFrameUpdate = ({ detail }: { detail: { frame: number } }) => {
			setCurrentFrame(detail.frame);
		};
		p.addEventListener("frameupdate", onFrameUpdate);
		return () => p.removeEventListener("frameupdate", onFrameUpdate);
	}, [playerRef]);

	useEffect(() => {
		const p = playerRef.current;
		if (!p) return;

		const onPlay = () => {
			setIsPlaying(true);
		};
		const onPause = () => {
			setIsPlaying(false);
			setCurrentFrame(p.getCurrentFrame());
		};
		const onEnded = () => {
			setIsPlaying(false);
			setCurrentFrame(0);
			p.seekTo(0);
		};
		const onWaiting = () => {
			setIsBuffering(true);
			// Pause the player so it truly stops while buffering
			p.pause();
		};
		const onResume = () => {
			setIsBuffering(false);
		};

		p.addEventListener("play", onPlay);
		p.addEventListener("pause", onPause);
		p.addEventListener("ended", onEnded);
		p.addEventListener("waiting", onWaiting);
		p.addEventListener("resume", onResume);

		return () => {
			p.removeEventListener("play", onPlay);
			p.removeEventListener("pause", onPause);
			p.removeEventListener("ended", onEnded);
			p.removeEventListener("waiting", onWaiting);
			p.removeEventListener("resume", onResume);
		};
	}, [playerRef]);

	const togglePlay = () => {
		const p = playerRef.current;
		if (!p) return;
		if (isPlaying) {
			p.pause();
		} else {
			p.play();
		}
	};

	const toggleMute = () => {
		const p = playerRef.current;
		if (!p) return;
		if (isMuted) {
			p.setVolume(1);
			setIsMuted(false);
		} else {
			p.setVolume(0);
			setIsMuted(true);
		}
	};

	const toggleFullscreen = () => {
		const el = containerRef.current;
		if (!el) return;
		if (!document.fullscreenElement) {
			el.requestFullscreen?.();
		} else {
			document.exitFullscreen?.();
		}
	};

	const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const frame = Number(e.target.value);
		const p = playerRef.current;
		if (!p) return;
		p.seekTo(frame);
		setCurrentFrame(frame);
	};

	const totalSeconds = durationInFrames / fps;
	const currentSeconds = currentFrame / fps;
	const progress = durationInFrames > 0 ? currentFrame / durationInFrames : 0;

	return (
		<div
			className="flex items-center gap-2 px-2 py-1.5 bg-black/80 backdrop-blur-sm rounded-b"
			style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
		>
			{/* Play / Pause / Buffer */}
			<button
				type="button"
				onClick={togglePlay}
				className="flex items-center justify-center w-6 h-6 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
			>
				{isBuffering ? (
					<MdRefresh className="w-3.5 h-3.5 animate-spin text-white/60" />
				) : isPlaying ? (
					<MdPause className="w-3.5 h-3.5" />
				) : (
					<MdPlayArrow className="w-3.5 h-3.5" />
				)}
			</button>

			{/* Seek bar */}
			<div className="relative flex-1 flex items-center h-4">
				<div className="absolute inset-x-0 h-1 bg-white/10 rounded-full" />
				<div
					className="absolute left-0 h-1 bg-white/60 rounded-full pointer-events-none"
					style={{ width: `${progress * 100}%` }}
				/>
				<input
					type="range"
					min={0}
					max={durationInFrames}
					value={currentFrame}
					onChange={onSeek}
					className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
				/>
			</div>

			{/* Time */}
			<span className="text-[10px] text-white/50 shrink-0 tabular-nums">
				{formatTime(currentSeconds)}&nbsp;/&nbsp;{formatTime(totalSeconds)}
			</span>

			{/* Mute (not for audio-only: audio has its own UI) */}
			{!isAudio && (
				<button
					type="button"
					onClick={toggleMute}
					className="flex items-center justify-center w-6 h-6 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
				>
					{isMuted ? (
						<MdVolumeOff className="w-3.5 h-3.5" />
					) : (
						<MdVolumeUp className="w-3.5 h-3.5" />
					)}
				</button>
			)}

			{/* Fullscreen */}
			<button
				type="button"
				onClick={toggleFullscreen}
				className="flex items-center justify-center w-6 h-6 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
			>
				<MdFullscreen className="w-3.5 h-3.5" />
			</button>
		</div>
	);
};

// ---------- Public API ----------

export interface MediaPlayerProps {
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "Text" | string;
	data?: unknown;
	virtualVideo?: VirtualVideoData;
	durationMs?: number;
	/** Compositor mode: pass layers + viewport dimensions */
	layers?: ExtendedLayer[];
	viewportWidth?: number;
	viewportHeight?: number;
	/** Override total frames directly (compositor usage) */
	durationInFrames?: number;
	fps?: number;
	controls?: boolean;
	className?: string;
	children?: ReactNode;
}

export const MediaPlayer = ({
	src,
	isAudio = false,
	type,
	data,
	virtualVideo,
	durationMs,
	layers,
	viewportWidth,
	viewportHeight,
	durationInFrames: durationInFramesProp,
	fps = FPS,
	controls = true,
	className,
	children,
}: MediaPlayerProps) => {
	const playerRef = useRef<PlayerRef>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const resolvedType = type || (isAudio ? "Audio" : "Video");
	const isCompositor = layers && layers.length > 0;

	// Duration resolution priority:
	// 1. explicit durationInFrames (compositor passes this)
	// 2. VirtualVideoData sourceMeta
	// 3. durationMs prop
	// 4. fallback 30 * FPS
	const durationInFrames = (() => {
		if (durationInFramesProp && durationInFramesProp > 0)
			return durationInFramesProp;
		if (virtualVideo?.sourceMeta?.durationMs) {
			return Math.max(
				1,
				Math.ceil((virtualVideo.sourceMeta.durationMs / 1000) * fps),
			);
		}
		if (durationMs) return Math.max(1, Math.ceil((durationMs / 1000) * fps));
		return 30 * fps;
	})();

	const compWidth = isCompositor
		? (viewportWidth ?? 1920)
		: (virtualVideo?.sourceMeta?.width ?? 1920);
	const compHeight = isCompositor
		? (viewportHeight ?? 1080)
		: resolvedType === "Audio"
			? 400
			: (virtualVideo?.sourceMeta?.height ?? 1080);

	const showControls =
		controls && resolvedType !== "Image" && resolvedType !== "Text";

	return (
		<div className="flex flex-col items-stretch">
			<div
				ref={containerRef}
				className={`relative w-full overflow-hidden select-none bg-black ${resolvedType === "Audio" ? "h-32" : ""} ${className || "rounded"}`}
				style={{
					aspectRatio:
						resolvedType !== "Audio"
							? `${compWidth} / ${compHeight}`
							: undefined,
				}}
			>
				{/* Video frame — no native controls */}
				<div className="h-full">
					<Player
						ref={playerRef}
						component={MediaComposition}
						inputProps={{
							src,
							isAudio,
							type: resolvedType,
							data,
							virtualVideo,
							layers,
							viewportWidth,
							viewportHeight,
							children,
						}}
						durationInFrames={durationInFrames}
						fps={fps}
						compositionWidth={compWidth}
						compositionHeight={compHeight}
						style={{ width: "100%", height: "100%" }}
						// Remotion's native controls are OFF — we use custom ones
						controls={false}
						doubleClickToFullscreen={false}
						// Buffer handling
						showPosterWhenBufferingAndPaused
						bufferStateDelayInMilliseconds={0}
						acknowledgeRemotionLicense
					/>
				</div>
			</div>

			{/* Custom controls — rendered OUTSIDE the video frame */}
			{showControls && (
				<CustomControls
					playerRef={playerRef}
					containerRef={containerRef}
					durationInFrames={durationInFrames}
					fps={fps}
					isAudio={isAudio}
				/>
			)}
		</div>
	);
};
