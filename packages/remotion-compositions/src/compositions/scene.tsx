import type {
	ExtendedLayer,
	VideoAnimation,
	VirtualMediaData,
} from "@gatewai/core/types";
import type { Caption } from "@remotion/captions";
import { parseSrt } from "@remotion/captions";
import { measureText } from "@remotion/layout-utils";
import type { LottieAnimationData } from "@remotion/lottie";
import { Lottie } from "@remotion/lottie";
import { Audio, Video } from "@remotion/media";
import { createRoundedTextBox } from "@remotion/rounded-text-box";
import React, { useEffect, useMemo, useState } from "react";
import {
	AbsoluteFill,
	cancelRender,
	continueRender,
	delayRender,
	Img,
	interpolate,
	Sequence,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import {
	buildCSSFilterString,
	computeRenderParams,
} from "../utils/apply-operations.js";
import {
	getActiveMediaMetadata,
	getMediaType,
} from "../utils/resolve-video.js";

const DEFAULT_DURATION_MS = 5000;

const isLottieSource = (virtualMedia: VirtualMediaData): boolean => {
	const op = virtualMedia?.operation;
	if (!op || op.op !== "source") return false;
	const src = op.source;
	if (!src) return false;
	const mimeType: string =
		src.processData?.mimeType ?? src.entity?.mimeType ?? "";
	if (mimeType === "application/json") return true;
	const key: string = src.entity?.key ?? src.entity?.name ?? "";
	return key.toLowerCase().endsWith(".json");
};

const isStaticVisualMedia = (type?: string): boolean =>
	type === "Image" || type === "SVG";

interface LottieFromUrlProps {
	src: string;
	style?: React.CSSProperties;
	loop?: boolean;
	playbackRate?: number;
}

const LottieFromUrl: React.FC<LottieFromUrlProps> = ({
	src,
	style,
	loop = true,
	playbackRate = 1,
}) => {
	const [animationData, setAnimationData] =
		useState<LottieAnimationData | null>(null);

	useEffect(() => {
		const handle = delayRender(`Loading Lottie from: ${src}`);
		let cancelled = false;

		fetch(src)
			.then((res) => res.json())
			.then((data) => {
				if (cancelled) {
					continueRender(handle);
					return;
				}
				setAnimationData(data);
				continueRender(handle);
			})
			.catch((err) => {
				if (cancelled) {
					continueRender(handle);
					return;
				}
				cancelRender(err instanceof Error ? err : new Error(String(err)));
			});

		return () => {
			cancelled = true;
		};
	}, [src]);

	if (!animationData)
		return (
			<div
				style={{
					position: "absolute",
					inset: 0,
					width: "100%",
					height: "100%",
					...style,
				}}
			/>
		);

	return (
		<Lottie
			animationData={animationData}
			loop={loop}
			playbackRate={playbackRate}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				...style,
			}}
		/>
	);
};

interface RoundedTextRendererProps {
	text: string;
	fill?: string;
	fontSize?: number;
	fontFamily?: string;
	fontWeight?: string | number;
	fontStyle?: string;
	textDecoration?: string;
	lineHeight?: number;
	letterSpacing?: number;
	align?: "left" | "center" | "right";
	textShadow?: string; // Add this
	verticalAlign?: string;
	/** Horizontal padding inside the pill (px). Maps to layer.padding. */
	padding?: number;
	/** Corner radius (px). Maps to layer.borderRadius. */
	borderRadius?: number;
	/** Pill fill colour. Maps to layer.backgroundColor. */
	backgroundColor?: string;
	stroke?: string;
	strokeWidth?: number;
}

