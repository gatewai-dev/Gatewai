import { GetFontAssetUrl } from "@gatewai/core/browser";
import type {
	ExtendedLayer,
	VideoAnimation,
	VirtualMediaData,
} from "@gatewai/core/types";
import type { Caption } from "@remotion/captions";
import { createTikTokStyleCaptions, parseSrt } from "@remotion/captions";
import { measureText } from "@remotion/layout-utils";
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
	CAPTION_LAYER_DEFAULTS,
	DEFAULT_DURATION_MS,
	DEFAULT_MEDIA_DIMENSION,
	TEXT_LAYER_DEFAULTS,
} from "../rendering-defaults.js";
import {
	buildCSSFilterString,
	computeRenderParams,
} from "../utils/apply-operations.js";
import {
	getActiveMediaMetadata,
	getMediaType,
} from "../utils/resolve-video.js";

const isStaticVisualMedia = (type?: string): boolean =>
	type === "Image" || type === "SVG";

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
	textShadow?: string;
	padding?: number;
	borderRadius?: number;
	backgroundColor?: string;
	stroke?: string;
	strokeWidth?: number;
	maxWidth?: number;
}

const wrapTextLines = (
	text: string,
	maxWidth: number,
	fontFamily: string,
	fontSize: number,
	fontWeight: string,
	fontStyle: string,
): string[] => {
	const lines: string[] = [];
	const measure = (t: string) =>
		measureText({
			text: t,
			fontFamily,
			fontSize,
			fontVariantNumeric: "normal",
			fontWeight,
			letterSpacing: "normal",
			textTransform: "none",
			additionalStyles: { fontStyle, whiteSpace: "pre" },
		} as Parameters<typeof measureText>[0]).width;

	const paragraphs = text.split("\n");
	for (const para of paragraphs) {
		const tokens = para.split(" ");
		let currentTokens: string[] = [];
		let currentWidth = 0;

		for (const token of tokens) {
			const wordW = measure(token);
			const addW = currentTokens.length > 0 ? measure(" ") + wordW : wordW;

			if (currentTokens.length > 0 && currentWidth + addW > maxWidth) {
				lines.push(currentTokens.join(" "));
				currentTokens = [token];
				currentWidth = wordW;
			} else {
				currentTokens.push(token);
				currentWidth += addW;
			}
		}

		if (currentTokens.length > 0) {
			lines.push(currentTokens.join(" "));
		}
	}

	return lines;
};

