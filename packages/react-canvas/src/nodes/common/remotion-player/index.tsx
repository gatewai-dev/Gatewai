import type { VirtualVideoData } from "@gatewai/core/types";
import { SingleClipComposition } from "@gatewai/remotion-compositions";
import { Audio, Video } from "@remotion/media";
import { Player } from "@remotion/player";
import type { ReactNode } from "react";
import { AbsoluteFill, Img } from "remotion";

const FPS = 24;

const MediaComposition: React.FC<{
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "Text" | string;
	data?: any;
	virtualVideo?: VirtualVideoData;
	children?: ReactNode;
}> = ({ src, isAudio, type, data, virtualVideo, children }) => {
	const resolvedType = type || (isAudio ? "Audio" : "Video");

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

export interface MediaPlayerProps {
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "Text" | string;
	data?: any;
	virtualVideo?: VirtualVideoData;
	durationMs?: number;
	children?: ReactNode;
}

export const MediaPlayer = ({
	src,
	isAudio = false,
	type,
	data,
	virtualVideo,
	durationMs,
	children,
}: MediaPlayerProps) => {
	const durationInFrames = durationMs
		? Math.max(1, Math.ceil((durationMs / 1000) * FPS))
		: 30 * FPS;

	const resolvedType = type || (isAudio ? "Audio" : "Video");

	return (
		<div
			className={`
      relative w-full max-w-4xl mx-auto overflow-hidden rounded-md bg-black group select-none
      ${resolvedType === "Audio" ? "h-32" : "aspect-video"}
    `}
		>
			<Player
				component={MediaComposition}
				inputProps={{
					src,
					isAudio,
					type: resolvedType,
					data,
					virtualVideo,
					children,
				}}
				durationInFrames={durationInFrames}
				fps={FPS}
				compositionWidth={1920}
				compositionHeight={resolvedType === "Audio" ? 400 : 1080}
				style={{
					width: "100%",
					height: "100%",
				}}
				controls
				acknowledgeRemotionLicense
				loop
			/>
		</div>
	);
};