const RoundedTextRenderer: React.FC<RoundedTextRendererProps> = ({
	text,
	fill = "#ffffff",
	fontSize = 40,
	fontFamily = "Inter",
	fontWeight = "normal",
	fontStyle = "normal",
	textShadow,
	textDecoration = "none",
	lineHeight = 1.2,
	letterSpacing,
	align = "center",
	verticalAlign,
	padding = 16,
	borderRadius = 8,
	backgroundColor = "rgba(0,0,0,0.7)",
	stroke,
	strokeWidth,
}) => {
	const fw = String(fontWeight);
	const lines = text.split("\n");

	// measureText is synchronous in headless Chrome — safe in useMemo.
	const textMeasurements = useMemo(
		() =>
			lines.map((line) =>
				measureText({
					text: line || "\u00A0",
					fontFamily,
					fontSize,
					fontVariantNumeric: "normal",
					fontWeight: fw,
					letterSpacing: letterSpacing ? `${letterSpacing}px` : "normal",
					textTransform: "none",
					additionalStyles: {
						fontStyle,
						lineHeight: String(lineHeight),
						textDecoration,
					},
				} as Parameters<typeof measureText>[0]),
			),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			text,
			fontFamily,
			fontSize,
			fw,
			fontStyle,
			lineHeight,
			letterSpacing,
			textDecoration,
			lines.map,
		],
	);

	const { d, boundingBox } = useMemo(
		() =>
			createRoundedTextBox({
				textMeasurements,
				textAlign: align,
				horizontalPadding: padding,
				borderRadius,
			}),
		[textMeasurements, align, padding, borderRadius],
	);

	const alignItems =
		align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center";

	const justifyContent =
		verticalAlign === "middle"
			? "center"
			: verticalAlign === "bottom"
				? "flex-end"
				: "flex-start";

	const lineStyle: React.CSSProperties = {
		fontSize,
		fontFamily,
		fontWeight: fw,
		fontStyle,
		textShadow,
		textDecoration,
		lineHeight,
		textAlign: align,
		color: fill,
		letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
		WebkitTextStroke:
			strokeWidth && stroke ? `${strokeWidth}px ${stroke}` : undefined,
		paintOrder: "stroke fill",
		paddingLeft: padding,
		paddingRight: padding,
		whiteSpace: "pre",
		// No background here — the SVG handles it.
		background: "none",
	};

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems,
				justifyContent,
			}}
		>
			{/* Bounding container sized to match the SVG path exactly */}
			<div style={{ position: "relative", width: boundingBox.width }}>
				{/* Pill background */}
				<svg
					viewBox={boundingBox.viewBox}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: boundingBox.width,
						height: boundingBox.height,
						overflow: "visible",
						pointerEvents: "none",
					}}
					aria-hidden="true"
				>
					<path fill={backgroundColor} d={d} />
				</svg>

				{/* Text content — one div per line so heights align with measurements */}
				<div style={{ position: "relative" }}>
					{lines.map((line, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: stable line order
							key={i}
							style={lineStyle}
						>
							{/* Preserve empty lines visually */}
							{line || "\u00A0"}
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

type TikTokToken = { text: string; fromMs: number; toMs: number };
type LineGroup = { tokens: TikTokToken[]; text: string };

function buildLines(
	tokens: TikTokToken[],
	maxWidth: number,
	fontFamily: string,
	fontSize: number,
	fontWeight: string,
	fontStyle: string,
): LineGroup[] {
	const measure = (t: string) =>
		measureText({
			text: t,
			fontFamily,
			fontSize,
			fontVariantNumeric: "normal",
			fontWeight,
			letterSpacing: "normal",
			textTransform: "none",
			additionalStyles: { fontStyle },
		} as Parameters<typeof measureText>[0]).width;

	const spaceW = measure(" ");
	const groups: LineGroup[] = [];
	let currentTokens: TikTokToken[] = [];
	let currentWidth = 0;

	for (const token of tokens) {
		const word = token.text.trimStart();
		const wordW = measure(word);
		const addW = currentTokens.length > 0 ? spaceW + wordW : wordW;

		if (currentTokens.length > 0 && currentWidth + addW > maxWidth) {
			groups.push({
				tokens: currentTokens,
				text: currentTokens.map((t) => t.text.trim()).join(" "),
			});
			currentTokens = [token];
			currentWidth = wordW;
		} else {
			currentTokens.push(token);
			currentWidth += addW;
		}
	}
	if (currentTokens.length > 0) {
		groups.push({
			tokens: currentTokens,
			text: currentTokens.map((t) => t.text.trim()).join(" "),
		});
	}
	return groups;
}

interface TikTokCaptionPageProps {
	page: {
		tokens: TikTokToken[];
		text: string;
		startMs: number;
		durationMs: number;
	};
	currentTimeMs: number;
	fontFamily: string;
	fontSize: number;
	fontWeight: string;
	textColor: string;
	activeColor: string;
	backgroundColor: string;
	horizontalPadding: number;
	borderRadius: number;
	lineHeight: number;
	fontStyle: string;
	textDecoration: string;
	maxWidth: number;
}

const TikTokCaptionPage: React.FC<TikTokCaptionPageProps> = ({
	page,
	currentTimeMs,
	fontFamily,
	fontSize,
	fontWeight,
	textColor,
	activeColor,
	backgroundColor,
	horizontalPadding,
	borderRadius,
	lineHeight,
	fontStyle,
	textDecoration,
	maxWidth,
}) => {
	const lines = useMemo(
		() =>
			buildLines(
				page.tokens,
				maxWidth,
				fontFamily,
				fontSize,
				fontWeight,
				fontStyle,
			),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[page.tokens, maxWidth, fontFamily, fontSize, fontWeight, fontStyle],
	);

	const textMeasurements = useMemo(
		() =>
			lines.map((line) =>
				measureText({
					text: line.text,
					fontFamily,
					fontSize,
					additionalStyles: {
						lineHeight: String(lineHeight),
						fontStyle,
						textDecoration,
					},
					fontVariantNumeric: "normal",
					fontWeight,
					letterSpacing: "normal",
					textTransform: "none",
				} as Parameters<typeof measureText>[0]),
			),
		[
			lines,
			fontFamily,
			fontSize,
			fontWeight,
			lineHeight,
			fontStyle,
			textDecoration,
		],
	);

	const { d, boundingBox } = useMemo(
		() =>
			createRoundedTextBox({
				textMeasurements,
				textAlign: "center",
				horizontalPadding,
				borderRadius,
			}),
		[textMeasurements, horizontalPadding, borderRadius],
	);

	return (
		<div
			style={{
				position: "relative",
				width: boundingBox.width,
				margin: "0 auto",
			}}
		>
			<svg
				viewBox={boundingBox.viewBox}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: boundingBox.width,
					height: boundingBox.height,
					overflow: "visible",
					pointerEvents: "none",
				}}
				aria-hidden="true"
			>
				<path fill={backgroundColor} d={d} />
			</svg>

			<div style={{ position: "relative" }}>
				{lines.map((line, lineIdx) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: stable
						key={lineIdx}
						style={{
							fontSize,
							fontWeight,
							fontFamily,
							fontStyle,
							textDecoration,
							lineHeight: String(lineHeight),
							textAlign: "center",
							paddingLeft: horizontalPadding,
							paddingRight: horizontalPadding,
							// Let the browser handle standard natural text layout so it identically matches measureText
							whiteSpace: "nowrap",
						}}
					>
						{line.tokens.map((token, tokenIdx) => {
							const isActive =
								currentTimeMs >= token.fromMs && currentTimeMs < token.toMs;
							return (
								<React.Fragment key={`${tokenIdx}_token`}>
									{tokenIdx > 0 && " "}
									<span
										style={{
											display: "inline-block",
											color: isActive ? activeColor : textColor,
											transform: isActive ? "scale(1.15)" : "scale(1)",
											transformOrigin: "center center",
											transition:
												"transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.1s ease-out",
											textShadow: isActive
												? `0 0 12px ${activeColor}80`
												: "0 2px 4px rgba(0,0,0,0.4)",
											willChange: "transform, color",
										}}
									>
										{token.text.trim()}
									</span>
								</React.Fragment>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
};

interface CaptionsFromUrlProps {
	src: string;
	style?: React.CSSProperties;
	preset?: "default" | "tiktok";
	/** When true, the default preset renders each caption with a pill background. */
	useRoundedTextBox?: boolean;
}

const CaptionsFromUrl: React.FC<CaptionsFromUrlProps> = ({
	src,
	style,
	preset = "default",
	useRoundedTextBox = false,
}) => {
	const [captions, setCaptions] = useState<Caption[] | null>(null);
	const frame = useCurrentFrame();
	const { fps, width: compositionWidth } = useVideoConfig();

	useEffect(() => {
		const handle = delayRender(`Loading Captions from: ${src}`);
		let cancelled = false;

		fetch(src)
			.then((res) => res.text())
			.then((text) => {
				if (cancelled) {
					continueRender(handle);
					return;
				}
				try {
					const { captions: parsed } = parseSrt({ input: text });
					setCaptions(parsed);
				} catch (e) {
					console.error("Failed to parse SRT", e);
					setCaptions([]);
				}
				continueRender(handle);
			})
			.catch((err) => {
				if (cancelled) {
					continueRender(handle);
					return;
				}
				cancelRender(err instanceof Error ? err : new Error(String(err)));
			});

		return () => {
			cancelled = true;
		};
	}, [src]);

	if (!captions) return null;

	const currentTimeMs = (frame / fps) * 1000;

	const hAlign =
		style?.textAlign === "left"
			? "flex-start"
			: style?.textAlign === "right"
				? "flex-end"
				: "center";

	const vAlign =
		(style as any)?.verticalAlign === "top"
			? "flex-start"
			: (style as any)?.verticalAlign === "bottom"
				? "flex-end"
				: "center";

	if (preset === "tiktok") {
		const fontFamily = (style?.fontFamily as string) || "Impact, sans-serif";
		const fontSize = (style?.fontSize as number) || 60;
		const fontWeight = String(style?.fontWeight ?? "700");
		const fontStyle = (style?.fontStyle as string) || "normal";
		const textDecoration = (style?.textDecoration as string) || "none";
		const lineHeight = Number(style?.lineHeight) || 1.35;
		const activeColor = (style?.color as string) || "#FFFC00";
		const textColor = "white";
		const backgroundColor =
			(style as any)?.captionBackgroundColor ?? "rgba(0,0,0,0.72)";
		const horizontalPadding = 22;
		const borderRadius = 12;

		// Sentence-level SRT: distribute word timings evenly across the entry.
		const currentCaption = captions.find(
			(c) => currentTimeMs >= c.startMs && currentTimeMs < c.endMs,
		);
		if (!currentCaption) return null;

		const words = currentCaption.text.trim().split(/\s+/).filter(Boolean);
		const entryDuration = currentCaption.endMs - currentCaption.startMs;
		const wordDurationMs =
			words.length > 0 ? entryDuration / words.length : entryDuration;

		const tokens: TikTokToken[] = words.map((word, i) => ({
			text: word,
			fromMs: currentCaption.startMs + i * wordDurationMs,
			toMs: currentCaption.startMs + (i + 1) * wordDurationMs,
		}));

		const page = {
			tokens,
			text: words.join(" "),
			startMs: currentCaption.startMs,
			durationMs: entryDuration,
		};

		const maxWidth = compositionWidth * 0.8 - horizontalPadding * 2;

		return (
			<AbsoluteFill
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: hAlign,
					justifyContent: vAlign,
					padding: style?.padding,
					pointerEvents: "none",
				}}
			>
				<TikTokCaptionPage
					page={page}
					currentTimeMs={currentTimeMs}
					fontFamily={fontFamily}
					fontSize={fontSize}
					fontWeight={fontWeight}
					fontStyle={fontStyle}
					textDecoration={textDecoration}
					textColor={textColor}
					activeColor={activeColor}
					backgroundColor={backgroundColor}
					horizontalPadding={horizontalPadding}
					borderRadius={borderRadius}
					lineHeight={lineHeight}
					maxWidth={maxWidth}
				/>
			</AbsoluteFill>
		);
	}

	const currentCaption = captions.find(
		(c) => currentTimeMs >= c.startMs && currentTimeMs < c.endMs,
	);
	if (!currentCaption) return null;

	if (useRoundedTextBox) {
		const fontSize = (style?.fontSize as number) ?? 48;
		const fontFamily = (style?.fontFamily as string) ?? "Inter";
		const fontWeight = String(style?.fontWeight ?? "normal");
		const fontStyle = (style?.fontStyle as string) ?? "normal";
		const textDecoration = (style?.textDecoration as string) ?? "none";
		const textShadow = (style?.textShadow as string) ?? undefined;
		const lineHeight = Number(style?.lineHeight ?? 1.2);
		const letterSpacing = style?.letterSpacing
			? Number.parseFloat(String(style.letterSpacing))
			: undefined;
		const fill = (style?.color as string) ?? "#ffffff";
		const backgroundColor =
			(style as any)?.captionBackgroundColor ?? "rgba(0,0,0,0.7)";
		const padding = style?.padding
			? Number.parseFloat(String(style.padding))
			: 16;
		const borderRadius = 8;
		const align = (style?.textAlign as "left" | "center" | "right") ?? "center";
		const verticalAlign = (style as any)?.verticalAlign ?? "bottom";
		const stroke = style?.WebkitTextStroke
			? String(style.WebkitTextStroke).split(" ").slice(1).join(" ")
			: undefined;
		const strokeWidth = style?.WebkitTextStroke
			? Number.parseFloat(String(style.WebkitTextStroke))
			: undefined;

		return (
			<AbsoluteFill
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: hAlign,
					justifyContent: vAlign,
					pointerEvents: "none",
				}}
			>
				<RoundedTextRenderer
					text={currentCaption.text}
					fill={fill}
					fontSize={fontSize}
					fontFamily={fontFamily}
					textShadow={textShadow}
					fontWeight={fontWeight}
					fontStyle={fontStyle}
					textDecoration={textDecoration}
					lineHeight={lineHeight}
					letterSpacing={letterSpacing}
					align={align}
					verticalAlign={verticalAlign}
					padding={padding}
					borderRadius={borderRadius}
					backgroundColor={backgroundColor}
					stroke={stroke}
					strokeWidth={strokeWidth}
				/>
			</AbsoluteFill>
		);
	}

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				flexDirection: "column",
				alignItems: hAlign,
				justifyContent: vAlign,
				...style,
			}}
		>
			<span
				style={{
					color: style?.color ?? "white",
					fontStyle: style?.fontStyle,
					textDecoration: style?.textDecoration,
					textShadow: style?.textShadow,
					WebkitTextStroke: style?.WebkitTextStroke,
				}}
			>
				{currentCaption.text}
			</span>
		</div>
	);
};

const verticalAlignToJustify = (v?: string): string =>
	v === "middle" ? "center" : v === "bottom" ? "flex-end" : "flex-start";

/**
 * Build the common CSS typography properties from a layer's ExtendedLayer shape.
 * Eliminates duplication across LayerContentRenderer, SingleClipComposition,
 * and CaptionsFromUrl style prop.
 */
const buildLayerTextStyle = (
	s: Partial<ExtendedLayer> & Record<string, any>,
): React.CSSProperties => ({
	color: s.fill,
	fontSize: s.fontSize,
	fontFamily: s.fontFamily,
	fontStyle: s.fontStyle,
	fontWeight: s.fontWeight,
	textDecoration: s.textDecoration,
	textShadow: s.textShadow,
	lineHeight: s.lineHeight ?? 1.2,
	letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
	textAlign: (s.align as "left" | "center" | "right") ?? "center",
	padding: s.padding,
	WebkitTextStroke:
		s.strokeWidth && s.stroke ? `${s.strokeWidth}px ${s.stroke}` : undefined,
	paintOrder: "stroke fill",
});

export const calculateLayerTransform = (
	layer: ExtendedLayer,
	frame: number,
	fps: number,
	viewport: { w: number; h: number },
) => {
	const relativeFrame = frame - (layer.startFrame ?? 0);
	let x = layer.x;
	let y = layer.y;
	let scale = layer.scale ?? 1;
	let rotation = layer.rotation;
	let opacity = layer.opacity ?? 1;
	const volume = layer.volume ?? 1;
	const duration = Math.round(
		((layer.durationInMS || DEFAULT_DURATION_MS) / 1000) * fps,
	);
	const animations = layer.animations ?? [];
	if (animations.length === 0)
		return { x, y, scale, rotation, opacity, volume };

	animations.forEach((anim) => {
		const durFrames = anim.value * fps;
		const isOut = anim.type.includes("-out");
		const startAnimFrame = isOut ? duration - durFrames : 0;
		const endAnimFrame = isOut ? duration : durFrames;
		if (relativeFrame < startAnimFrame || relativeFrame > endAnimFrame) return;

		const progress = interpolate(
			relativeFrame,
			[startAnimFrame, endAnimFrame],
			[0, 1],
			{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
		);

		switch (anim.type) {
			case "fade-in":
				opacity *= progress;
				break;
			case "fade-out":
				opacity *= 1 - progress;
				break;
			case "slide-in-left":
				x += -1 * viewport.w * (1 - progress);
				break;
			case "slide-in-right":
				x += 1 * viewport.w * (1 - progress);
				break;
			case "slide-in-top":
				y += -1 * viewport.h * (1 - progress);
				break;
			case "slide-in-bottom":
				y += 1 * viewport.h * (1 - progress);
				break;
			case "zoom-in":
				scale *= interpolate(progress, [0, 1], [0, 1]);
				break;
			case "zoom-out":
				scale *= interpolate(progress, [0, 1], [1, 0]);
				break;
			case "rotate-cw":
				rotation += 360 * progress;
				break;
			case "rotate-ccw":
				rotation += -360 * progress;
				break;
			case "bounce": {
				const bounceVal = spring({
					frame: relativeFrame - startAnimFrame,
					fps,
					config: { damping: 10, mass: 0.5, stiffness: 100 },
					durationInFrames: durFrames,
				});
				scale *= bounceVal;
				break;
			}
			case "shake": {
				const intensity = 20;
				x +=
					intensity *
					Math.sin((relativeFrame * 10 * 2 * Math.PI) / durFrames) *
					(1 - progress);
				break;
			}
		}
	});

	return { x, y, scale, rotation, opacity, volume };
};

const compareVirtualMedia = (
	a: VirtualMediaData | undefined,
	b: VirtualMediaData | undefined,
): boolean => {
	if (a === b) return true;
	if (!a || !b) return false;
	const aOp = a.operation;
	const bOp = b.operation;
	if (aOp?.op !== bOp?.op) return false;

	switch (aOp.op) {
		case "source": {
			if (bOp.op !== "source") return false;
			if (aOp.source?.processData?.dataUrl !== bOp.source?.processData?.dataUrl)
				return false;
			break;
		}
		case "text": {
			if (bOp.op !== "text") return false;
			if (aOp.text !== bOp.text) return false;
			break;
		}
		case "crop": {
			if (bOp.op !== "crop") return false;
			if (
				aOp.leftPercentage !== bOp.leftPercentage ||
				aOp.topPercentage !== bOp.topPercentage ||
				aOp.widthPercentage !== bOp.widthPercentage ||
				aOp.heightPercentage !== bOp.heightPercentage
			)
				return false;
			break;
		}
		case "cut": {
			if (bOp.op !== "cut") return false;
			if (aOp.startSec !== bOp.startSec || aOp.endSec !== bOp.endSec)
				return false;
			break;
		}
		case "filter": {
			if (bOp.op !== "filter") return false;
			if (
				JSON.stringify(aOp.filters.cssFilters) !==
				JSON.stringify(bOp.filters.cssFilters)
			)
				return false;
			break;
		}
		case "layer": {
			if (bOp.op !== "layer") return false;
			if (
				aOp.x !== bOp.x ||
				aOp.y !== bOp.y ||
				aOp.width !== bOp.width ||
				aOp.height !== bOp.height ||
				aOp.rotation !== bOp.rotation ||
				aOp.scale !== bOp.scale ||
				aOp.opacity !== bOp.opacity ||
				aOp.startFrame !== bOp.startFrame ||
				aOp.durationInMS !== bOp.durationInMS ||
				aOp.zIndex !== bOp.zIndex ||
				aOp.text !== bOp.text ||
				aOp.fontSize !== bOp.fontSize ||
				aOp.fontFamily !== bOp.fontFamily ||
				aOp.fontStyle !== bOp.fontStyle ||
				aOp.fontWeight !== bOp.fontWeight ||
				aOp.textDecoration !== bOp.textDecoration ||
				aOp.textShadow !== bOp.textShadow ||
				aOp.fill !== bOp.fill ||
				aOp.align !== bOp.align ||
				aOp.verticalAlign !== bOp.verticalAlign ||
				aOp.letterSpacing !== bOp.letterSpacing ||
				aOp.lineHeight !== bOp.lineHeight ||
				aOp.padding !== bOp.padding ||
				aOp.stroke !== bOp.stroke ||
				aOp.strokeWidth !== bOp.strokeWidth ||
				aOp.backgroundColor !== bOp.backgroundColor ||
				aOp.borderColor !== bOp.borderColor ||
				aOp.borderWidth !== bOp.borderWidth ||
				aOp.borderRadius !== bOp.borderRadius ||
				aOp.autoDimensions !== bOp.autoDimensions ||
				aOp.speed !== bOp.speed ||
				aOp.lottieLoop !== bOp.lottieLoop ||
				aOp.lottieFrameRate !== bOp.lottieFrameRate ||
				aOp.lottieDurationMs !== bOp.lottieDurationMs ||
				JSON.stringify(aOp.animations) !== JSON.stringify(bOp.animations)
			)
				return false;
			break;
		}
		case "compose": {
			if (bOp.op !== "compose") return false;
			if (
				aOp.width !== bOp.width ||
				aOp.height !== bOp.height ||
				aOp.fps !== bOp.fps ||
				(aOp as any).durationInMS !== (bOp as any).durationInMS
			)
				return false;
			if (a.children.length !== b.children.length) return false;
			for (let i = 0; i < a.children.length; i++) {
				if (!compareVirtualMedia(a.children[i], b.children[i])) return false;
			}
			return true;
		}
	}

	if (
		a.metadata.width !== b.metadata.width ||
		a.metadata.height !== b.metadata.height ||
		a.metadata.fps !== b.metadata.fps ||
		a.metadata.durationMs !== b.metadata.durationMs
	)
		return false;
	if (a.children.length !== b.children.length) return false;
	if (a.children.length > 0)
		return compareVirtualMedia(a.children[0], b.children[0]);
	return true;
};

export const SingleClipComposition: React.FC<{
	virtualMedia: VirtualMediaData;
	volume?: number;
	playbackRateOverride?: number;
	trimStartOverride?: number;
	textStyle?: Partial<ExtendedLayer>;
	containerWidth: number;
	containerHeight: number;
}> = ({
	virtualMedia,
	volume = 1,
	playbackRateOverride,
	trimStartOverride,
	textStyle,
	containerWidth,
	containerHeight,
}) => {
	const { fps } = useVideoConfig();
	const op = virtualMedia?.operation;

	if (op.op === "compose") {
		const composeDuration = (op as any).durationInMS || DEFAULT_DURATION_MS;
		const composeNode = (
			<CompositionScene
				layers={
					(virtualMedia.children || [])
						.map((child, index) => {
							const childOp = child.operation;
							if (!childOp) return null;

							if (childOp.op === "layer") {
								const lop = childOp;
								const contentType = getMediaType(child.children[0]);
								return {
									id: `child-${index}`,
									type: contentType,
									virtualMedia: child.children[0],
									x: lop.x,
									y: lop.y,
									width: lop.width,
									height: lop.height,
									rotation: lop.rotation,
									scale: lop.scale,
									opacity: lop.opacity,
									startFrame: lop.startFrame,
									durationInMS: lop.durationInMS || composeDuration,
									zIndex: lop.zIndex,
									trimStart: lop.trimStart,
									trimEnd: lop.trimEnd,
									speed: lop.speed,
									text: lop.text,
									fontSize: lop.fontSize,
									fontFamily: lop.fontFamily,
									fontStyle: lop.fontStyle,
									fontWeight: lop.fontWeight,
									textDecoration: lop.textDecoration,
									textShadow: lop.textShadow,
									fill: lop.fill,
									align: lop.align,
									verticalAlign: lop.verticalAlign,
									letterSpacing: lop.letterSpacing,
									lineHeight: lop.lineHeight,
									padding: lop.padding,
									stroke: lop.stroke,
									strokeWidth: lop.strokeWidth,
									backgroundColor: lop.backgroundColor,
									borderColor: lop.borderColor,
									borderWidth: lop.borderWidth,
									borderRadius: lop.borderRadius,
									autoDimensions: lop.autoDimensions,
									lottieLoop: lop.lottieLoop,
									lottieFrameRate: lop.lottieFrameRate,
									lottieDurationMs: lop.lottieDurationMs,
									animations: lop.animations,
									...textStyle,
									captionPreset: (lop as any).captionPreset,
									useRoundedTextBox: (lop as any).useRoundedTextBox,
								} as ExtendedLayer;
							}

							if (childOp.op === "source" || childOp.op === "text") {
								const contentType = getMediaType(child);
								const childMeta = getActiveMediaMetadata(child);
								const childWidth = childMeta?.width ?? op.width;
								const childHeight = childMeta?.height ?? op.height;
								const childDuration =
									childMeta?.durationMs ??
									composeDuration ??
									DEFAULT_DURATION_MS;
								return {
									id: `child-${index}`,
									type: contentType,
									virtualMedia: child,
									x: 0,
									y: 0,
									width: childWidth,
									height: childHeight,
									rotation: 0,
									scale: 1,
									opacity: 1,
									startFrame: 0,
									durationInMS: childDuration,
									zIndex: index,
								} as ExtendedLayer;
							}

							return null;
						})
						.filter(Boolean) as ExtendedLayer[]
				}
				viewportWidth={op.width}
				viewportHeight={op.height}
				containerWidth={containerWidth}
				containerHeight={containerHeight}
			/>
		);
		const trimFrames = trimStartOverride
			? Math.floor(trimStartOverride * fps)
			: 0;
		if (trimFrames > 0)
			return (
				<Sequence from={-trimFrames} layout="none">
					{composeNode}
				</Sequence>
			);
		return composeNode;
	}

	if (op.op === "source" || op.op === "text") {
		const params = computeRenderParams(virtualMedia);

		if (isLottieSource(virtualMedia)) {
			if (!params.sourceUrl) return <AbsoluteFill />;
			const finalPlaybackRate =
				(Number(playbackRateOverride) || 1) * (Number(params.speed) || 1);
			const lottieLoop = textStyle?.lottieLoop ?? true;
			return (
				<LottieFromUrl
					src={params.sourceUrl}
					loop={lottieLoop}
					playbackRate={finalPlaybackRate}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
					}}
				/>
			);
		}

		const mediaType = getMediaType(virtualMedia);

		if (mediaType === "Text") {
			const mergedStyle = { ...textStyle, ...(op as any) };
			const textContent =
				op.op === "text" && op.text
					? op.text
					: op.op === "source" && op.source?.processData?.text
						? op.source.processData.text
						: mergedStyle.text;

			if ((mergedStyle as any).useRoundedTextBox && textContent) {
				return (
					<RoundedTextRenderer
						text={textContent}
						fill={mergedStyle.fill as string | undefined}
						fontSize={mergedStyle.fontSize as number | undefined}
						fontFamily={mergedStyle.fontFamily as string | undefined}
						fontWeight={mergedStyle.fontWeight}
						fontStyle={mergedStyle.fontStyle as string | undefined}
						textShadow={mergedStyle.textShadow as string | undefined}
						textDecoration={mergedStyle.textDecoration as string | undefined}
						lineHeight={mergedStyle.lineHeight as number | undefined}
						letterSpacing={mergedStyle.letterSpacing as number | undefined}
						align={mergedStyle.align as "left" | "center" | "right" | undefined}
						verticalAlign={mergedStyle.verticalAlign as string | undefined}
						padding={mergedStyle.padding as number | undefined}
						borderRadius={mergedStyle.borderRadius as number | undefined}
						backgroundColor={mergedStyle.backgroundColor as string | undefined}
						stroke={mergedStyle.stroke as string | undefined}
						strokeWidth={mergedStyle.strokeWidth as number | undefined}
					/>
				);
			}

			return (
				<div
					style={{
						...buildLayerTextStyle(mergedStyle),
						width: "100%",
						height: "100%",
						display: "flex",
						flexDirection: "column",
						alignItems: "stretch",
						justifyContent: verticalAlignToJustify(mergedStyle.verticalAlign),
						whiteSpace: "pre",
					}}
				>
					{textContent}
				</div>
			);
		}

		if (!params.sourceUrl) return <AbsoluteFill />;

		const finalPlaybackRate =
			(Number(playbackRateOverride) || 1) * (Number(params.speed) || 1);
		const effectiveTrimSec =
			(trimStartOverride ?? 0) + (Number(params.trimStartSec) || 0);
		const startFrame = Math.floor(effectiveTrimSec * fps);

		if (mediaType === "Audio")
			return (
				<Audio
					src={params.sourceUrl}
					trimBefore={startFrame}
					playbackRate={finalPlaybackRate}
					volume={volume}
				/>
			);

		if (isStaticVisualMedia(mediaType))
			return (
				<Img
					src={params.sourceUrl}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						objectFit: "fill",
					}}
				/>
			);

		if (mediaType === "Lottie") {
			const lottieLoop = textStyle?.lottieLoop ?? true;
			return (
				<LottieFromUrl
					src={params.sourceUrl}
					loop={lottieLoop}
					playbackRate={finalPlaybackRate}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
					}}
				/>
			);
		}

		return (
			<Video
				src={params.sourceUrl}
				playbackRate={finalPlaybackRate}
				trimBefore={startFrame}
				volume={volume}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					objectFit: "fill",
					display: "block",
				}}
			/>
		);
	}

	if (op.op === "speed") {
		const childVideo = virtualMedia.children[0];
		if (!childVideo) return null;
		return (
			<SingleClipComposition
				virtualMedia={childVideo}
				volume={volume}
				playbackRateOverride={
					(Number(playbackRateOverride) || 1) * (Number(op.rate) || 1)
				}
				trimStartOverride={trimStartOverride}
				textStyle={textStyle}
				containerWidth={containerWidth}
				containerHeight={containerHeight}
			/>
		);
	}

	if (op.op === "cut") {
		const childVideo = virtualMedia.children[0];
		if (!childVideo) return null;
		return (
			<SingleClipComposition
				virtualMedia={childVideo}
				volume={volume}
				playbackRateOverride={playbackRateOverride}
				trimStartOverride={(trimStartOverride ?? 0) + (op.startSec ?? 0)}
				textStyle={textStyle}
				containerWidth={containerWidth}
				containerHeight={containerHeight}
			/>
		);
	}

	const childVideo = virtualMedia.children[0];
	let childContainerWidth = containerWidth;
	let childContainerHeight = containerHeight;
	if (op.op === "crop") {
		const wp = Math.max(0.01, Number(op.widthPercentage) || 100);
		const hp = Math.max(0.01, Number(op.heightPercentage) || 100);
		childContainerWidth = containerWidth * (100 / wp);
		childContainerHeight = containerHeight * (100 / hp);
	}

	const content = childVideo ? (
		<SingleClipComposition
			virtualMedia={childVideo}
			volume={volume}
			playbackRateOverride={playbackRateOverride}
			trimStartOverride={trimStartOverride}
			textStyle={
				op.op === "layer" ? { ...textStyle, ...(op as any) } : textStyle
			}
			containerWidth={childContainerWidth}
			containerHeight={childContainerHeight}
		/>
	) : null;

	if (op.op === "crop") {
		const wp = Math.max(0.01, Number(op.widthPercentage) || 100);
		const hp = Math.max(0.01, Number(op.heightPercentage) || 100);
		const lp = Number(op.leftPercentage) || 0;
		const tp = Number(op.topPercentage) || 0;
		const innerWidth = (100 / wp) * 100;
		const innerHeight = (100 / hp) * 100;
		const innerLeft = (lp / wp) * 100;
		const innerTop = (tp / hp) * 100;
		return (
			<AbsoluteFill style={{ overflow: "hidden" }}>
				<div
					style={{
						position: "absolute",
						width: `${innerWidth}%`,
						height: `${innerHeight}%`,
						left: `-${innerLeft}%`,
						top: `-${innerTop}%`,
					}}
					key={`crop-${wp}-${hp}-${lp}-${tp}`}
				>
					<AbsoluteFill>{content}</AbsoluteFill>
				</div>
			</AbsoluteFill>
		);
	}

	let transformStr: string | undefined;
	let cssFilterString: string | undefined;
	if (op.op === "rotate") {
		transformStr = `rotate(${(op as any).degrees}deg)`;
	} else if (op.op === "flip") {
		const transforms: string[] = [];
		if (op.horizontal) transforms.push("scaleX(-1)");
		if (op.vertical) transforms.push("scaleY(-1)");
		transformStr = transforms.length ? transforms.join(" ") : undefined;
	} else if (op.op === "filter") {
		cssFilterString = buildCSSFilterString((op as any).filters.cssFilters);
	}

	return (
		<AbsoluteFill style={{ filter: cssFilterString, transform: transformStr }}>
			{content}
		</AbsoluteFill>
	);
};

