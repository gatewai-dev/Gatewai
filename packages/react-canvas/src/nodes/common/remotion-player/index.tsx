import type { ExtendedLayer, VirtualVideoData } from "@gatewai/core/types";
import {
	CompositionScene,
	computeRenderParams,
	getActiveVideoMetadata,
	SingleClipComposition,
} from "@gatewai/remotion-compositions";
import { Audio, Video } from "@remotion/media";
import type { PlayerRef } from "@remotion/player";
import { Player } from "@remotion/player";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	MdFullscreen,
	MdFullscreenExit,
	MdPause,
	MdPlayArrow,
	MdRefresh,
	MdVolumeOff,
	MdVolumeUp,
} from "react-icons/md";
import { AbsoluteFill, Img } from "remotion";

const FPS = 24;

// ---------- Inner Remotion composition ----------

// Local MediaComposition removed in favor of unified CompositionScene from @gatewai/remotion-compositions

// ---------- Utility functions ----------

function formatTime(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0)
		return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------- Custom Controls ----------

const CustomControls = ({
	playerRef,
	wrapperRef,
	durationInFrames,
	fps,
	isAudio,
}: {
	playerRef: React.RefObject<PlayerRef | null>;
	wrapperRef: React.RefObject<HTMLDivElement | null>;
	durationInFrames: number;
	fps: number;
	isAudio?: boolean;
}) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentFrame, setCurrentFrame] = useState(0);
	const [isBuffering, setIsBuffering] = useState(false);
	const [volume, setVolume] = useState(1);
	const [isMuted, setIsMuted] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);

	const isPlayingRef = useRef(false);
	const wasPlayingBeforeSeekRef = useRef(false);
	const previousVolumeRef = useRef(1);

	// Sync state with Remotion Player
	useEffect(() => {
		const p = playerRef.current;
		if (!p) return;

		const onFrameUpdate = ({ detail }: { detail: { frame: number } }) => {
			setCurrentFrame(detail.frame);
			setIsBuffering(false); // Safety net: if the frame renders, we are no longer buffering
		};
		const onPlay = () => {
			isPlayingRef.current = true;
			setIsPlaying(true);
			setIsBuffering(false);
		};
		const onPause = () => {
			isPlayingRef.current = false;
			setIsPlaying(false);
			setCurrentFrame(p.getCurrentFrame());
		};
		const onEnded = () => {
			isPlayingRef.current = false;
			setIsPlaying(false);
			setCurrentFrame(0);
			p.seekTo(0);
		};
		const onWaiting = () => setIsBuffering(true);
		const onResume = () => setIsBuffering(false);
		const onSeeked = () => setIsBuffering(false); // Clear buffering state when a seek finishes
		const onError = () => setIsBuffering(false); // Clear on error so the spinner doesn't get stuck

		p.addEventListener("frameupdate", onFrameUpdate);
		p.addEventListener("play", onPlay);
		p.addEventListener("pause", onPause);
		p.addEventListener("ended", onEnded);
		p.addEventListener("waiting", onWaiting);
		p.addEventListener("resume", onResume);
		p.addEventListener("seeked", onSeeked);
		p.addEventListener("error", onError);

		return () => {
			p.removeEventListener("frameupdate", onFrameUpdate);
			p.removeEventListener("play", onPlay);
			p.removeEventListener("pause", onPause);
			p.removeEventListener("ended", onEnded);
			p.removeEventListener("waiting", onWaiting);
			p.removeEventListener("resume", onResume);
			p.removeEventListener("seeked", onSeeked);
			p.removeEventListener("error", onError);
		};
	}, [playerRef]);

	// Handle Fullscreen tracking
	useEffect(() => {
		const onFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};
		document.addEventListener("fullscreenchange", onFullscreenChange);
		return () =>
			document.removeEventListener("fullscreenchange", onFullscreenChange);
	}, []);

	// Playback control wrappers
	const togglePlay = useCallback(() => {
		const p = playerRef.current;
		if (!p) return;
		isPlaying ? p.pause() : p.play();
	}, [isPlaying, playerRef]);

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = parseFloat(e.target.value);
		setVolume(val);
		setIsMuted(val === 0);
		playerRef.current?.setVolume(val);
		if (val > 0) previousVolumeRef.current = val;
	};

	const toggleMute = useCallback(() => {
		const p = playerRef.current;
		if (!p) return;
		if (isMuted) {
			p.setVolume(previousVolumeRef.current);
			setVolume(previousVolumeRef.current);
			setIsMuted(false);
		} else {
			previousVolumeRef.current = volume;
			p.setVolume(0);
			setVolume(0);
			setIsMuted(true);
		}
	}, [isMuted, playerRef, volume]);

	const toggleFullscreen = useCallback(() => {
		const el = wrapperRef.current;
		if (!el) return;
		if (!document.fullscreenElement) {
			el.requestFullscreen?.().catch((err) =>
				console.error("Error attempting to enable fullscreen:", err),
			);
		} else {
			document.exitFullscreen?.();
		}
	}, [wrapperRef]);

	// Keyboard Shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const activeElement = document.activeElement;
			const isInputActive =
				activeElement?.tagName === "INPUT" ||
				activeElement?.tagName === "TEXTAREA";
			if (isInputActive) return;

			// Only trigger if our player wrapper is focused, or we're in fullscreen
			if (
				!wrapperRef.current?.contains(activeElement) &&
				!document.fullscreenElement
			)
				return;

			switch (e.key.toLowerCase()) {
				case " ":
				case "k":
					e.preventDefault();
					togglePlay();
					break;
				case "f":
					e.preventDefault();
					toggleFullscreen();
					break;
				case "m":
					e.preventDefault();
					toggleMute();
					break;
				case "arrowleft":
					e.preventDefault();
					if (playerRef.current) {
						const newFrame = Math.max(0, currentFrame - fps * 5);
						playerRef.current.seekTo(newFrame);
					}
					break;
				case "arrowright":
					e.preventDefault();
					if (playerRef.current) {
						const newFrame = Math.min(durationInFrames, currentFrame + fps * 5);
						playerRef.current.seekTo(newFrame);
					}
					break;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.addEventListener("keydown", handleKeyDown);
	}, [
		togglePlay,
		toggleFullscreen,
		toggleMute,
		currentFrame,
		fps,
		durationInFrames,
		playerRef,
		wrapperRef,
	]);

	// Seeking handlers
	const onSeekStart = () => {
		const p = playerRef.current;
		if (!p) return;
		wasPlayingBeforeSeekRef.current = isPlayingRef.current;
		p.pause();
	};

	const onSeekEnd = () => {
		const p = playerRef.current;
		if (!p) return;
		if (wasPlayingBeforeSeekRef.current) p.play();
		wasPlayingBeforeSeekRef.current = false;
	};

	const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const frame = Number(e.target.value);
		playerRef.current?.seekTo(frame);
		setCurrentFrame(frame);
	};

	const totalSeconds = durationInFrames / fps;
	const currentSeconds = currentFrame / fps;
	const progressPercent =
		durationInFrames > 0 ? (currentFrame / durationInFrames) * 100 : 0;

	return (
		<div className="flex flex-col w-full bg-[#0f0f0f] px-3 py-2 shrink-0">
			{/* YouTube-style Timeline - Replaced JS hovers with pure CSS group-hover/focus-within for better A11y */}
			<div className="relative flex items-center h-4 group">
				<div className="absolute inset-x-0 bg-white/20 rounded-full transition-all duration-200 h-1 group-hover:h-1.5 group-focus-within:h-1.5" />
				<div
					className="absolute left-0 bg-red-600 rounded-full pointer-events-none h-1 group-hover:h-1.5 group-focus-within:h-1.5"
					style={{ width: `${progressPercent}%` }}
				/>
				{/* Thumb indicator */}
				<div
					className="absolute w-3.5 h-3.5 bg-red-600 rounded-full pointer-events-none transform -translate-x-1/2 transition-transform duration-200 scale-0 group-hover:scale-100 group-focus-within:scale-100"
					style={{ left: `${progressPercent}%` }}
				/>
				<input
					type="range"
					min={0}
					max={durationInFrames}
					value={currentFrame}
					onChange={onSeek}
					onPointerDown={onSeekStart}
					onPointerUp={onSeekEnd}
					onPointerCancel={onSeekEnd}
					aria-label="Video timeline"
					aria-valuetext={`${formatTime(currentSeconds)} of ${formatTime(totalSeconds)}`}
					className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
				/>
			</div>

			{/* Bottom Control Bar */}
			<div className="flex items-center justify-between mt-2 select-none">
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={togglePlay}
						aria-label={isPlaying ? "Pause" : "Play"}
						className="text-white/90 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
					>
						{isBuffering ? (
							<MdRefresh
								className="w-6 h-6 animate-spin text-white/60"
								aria-hidden="true"
							/>
						) : isPlaying ? (
							<MdPause className="w-6 h-6" aria-hidden="true" />
						) : (
							<MdPlayArrow className="w-6 h-6" aria-hidden="true" />
						)}
					</button>

					{!isAudio && (
						<div className="flex items-center group">
							<button
								type="button"
								onClick={toggleMute}
								aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
								className="text-white/90 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
							>
								{isMuted || volume === 0 ? (
									<MdVolumeOff className="w-5 h-5" aria-hidden="true" />
								) : (
									<MdVolumeUp className="w-5 h-5" aria-hidden="true" />
								)}
							</button>
							{/* Expandable Volume Slider */}
							<div className="w-0 overflow-hidden group-hover:w-20 group-focus-within:w-20 transition-all duration-300 ease-in-out flex items-center ml-2">
								<input
									type="range"
									min="0"
									max="1"
									step="0.05"
									value={volume}
									onChange={handleVolumeChange}
									aria-label="Volume"
									className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
								/>
							</div>
						</div>
					)}

					<span
						className="text-xs text-white/80 tabular-nums tracking-wide"
						aria-live="polite"
					>
						{formatTime(currentSeconds)}{" "}
						<span className="text-white/40 mx-1" aria-hidden="true">
							/
						</span>{" "}
						{formatTime(totalSeconds)}
					</span>
				</div>

				<div>
					<button
						type="button"
						onClick={toggleFullscreen}
						aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
						className="text-white/90 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
					>
						{isFullscreen ? (
							<MdFullscreenExit className="w-6 h-6" aria-hidden="true" />
						) : (
							<MdFullscreen className="w-6 h-6" aria-hidden="true" />
						)}
					</button>
				</div>
			</div>
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
	layers?: ExtendedLayer[];
	viewportWidth?: number;
	viewportHeight?: number;
	durationInFrames?: number;
	fps?: number;
	controls?: boolean;
	className?: string;
	children?: ReactNode;
	overlay?: ReactNode;
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
	overlay,
}: MediaPlayerProps) => {
	const playerRef = useRef<PlayerRef>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const resolvedType = type || (isAudio ? "Audio" : "Video");

	const activeMeta = useMemo(() => {
		if (virtualVideo) {
			return getActiveVideoMetadata(virtualVideo);
		}
		return null;
	}, [virtualVideo]);

	const durationInFrames = (() => {
		if (durationInFramesProp && durationInFramesProp > 0)
			return durationInFramesProp;
		if (activeMeta?.durationMs)
			return Math.max(1, Math.ceil((activeMeta.durationMs / 1000) * fps));
		if (durationMs) return Math.max(1, Math.ceil((durationMs / 1000) * fps));
		return 30 * fps;
	})();

	const compWidth = viewportWidth ?? activeMeta?.width ?? 1920;

	const compHeight =
		resolvedType === "Audio"
			? 400
			: (viewportHeight ?? activeMeta?.height ?? 1080);

	const showControls =
		controls && resolvedType !== "Image" && resolvedType !== "Text";

	return (
		<div
			ref={wrapperRef}
			className={`flex flex-col w-full bg-black overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className || "rounded-lg shadow-xl"}`}
		>
			{/* Video Area */}
			<div
				className={`relative w-full flex-1 min-h-0 bg-black flex items-center justify-center ${resolvedType === "Audio" ? "h-32" : ""}`}
				style={
					!document.fullscreenElement && resolvedType !== "Audio"
						? { aspectRatio: `${compWidth} / ${compHeight}` }
						: undefined
				}
			>
				<Player
					ref={playerRef}
					component={CompositionScene}
					inputProps={{
						src,
						isAudio,
						type: resolvedType,
						data,
						virtualVideo,
						layers,
						viewportWidth: compWidth,
						viewportHeight: compHeight,
						children,
					}}
					durationInFrames={durationInFrames}
					fps={fps}
					compositionWidth={compWidth}
					compositionHeight={compHeight}
					spaceKeyToPlayOrPause={false}
					showPosterWhenUnplayed={false}
					style={{ width: "100%", height: "100%" }}
					controls={false}
					clickToPlay={false}
					doubleClickToFullscreen={false}
					bufferStateDelayInMilliseconds={300}
					acknowledgeRemotionLicense
				/>
				{overlay}
			</div>

			{/* Custom controls strictly out of frame */}
			{showControls && (
				<CustomControls
					playerRef={playerRef}
					wrapperRef={wrapperRef}
					durationInFrames={durationInFrames}
					fps={fps}
					isAudio={isAudio}
				/>
			)}
		</div>
	);
};