const RoundedTextRenderer: React.FC<RoundedTextRendererProps> = ({
	text,
	fill = "#ffffff",
	fontSize = 40,
	fontFamily = "Inter",
	fontWeight = "normal",
	fontStyle = "normal",
	textDecoration = "none",
	lineHeight = 1.2,
	letterSpacing,
	align = "center",
	padding = 16,
	borderRadius = 8,
	backgroundColor = "rgba(0,0,0,0.7)",
	stroke,
	strokeWidth,
	textShadow,
	maxWidth,
}) => {
	const fw = String(fontWeight);

	const lines = useMemo(() => {
		if (maxWidth) {
			return wrapTextLines(text, maxWidth, fontFamily, fontSize, fw, fontStyle);
		}
		return text.split("\n");
	}, [text, maxWidth, fontFamily, fontSize, fw, fontStyle]);

	const textMeasurements = useMemo(() => {
		return lines.map((line) =>
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
					whiteSpace: "pre",
				},
			} as Parameters<typeof measureText>[0]),
		);
	}, [
		lines,
		fontFamily,
		fontSize,
		fw,
		fontStyle,
		lineHeight,
		letterSpacing,
		textDecoration,
	]);

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
		background: "none",
	};

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems:
					align === "right"
						? "flex-end"
						: align === "left"
							? "flex-start"
							: "center",
				justifyContent: "flex-start",
			}}
		>
			<div style={{ position: "relative", width: boundingBox.width }}>
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
					{lines.map((line, i) => (
						<div key={i} style={lineStyle}>
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
			additionalStyles: { fontStyle, whiteSpace: "pre" },
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
						whiteSpace: "pre",
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
							whiteSpace: "pre",
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
	const config = useVideoConfig();
	const fps = Math.max(1, config.fps);
	const compositionWidth = config.width;

	useEffect(() => {
		const handle = delayRender(`Loading Captions from: ${src}`);
		let isCancelled = false;

		fetch(src)
			.then((res) => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.text();
			})
			.then((text) => {
				if (isCancelled) return;
				try {
					const { captions: parsed } = parseSrt({ input: text });
					setCaptions(parsed);
				} catch (e) {
					console.error("Failed to parse SRT", e);
					setCaptions([]);
				}
			})
			.catch((err) => {
				if (!isCancelled) {
					cancelRender(err instanceof Error ? err : new Error(String(err)));
				}
			})
			.finally(() => {
				continueRender(handle);
			});

		return () => {
			isCancelled = true;
		};
	}, [src]);

	const tikTokPages = useMemo(() => {
		if (!captions || preset !== "tiktok") return null;
		if (captions.length === 0) return [];

		const totalWords = captions.reduce(
			(acc, c) => acc + c.text.trim().split(/\s+/).filter(Boolean).length,
			0,
		);
		const isWordLevel = totalWords / captions.length < 2.5;

		if (isWordLevel) {
			const { pages } = createTikTokStyleCaptions({
				captions,
				combineTokensWithinMilliseconds: 1200,
			});
			return pages;
		}

		return captions.map((c) => {
			const words = c.text.trim().split(/\s+/).filter(Boolean);
			const durationMs = c.endMs - c.startMs;
			const timePerWord = durationMs / Math.max(1, words.length);

			const tokens = words.map((word, i) => ({
				text: word,
				fromMs: c.startMs + i * timePerWord,
				toMs: c.startMs + (i + 1) * timePerWord,
			}));

			return {
				startMs: c.startMs,
				durationMs: durationMs,
				text: c.text,
				tokens,
			};
		});
	}, [captions, preset]);

	if (!captions) return null;

	const currentTimeMs = (frame / fps) * 1000;

	const hAlign =
		style?.textAlign === "left"
			? "flex-start"
			: style?.textAlign === "right"
				? "flex-end"
				: "center";

	if (preset === "tiktok") {
		const fontFamily = style?.fontFamily || "Impact, sans-serif";
		const fontSize = style?.fontSize || 60;
		const fontWeight = String(style?.fontWeight ?? "700");
		const fontStyle = style?.fontStyle || "normal";
		const textDecoration = style?.textDecoration || "none";
		const lineHeight = Number(style?.lineHeight) || 1.35;
		const activeColor = style?.color || "#FFFC00";
		const textColor = "white";
		const backgroundColor = style?.backgroundColor ?? "rgba(0,0,0,0.72)";
		const horizontalPadding =
			style?.padding !== undefined ? Number(style.padding) : 22;
		const borderRadius =
			style?.borderRadius !== undefined ? Number(style.borderRadius) : 12;

		const page = tikTokPages?.find(
			(p) =>
				currentTimeMs >= p.startMs && currentTimeMs < p.startMs + p.durationMs,
		);
		if (!page) return null;

		const maxWidth = compositionWidth * 0.8 - horizontalPadding * 2;

		return (
			<AbsoluteFill
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: hAlign,
					justifyContent: "flex-end",
					// Removed the padding line here!
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
		const fontSize = style?.fontSize ?? 48;
		const fontFamily = style?.fontFamily ?? "Inter";
		const fontWeight = String(style?.fontWeight ?? "normal");
		const fontStyle = style?.fontStyle ?? "normal";
		const textDecoration = style?.textDecoration ?? "none";
		const textShadow = style?.textShadow ?? undefined;
		const lineHeight = Number(style?.lineHeight ?? 1.2);
		const letterSpacing = style?.letterSpacing
			? Number.parseFloat(String(style.letterSpacing))
			: undefined;
		const fill = style?.color ?? "#ffffff";
		const backgroundColor = style?.backgroundColor ?? "rgba(0,0,0,0.7)";
		const padding = style?.padding
			? Number.parseFloat(String(style.padding))
			: 16;
		const borderRadius =
			style?.borderRadius !== undefined ? Number(style.borderRadius) : 8; // Use the dynamic value
		const align = (style?.textAlign as "left" | "center" | "right") ?? "center";
		const stroke = style?.WebkitTextStroke
			? String(style.WebkitTextStroke).split(" ").slice(1).join(" ")
			: undefined;
		const strokeWidth = style?.WebkitTextStroke
			? Number.parseFloat(String(style.WebkitTextStroke))
			: undefined;
		const maxWidthVal = compositionWidth * 0.8 - padding * 2;

		return (
			<AbsoluteFill
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: hAlign,
					justifyContent: "flex-end",
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
					padding={padding}
					borderRadius={borderRadius}
					backgroundColor={backgroundColor}
					stroke={stroke}
					strokeWidth={strokeWidth}
					maxWidth={maxWidthVal}
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
				justifyContent: "flex-end",
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
					whiteSpace: "pre-wrap",
				}}
			>
				{currentCaption.text}
			</span>
		</div>
	);
};

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
	textAlign: (s.align as "left" | "center" | "right") ?? "left",
	padding: s.padding,
	WebkitTextStroke:
		s.strokeWidth && s.stroke ? `${s.strokeWidth}px ${s.stroke}` : undefined,
	paintOrder: "stroke fill",
	whiteSpace: "pre",
});