const LayerContentRenderer: React.FC<{
	layer: ExtendedLayer;
	animVolume: number;
	viewport: { w: number; h: number };
}> = ({ layer, animVolume, viewport }) => {
	const cWidth = layer.width ?? viewport.w;
	const cHeight = layer.height ?? viewport.h;

	// editor-only flag carried through the layer shape at runtime
	const useRoundedBox = (layer as any).useRoundedTextBox === true;

	if (layer.type === "Video" && layer.virtualMedia)
		return (
			<SingleClipComposition
				virtualMedia={layer.virtualMedia}
				volume={animVolume}
				playbackRateOverride={layer.speed}
				trimStartOverride={layer.trimStart}
				textStyle={layer}
				containerWidth={cWidth}
				containerHeight={cHeight}
			/>
		);

	if (isStaticVisualMedia(layer.type) && (layer.src || layer.virtualMedia)) {
		if (layer.virtualMedia)
			return (
				<SingleClipComposition
					virtualMedia={layer.virtualMedia}
					volume={animVolume}
					trimStartOverride={layer.trimStart}
					textStyle={layer}
					containerWidth={cWidth}
					containerHeight={cHeight}
				/>
			);
		return (
			<Img
				src={layer.src!}
				style={{ width: "100%", height: "100%", objectFit: "fill" }}
			/>
		);
	}

	if (layer.type === "Lottie") {
		const loop = layer.lottieLoop ?? true;
		const playbackRate = layer.speed ?? 1;
		if (layer.virtualMedia) {
			const params = computeRenderParams(layer.virtualMedia);
			if (params.sourceUrl)
				return (
					<LottieFromUrl
						src={params.sourceUrl}
						loop={loop}
						playbackRate={playbackRate}
						style={{ width: "100%", height: "100%" }}
					/>
				);
		}
		if (layer.src)
			return (
				<LottieFromUrl
					src={layer.src}
					loop={loop}
					playbackRate={playbackRate}
					style={{ width: "100%", height: "100%" }}
				/>
			);
	}

	if (layer.type === "Audio" && (layer.src || layer.virtualMedia)) {
		if (layer.virtualMedia)
			return (
				<SingleClipComposition
					virtualMedia={layer.virtualMedia}
					volume={animVolume}
					playbackRateOverride={layer.speed}
					trimStartOverride={layer.trimStart}
					textStyle={layer}
					containerWidth={cWidth}
					containerHeight={cHeight}
				/>
			);
		return <Audio src={layer.src!} volume={animVolume} />;
	}

	if (layer.type === "Text" && (layer.text || layer.virtualMedia)) {
		if (layer.virtualMedia)
			return (
				<SingleClipComposition
					virtualMedia={layer.virtualMedia}
					volume={animVolume}
					trimStartOverride={layer.trimStart}
					textStyle={layer}
					containerWidth={cWidth}
					containerHeight={cHeight}
				/>
			);

		if (useRoundedBox && layer.text) {
			return (
				<RoundedTextRenderer
					text={layer.text}
					fill={layer.fill}
					fontSize={layer.fontSize}
					fontFamily={layer.fontFamily}
					fontWeight={layer.fontWeight}
					fontStyle={layer.fontStyle}
					textDecoration={layer.textDecoration}
					textShadow={layer.textShadow}
					lineHeight={layer.lineHeight}
					letterSpacing={layer.letterSpacing}
					align={layer.align as "left" | "center" | "right" | undefined}
					verticalAlign={layer.verticalAlign}
					padding={layer.padding}
					borderRadius={layer.borderRadius}
					backgroundColor={layer.backgroundColor}
					stroke={layer.stroke}
					strokeWidth={layer.strokeWidth}
				/>
			);
		}

		return (
			<div
				style={{
					...buildLayerTextStyle(layer),
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: verticalAlignToJustify(layer.verticalAlign),
					whiteSpace: "pre",
				}}
			>
				{layer.text}
			</div>
		);
	}

	if (layer.type === "Caption") {
		const preset = (layer as any).captionPreset || "default";
		let captionSrc = layer.src;
		if (!captionSrc && layer.virtualMedia) {
			const params = computeRenderParams(layer.virtualMedia);
			captionSrc = params.sourceUrl;
		}
		if (captionSrc) {
			return (
				<CaptionsFromUrl
					src={captionSrc}
					useRoundedTextBox={useRoundedBox}
					style={
						{
							...buildLayerTextStyle(layer),
							verticalAlign: layer.verticalAlign ?? "bottom",
							// Pill fill colour for rounded box (default preset)
							...(layer.backgroundColor
								? { captionBackgroundColor: layer.backgroundColor }
								: {}),
						} as React.CSSProperties
					}
					preset={preset}
				/>
			);
		}
	}

	return null;
};

