import type { TransitionType } from "@gatewai/core/types";
import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

interface TransitionProps {
	type: TransitionType;
	durationFrames: number;
	mode: "in" | "out";
	children: React.ReactNode;
}

export const TransitionEffect: React.FC<TransitionProps> = ({
	type,
	durationFrames,
	mode,
	children,
}) => {
	const frame = useCurrentFrame();

	if (type === "none") return <>{children}</>;

	const progress = interpolate(
		frame,
		mode === "in" ? [0, durationFrames] : [0, durationFrames], // This depends on the Sequence context
		mode === "in" ? [0, 1] : [1, 0],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	const style: React.CSSProperties = {
		width: "100%",
		height: "100%",
		position: "absolute",
	};

	switch (type) {
		case "crossfade":
			style.opacity = progress;
			break;
		case "wipe-left":
			style.clipPath = `inset(0 ${100 - progress * 100}% 0 0)`;
			break;
		case "wipe-right":
			style.clipPath = `inset(0 0 0 ${100 - progress * 100}%)`;
			break;
		case "slide-up":
			style.transform = `translateY(${(1 - progress) * 100}%)`;
			break;
		case "slide-down":
			style.transform = `translateY(${(progress - 1) * 100}%)`;
			break;
	}

	return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};