export const resolveLayerDuration = (
	layerDurationInMS?: number,
	metaDurationMs?: number,
	defaultDuration: number = DEFAULT_DURATION_MS,
): number => {
	if (layerDurationInMS && metaDurationMs) {
		return Math.min(layerDurationInMS, metaDurationMs);
	}
	return layerDurationInMS || metaDurationMs || defaultDuration;
};

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

	const layerDurationMs = resolveLayerDuration(
		layer.durationInMS,
		layer.virtualMedia?.metadata?.durationMs,
		DEFAULT_DURATION_MS,
	);

	const duration = Math.round((layerDurationMs / 1000) * fps);
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
				aOp.metadata?.durationMs !== bOp.metadata?.durationMs
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
	trimEndOverride?: number;
	textStyle?: Partial<ExtendedLayer>;
	containerWidth: number;
	containerHeight: number;
}> = ({
	virtualMedia,
	volume = 1,
	playbackRateOverride,
	trimStartOverride,
	trimEndOverride,
	textStyle,
	containerWidth,
	containerHeight,
}) => {
	const { fps: rawFps } = useVideoConfig();
	const fps = Math.max(1, rawFps);
	const op = virtualMedia?.operation;
	if (!op) return null;

	if (op.op === "compose") {
		const composeDuration = op.metadata?.durationMs ?? DEFAULT_DURATION_MS;
		const composeNode = (
			<CompositionScene
				layers={
					(virtualMedia.children || [])
						.filter((child) => child?.operation)
						.map((child, index) => {
							const childOp = child.operation;

							if (childOp.op === "layer") {
								const lop = childOp;
								const childVirtualMedia = child.children?.[0];
								const contentType = getMediaType(childVirtualMedia);
								const childMeta = getActiveMediaMetadata(childVirtualMedia);

								return {
									...textStyle,

									id: `child-${index}`,
									type: contentType,
									virtualMedia: childVirtualMedia,

									x: lop.x ?? textStyle?.x ?? 0,
									y: lop.y ?? textStyle?.y ?? 0,
									width: lop.width ?? textStyle?.width,
									height: lop.height ?? textStyle?.height,
									rotation: lop.rotation ?? textStyle?.rotation ?? 0,
									scale: lop.scale ?? textStyle?.scale ?? 1,
									opacity: lop.opacity ?? textStyle?.opacity ?? 1,
									startFrame: lop.startFrame ?? textStyle?.startFrame ?? 0,

									durationInMS: resolveLayerDuration(
										lop.durationInMS ?? textStyle?.durationInMS,
										childMeta?.durationMs,
										composeDuration,
									),

									zIndex: lop.zIndex ?? textStyle?.zIndex ?? index,
									trimStart: lop.trimStart ?? textStyle?.trimStart,
									trimEnd: lop.trimEnd ?? textStyle?.trimEnd,
									speed: lop.speed ?? textStyle?.speed,

									text: lop.text ?? textStyle?.text,
									fontSize: lop.fontSize ?? textStyle?.fontSize,
									fontFamily: lop.fontFamily ?? textStyle?.fontFamily,
									fontStyle: lop.fontStyle ?? textStyle?.fontStyle,
									fontWeight: lop.fontWeight ?? textStyle?.fontWeight,
									textDecoration:
										lop.textDecoration ?? textStyle?.textDecoration,
									textShadow: lop.textShadow ?? textStyle?.textShadow,
									fill: lop.fill ?? textStyle?.fill,
									align: lop.align ?? textStyle?.align,
									letterSpacing: lop.letterSpacing ?? textStyle?.letterSpacing,
									lineHeight: lop.lineHeight ?? textStyle?.lineHeight,
									padding: lop.padding ?? textStyle?.padding,
									stroke: lop.stroke ?? textStyle?.stroke,
									strokeWidth: lop.strokeWidth ?? textStyle?.strokeWidth,
									backgroundColor:
										lop.backgroundColor ?? textStyle?.backgroundColor,
									borderColor: lop.borderColor ?? textStyle?.borderColor,
									borderWidth: lop.borderWidth ?? textStyle?.borderWidth,
									borderRadius: lop.borderRadius ?? textStyle?.borderRadius,
									autoDimensions:
										lop.autoDimensions ?? textStyle?.autoDimensions,
									animations: lop.animations ?? textStyle?.animations,

									captionPreset: lop.captionPreset ?? textStyle?.captionPreset,
									useRoundedTextBox:
										lop.useRoundedTextBox ?? textStyle?.useRoundedTextBox,
								} as ExtendedLayer;
							}

							const contentType = getMediaType(child);
							const childMeta = getActiveMediaMetadata(child);
							const childWidth = childMeta?.width ?? op.width;
							const childHeight = childMeta?.height ?? op.height;
							const childDuration = resolveLayerDuration(
								undefined,
								childMeta?.durationMs,
								composeDuration ?? DEFAULT_DURATION_MS,
							);

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
						})
						.filter(Boolean) as ExtendedLayer[]
				}
				viewportWidth={op.width}
				viewportHeight={op.height}
				containerWidth={containerWidth}
				containerHeight={containerHeight}
				backgroundColor={op.backgroundColor}
			/>
		);
		const trimFrames = trimStartOverride
			? Math.max(0, Math.floor(trimStartOverride * fps))
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
		const mediaType = getMediaType(virtualMedia);

		if (mediaType === "Text") {
			const mergedStyle = { ...textStyle, ...op };
			const textContent =
				op.op === "text" && op.text
					? op.text
					: op.op === "source" && op.source?.processData?.text
						? op.source.processData.text
						: mergedStyle.text;

			if (mergedStyle.useRoundedTextBox && textContent) {
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
						justifyContent: "flex-start",
					}}
				>
					{textContent}
				</div>
			);
		}

		if (!params.sourceUrl) return <AbsoluteFill />;

		const finalPlaybackRate = Math.max(
			0.01,
			(Number(playbackRateOverride) || 1) * (Number(params.speed) || 1),
		);

		const effectiveTrimSec = Math.max(
			0,
			(Number(trimStartOverride) || 0) + (Number(params.trimStartSec) || 0),
		);
		const startFrame = Math.floor(effectiveTrimSec * fps);

		const mappedTrimEndParams =
			params.trimEndSec !== undefined && params.trimEndSec !== null
				? Number(params.trimEndSec)
				: undefined;
		const effectiveTrimEndSec = trimEndOverride ?? mappedTrimEndParams;

		let endFrame: number | undefined;
		if (
			effectiveTrimEndSec !== undefined &&
			!isNaN(effectiveTrimEndSec) &&
			effectiveTrimEndSec > effectiveTrimSec
		) {
			endFrame = Math.max(
				startFrame + 1,
				Math.floor(effectiveTrimEndSec * fps),
			);
		}

		if (mediaType === "Audio") {
			return (
				<Audio
					src={params.sourceUrl}
					startFrom={startFrame}
					endAt={endFrame}
					playbackRate={finalPlaybackRate}
					volume={volume}
				/>
			);
		}

		if (isStaticVisualMedia(mediaType)) {
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
		}

		return (
			<Video
				src={params.sourceUrl}
				playbackRate={finalPlaybackRate}
				startFrom={startFrame}
				endAt={endFrame}
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
		const childVideo = virtualMedia.children?.[0];
		if (!childVideo) return null;
		return (
			<SingleClipComposition
				virtualMedia={childVideo}
				volume={volume}
				playbackRateOverride={
					(Number(playbackRateOverride) || 1) * (Number(op.rate) || 1)
				}
				trimStartOverride={trimStartOverride}
				trimEndOverride={trimEndOverride}
				textStyle={textStyle}
				containerWidth={containerWidth}
				containerHeight={containerHeight}
			/>
		);
	}

	if (op.op === "cut") {
		const childVideo = virtualMedia.children?.[0];
		if (!childVideo) return null;

		const effectiveStart =
			(trimStartOverride ?? 0) + (Number(op.startSec) || 0);
		const effectiveEnd =
			op.endSec !== undefined
				? (trimStartOverride ?? 0) + Number(op.endSec)
				: trimEndOverride;

		return (
			<SingleClipComposition
				virtualMedia={childVideo}
				volume={volume}
				playbackRateOverride={playbackRateOverride}
				trimStartOverride={effectiveStart}
				trimEndOverride={effectiveEnd}
				textStyle={textStyle}
				containerWidth={containerWidth}
				containerHeight={containerHeight}
			/>
		);
	}

	const childVideo = virtualMedia.children?.[0];
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
			trimEndOverride={trimEndOverride}
			textStyle={op.op === "layer" ? { ...textStyle, ...op } : textStyle}
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
		transformStr = `rotate(${op.degrees}deg)`;
	} else if (op.op === "flip") {
		const transforms: string[] = [];
		if (op.horizontal) transforms.push("scaleX(-1)");
		if (op.vertical) transforms.push("scaleY(-1)");
		transformStr = transforms.length ? transforms.join(" ") : undefined;
	} else if (op.op === "filter" && op.filters?.cssFilters) {
		cssFilterString = buildCSSFilterString(op.filters.cssFilters);
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

	const useRoundedBox = layer.useRoundedTextBox === true;

	if (layer.type === "Video" && layer.virtualMedia)
		return (
			<SingleClipComposition
				virtualMedia={layer.virtualMedia}
				volume={animVolume}
				playbackRateOverride={layer.speed}
				trimStartOverride={layer.trimStart}
				trimEndOverride={layer.trimEnd}
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
					trimEndOverride={layer.trimEnd}
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

	if (layer.type === "Audio" && (layer.src || layer.virtualMedia)) {
		if (layer.virtualMedia)
			return (
				<SingleClipComposition
					virtualMedia={layer.virtualMedia}
					volume={animVolume}
					playbackRateOverride={layer.speed}
					trimStartOverride={layer.trimStart}
					trimEndOverride={layer.trimEnd}
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
					trimEndOverride={layer.trimEnd}
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
					justifyContent: "flex-start",
				}}
			>
				{layer.text}
			</div>
		);
	}

	if (layer.type === "Caption") {
		const preset = layer.captionPreset || "default";
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
							backgroundColor: layer.backgroundColor,
							borderRadius: layer.borderRadius, // Add this line
						} as React.CSSProperties & { borderRadius?: number }
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
	const config = useVideoConfig();
	const fps = Math.max(1, config.fps);
	const startFrame = Math.max(0, layer.startFrame ?? 0);

	const layerDurationMs = Math.max(
		1,
		resolveLayerDuration(
			layer.durationInMS,
			layer.virtualMedia?.metadata?.durationMs,
			DEFAULT_DURATION_MS,
		),
	);

	const duration = Math.max(1, Math.round((layerDurationMs / 1000) * fps));

	const {
		x: animX,
		y: animY,
		scale: animScale,
		rotation: animRotation,
		opacity: animOpacity,
		volume: animVolume,
	} = calculateLayerTransform(layer, frame, fps, viewport);

	const useRoundedBox =
		(layer.type === "Text" || layer.type === "Caption") &&
		layer.useRoundedTextBox === true;

	const style: React.CSSProperties = {
		position: "absolute",
		left: animX,
		top: animY,
		width: layer.width ?? (layer.type === "Text" ? "max-content" : "100%"),
		height: layer.height ?? (layer.type === "Text" ? "max-content" : "100%"),
		transform: `rotate(${animRotation}deg) scale(${animScale})`,
		transformOrigin: "center center",
		opacity: animOpacity,
		backgroundColor: useRoundedBox ? undefined : layer.backgroundColor,
		borderColor: useRoundedBox ? undefined : layer.borderColor,
		borderWidth: useRoundedBox ? undefined : layer.borderWidth,
		borderRadius: useRoundedBox ? undefined : layer.borderRadius,
		borderStyle: !useRoundedBox && layer.borderWidth ? "solid" : undefined,
		overflow: layer.type === "Caption" ? "visible" : "hidden",
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

function extractFonts(
	layers: ExtendedLayer[],
	virtualMedia: VirtualMediaData | undefined,
): string[] {
	const fonts = new Set<string>();

	const walkLayer = (layer: ExtendedLayer) => {
		if (layer.fontFamily) fonts.add(layer.fontFamily);
		if (layer.virtualMedia) walkVirtualMedia(layer.virtualMedia);
	};

	const walkVirtualMedia = (vmd: VirtualMediaData) => {
		if (!vmd) return;
		if (vmd.operation?.op === "layer" && vmd.operation.fontFamily) {
			fonts.add(vmd.operation.fontFamily);
		}
		if (vmd.operation?.op === "text" && vmd.operation.fontFamily) {
			fonts.add(vmd.operation.fontFamily);
		}
		if (vmd.children) {
			for (const child of vmd.children) {
				walkVirtualMedia(child);
			}
		}
	};

	if (layers) {
		for (const layer of layers) {
			walkLayer(layer);
		}
	}
	if (virtualMedia) {
		walkVirtualMedia(virtualMedia);
	}

	return Array.from(fonts);
}

function useEnsureFontsLoaded(
	layers: ExtendedLayer[],
	virtualMedia: VirtualMediaData | undefined,
) {
	const [loaded, setLoaded] = useState(false);

	const fontsToLoad = useMemo(() => {
		const fonts = extractFonts(layers, virtualMedia);
		return fonts.sort().join(",");
	}, [layers, virtualMedia]);

	useEffect(() => {
		if (!fontsToLoad) {
			setLoaded(true);
			return;
		}

		const fonts = fontsToLoad.split(",");
		const handle = delayRender(`Loading custom fonts for: ${fontsToLoad}`);
		let isCancelled = false;

		const loadFonts = async () => {
			try {
				await Promise.all(
					fonts.map(async (fontFamily) => {
						const cleanFontFamily = fontFamily
							.split(",")[0]
							.replace(/['"]/g, "")
							.trim();

						if (
							[
								"sans-serif",
								"serif",
								"monospace",
								"cursive",
								"fantasy",
								"system-ui",
							].includes(cleanFontFamily.toLowerCase())
						) {
							return;
						}

						const fontUrl = GetFontAssetUrl(
							cleanFontFamily.replace(/\s+/g, "_"),
						);
						const font = new FontFace(cleanFontFamily, `url('${fontUrl}')`);
						await font.load();
						if (!isCancelled) document.fonts.add(font);
					}),
				);
			} catch (err) {
				console.warn(`Failed to load font`, err);
			} finally {
				if (!isCancelled) setLoaded(true);
				continueRender(handle);
			}
		};

		loadFonts();

		return () => {
			isCancelled = true;
		};
	}, [fontsToLoad]);

	return loaded;
}

export interface SceneProps {
	layers?: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
	containerWidth?: number;
	containerHeight?: number;
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "SVG" | "Text" | string;
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
	const config = useVideoConfig();
	const fps = Math.max(1, config.fps);

	const fontsLoaded = useEnsureFontsLoaded(layers, virtualMedia);

	const resolvedLayers = (() => {
		if (layers.length > 0) return layers;

		if (virtualMedia?.operation?.op === "compose") {
			return null;
		}

		if (src || virtualMedia || type === "Text" || type === "Caption") {
			const resolvedType = type || (isAudio ? "Audio" : "Video");
			const isCaption = resolvedType === "Caption";
			const isText = resolvedType === "Text";
			const isVisualMedia =
				resolvedType === "Image" ||
				resolvedType === "SVG" ||
				resolvedType === "Video";

			const activeMeta = virtualMedia
				? getActiveMediaMetadata(virtualMedia)
				: null;

			const resolvedDurationInMS = resolveLayerDuration(
				durationInMS,
				activeMeta?.durationMs,
				durationInMS,
			);

			let defaultWidth: number | string | undefined = viewportWidth;
			let defaultHeight: number | string | undefined = viewportHeight;

			if (isText) {
				defaultWidth = undefined;
				defaultHeight = undefined;
			} else if (isVisualMedia) {
				defaultWidth = activeMeta?.width ?? DEFAULT_MEDIA_DIMENSION;
				defaultHeight = activeMeta?.height ?? DEFAULT_MEDIA_DIMENSION;
			}

			const captionWidth = Math.round(viewportWidth * (2 / 3));
			const captionX = Math.round(viewportWidth / 6);

			return [
				{
					id: `single-source-${resolvedType}`,
					type: resolvedType,
					src,
					virtualMedia,
					text:
						typeof data === "string"
							? data
							: data?.text || JSON.stringify(data),
					width: defaultWidth,
					height: defaultHeight,
					durationInMS: resolvedDurationInMS,
					...(typeof data === "object" && data !== null ? data : {}),
					animations,
					opacity,
					volume,
					scale,
					rotation,
					x: x ?? 0,
					y: y ?? 0,
					lockAspect: isText || isVisualMedia,
					autoDimensions: false,
					...(isText ? TEXT_LAYER_DEFAULTS : {}),
					...(isCaption
						? {
								...CAPTION_LAYER_DEFAULTS,
								x: captionX,
								width: captionWidth,
								y: Math.max(
									0,
									viewportHeight -
										Math.round(
											(CAPTION_LAYER_DEFAULTS.fontSize as number) *
												(CAPTION_LAYER_DEFAULTS.lineHeight as number) *
												3,
										) -
										Math.round(viewportHeight * 0.1),
								),
								height: Math.round(
									(CAPTION_LAYER_DEFAULTS.fontSize as number) *
										(CAPTION_LAYER_DEFAULTS.lineHeight as number) *
										3,
								),
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

	// Critically defers rendering text layers utilizing `measureText` until fonts safely load.
	// Resolves layout-shifting logic issues rendering bounding boxes based on fallback fonts.
	if (!fontsLoaded) {
		return null;
	}

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
					const startFrame = Math.max(0, layer.startFrame ?? 0);

					const explicitLayerDurationMs = Math.max(
						1,
						resolveLayerDuration(
							layer.durationInMS,
							layer.virtualMedia?.metadata?.durationMs,
							DEFAULT_DURATION_MS,
						),
					);
					const layerNativeDuration = Math.max(
						1,
						Math.round((explicitLayerDurationMs / 1000) * fps),
					);
					const endFrame = startFrame + layerNativeDuration;

					if (frame < startFrame || frame >= endFrame) return null;
					return (
						<LayerRenderer key={layer.id} layer={layer} viewport={viewport} />
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