export const LayerRenderer: React.FC<{
	layer: ExtendedLayer;
	viewport: { w: number; h: number };
}> = ({ layer, viewport }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const startFrame = layer.startFrame ?? 0;
	const duration = Math.round(
		((layer.durationInMS || DEFAULT_DURATION_MS) / 1000) * fps,
	);
	const {
		x: animX,
		y: animY,
		scale: animScale,
		rotation: animRotation,
		opacity: animOpacity,
		volume: animVolume,
	} = calculateLayerTransform(layer, frame, fps, viewport);

	// When useRoundedTextBox is active the SVG pill owns the background, so we
	// suppress the outer div's backgroundColor and borderRadius to avoid double
	// styling (a plain rect behind the shaped SVG would look wrong).
	const useRoundedBox =
		(layer.type === "Text" || layer.type === "Caption") &&
		(layer as any).useRoundedTextBox === true;

	const style: React.CSSProperties = {
		position: "absolute",
		left: animX,
		top: animY,
		width: layer.width ?? "100%",
		height: layer.height ?? "100%",
		transform: `rotate(${animRotation}deg) scale(${animScale})`,
		transformOrigin: "center center",
		opacity: animOpacity,
		// Pill owns background when rounded text box is active.
		backgroundColor: useRoundedBox ? undefined : layer.backgroundColor,
		borderColor: useRoundedBox ? undefined : layer.borderColor,
		borderWidth: useRoundedBox ? undefined : layer.borderWidth,
		borderRadius: useRoundedBox ? undefined : layer.borderRadius,
		borderStyle: !useRoundedBox && layer.borderWidth ? "solid" : undefined,
		overflow: "hidden",
		boxSizing: "border-box",
	};

	const filterString = (() => {
		const cf = layer.filters?.cssFilters;
		if (!cf) return undefined;
		return buildCSSFilterString(cf);
	})();

	return (
		<Sequence from={startFrame} durationInFrames={duration} layout="none">
			<div style={{ ...style, filter: filterString }}>
				<AbsoluteFill>
					<LayerContentRenderer
						layer={layer}
						animVolume={animVolume}
						viewport={viewport}
					/>
				</AbsoluteFill>
			</div>
		</Sequence>
	);
};

