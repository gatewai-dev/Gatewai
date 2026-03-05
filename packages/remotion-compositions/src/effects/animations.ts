import { interpolate, spring } from "remotion";

export type AnimationType =
	| "fade-in"
	| "fade-out"
	| "slide-in-left"
	| "slide-in-right"
	| "slide-in-top"
	| "slide-in-bottom"
	| "zoom-in"
	| "zoom-out"
	| "rotate-cw"
	| "rotate-ccw"
	| "bounce"
	| "shake";

export interface VideoAnimation {
	id: string;
	type: AnimationType;
	value: number; // duration in seconds
}

export const applyAnimation = (
	type: AnimationType,
	frame: number,
	fps: number,
	durationFrames: number,
	animDurationSec: number,
	viewport: { w: number; h: number },
	baseValues: {
		x: number;
		y: number;
		scale: number;
		rotation: number;
		opacity: number;
	},
) => {
	const animDurationFrames = animDurationSec * fps;
	const isOut = type.includes("-out");
	const startAnimFrame = isOut ? durationFrames - animDurationFrames : 0;
	const endAnimFrame = isOut ? durationFrames : animDurationFrames;

	if (frame < startAnimFrame || frame > endAnimFrame) return baseValues;

	const progress = interpolate(
		frame,
		[startAnimFrame, endAnimFrame],
		[isOut ? 1 : 0, isOut ? 0 : 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	let { x, y, scale, rotation, opacity } = baseValues;

	switch (type) {
		case "fade-in":
		case "fade-out":
			opacity *= progress;
			break;
		case "slide-in-left":
			x += -viewport.w * (1 - progress);
			break;
		case "slide-in-right":
			x += viewport.w * (1 - progress);
			break;
		case "slide-in-top":
			y += -viewport.h * (1 - progress);
			break;
		case "slide-in-bottom":
			y += viewport.h * (1 - progress);
			break;
		case "zoom-in":
			scale *= progress;
			break;
		case "zoom-out":
			scale *= progress;
			break;
		case "rotate-cw":
			rotation += 360 * (1 - progress);
			break;
		case "rotate-ccw":
			rotation -= 360 * (1 - progress);
			break;
		case "bounce": {
			const bounceVal = spring({
				frame: frame - startAnimFrame,
				fps,
				config: { damping: 10, mass: 0.5, stiffness: 100 },
				durationInFrames: animDurationFrames,
			});
			scale *= bounceVal;
			break;
		}
		case "shake": {
			const intensity = 20;
			x +=
				intensity *
				Math.sin((frame * 10 * 2 * Math.PI) / animDurationFrames) *
				(1 - progress);
			break;
		}
	}

	return { x, y, scale, rotation, opacity };
};
