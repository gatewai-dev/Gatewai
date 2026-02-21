import { Audio, Video } from "@remotion/media";
import { Player } from "@remotion/player";
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

const FPS = 30;

const MediaComposition: React.FC<{
	src: string;
	isAudio: boolean;
	children?: ReactNode;
}> = ({ src, isAudio, children }) => {
	return (
		<AbsoluteFill>
			{isAudio ? (
				<Audio src={src} />
			) : (
				<Video
					src={src}
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
				/>
			)}
			{children}
		</AbsoluteFill>
	);
};

export interface MediaPlayerProps {
	src: string;
	isAudio?: boolean;
	durationMs?: number;
	children?: ReactNode;
}

export const MediaPlayer = ({
	src,
	isAudio = false,
	durationMs,
	children,
}: MediaPlayerProps) => {
	const durationInFrames = durationMs
		? Math.max(1, Math.ceil((durationMs / 1000) * FPS))
		: 30 * FPS;

	return (
		<div
			className={`
      relative w-full max-w-4xl mx-auto overflow-hidden rounded-md bg-black group select-none
      ${isAudio ? "h-32" : "aspect-video"}
    `}
		>
			<Player
				component={MediaComposition}
				inputProps={{ src, isAudio, children }}
				durationInFrames={durationInFrames}
				fps={FPS}
				compositionWidth={1920}
				compositionHeight={isAudio ? 400 : 1080}
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