export interface SceneProps {
	layers?: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
	containerWidth?: number;
	containerHeight?: number;
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "SVG" | "Text" | "Lottie" | string;
	data?: unknown;
	virtualMedia?: VirtualMediaData;
	durationInMS?: number;
	backgroundColor?: string;
	animations?: VideoAnimation[];
	opacity?: number;
	volume?: number;
	scale?: number;
	rotation?: number;
	x?: number;
	y?: number;
}

export const CompositionScene: React.FC<SceneProps> = ({
	layers = [],
	viewportWidth,
	viewportHeight,
	containerWidth,
	containerHeight,
	src,
	isAudio,
	type,
	data,
	virtualMedia,
	durationInMS,
	backgroundColor,
	animations,
	opacity,
	volume,
	scale,
	rotation,
	x,
	y,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const resolvedLayers = (() => {
		if (layers.length > 0) return layers;

		if (virtualMedia?.operation?.op === "compose") {
			return null;
		}

		if (
			src ||
			virtualMedia ||
			type === "Text" ||
			type === "Lottie" ||
			type === "Caption"
		) {
			const resolvedType = type || (isAudio ? "Audio" : "Video");
			let resolvedDurationInMS = durationInMS;
			if (!resolvedDurationInMS && virtualMedia) {
				const activeMeta = getActiveMediaMetadata(virtualMedia);
				if (activeMeta?.durationMs)
					resolvedDurationInMS = activeMeta.durationMs;
			}
			const isCaption = resolvedType === "Caption";
			return [
				{
					id: "single-source-layer",
					type: resolvedType as any,
					src,
					virtualMedia,
					text:
						typeof data === "string"
							? data
							: (data as any)?.text || JSON.stringify(data),
					width: viewportWidth,
					height: viewportHeight,
					...(typeof data === "object" && data !== null ? data : {}),
					animations,
					opacity,
					volume,
					scale,
					rotation,
					x,
					y,
					// Caption defaults — display at bottom centre with readable styling
					...(isCaption
						? {
								fontSize: 48,
								fontFamily: "Inter",
								fill: "#ffffff",
								align: "center",
								verticalAlign: "bottom",
								padding: 20,
								lineHeight: 1.2,
							}
						: {}),
				} as ExtendedLayer,
			];
		}
		return [];
	})();

	const resolvedViewportW = viewportWidth || 1920;
	const resolvedViewportH = viewportHeight || 1080;
	const viewport = { w: resolvedViewportW, h: resolvedViewportH };
	const scaleX =
		containerWidth !== undefined ? containerWidth / resolvedViewportW : 1;
	const scaleY =
		containerHeight !== undefined ? containerHeight / resolvedViewportH : 1;

	if (resolvedLayers === null && virtualMedia?.operation?.op === "compose") {
		return (
			<AbsoluteFill
				style={{
					backgroundColor: backgroundColor ?? "#000000",
					overflow: "hidden",
					pointerEvents: "none",
				}}
			>
				<div
					style={{
						width: resolvedViewportW,
						height: resolvedViewportH,
						position: "absolute",
						top: 0,
						left: 0,
						transform: `scale(${scaleX}, ${scaleY})`,
						transformOrigin: "top left",
					}}
				>
					<SingleClipComposition
						virtualMedia={virtualMedia}
						containerWidth={resolvedViewportW}
						containerHeight={resolvedViewportH}
					/>
				</div>
			</AbsoluteFill>
		);
	}

	const layersToRender = [...(resolvedLayers || [])]
		.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
		.map((layer) => {
			let derivedWidth = layer.width;
			let derivedHeight = layer.height;
			if (layer.virtualMedia && layer.autoDimensions) {
				const activeMeta = getActiveMediaMetadata(layer.virtualMedia);
				derivedWidth = activeMeta?.width ?? derivedWidth;
				derivedHeight = activeMeta?.height ?? derivedHeight;
			}
			return { ...layer, width: derivedWidth, height: derivedHeight };
		});

	return (
		<AbsoluteFill
			style={{
				backgroundColor: backgroundColor ?? "#000000",
				overflow: "hidden",
				pointerEvents: "none",
			}}
		>
			<div
				style={{
					width: resolvedViewportW,
					height: resolvedViewportH,
					position: "absolute",
					top: 0,
					left: 0,
					transform: `scale(${scaleX}, ${scaleY})`,
					transformOrigin: "top left",
				}}
			>
				{layersToRender.map((layer) => {
					const startFrame = layer.startFrame ?? 0;
					const duration = Math.round(
						((layer.durationInMS || DEFAULT_DURATION_MS) / 1000) * fps,
					);
					const endFrame = startFrame + duration;
					if (frame < startFrame || frame >= endFrame) return null;
					return (
						<LayerRenderer key={layer.id} layer={layer} viewport={viewport} />
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
