import type { VirtualVideoData } from "@gatewai/core/types";
import {
	BaseNode,
	RunNodeButton,
	useNodeResult,
	VideoRenderer,
} from "@gatewai/react-canvas";
import {
	makeSelectEdgesByTargetNodeId,
	makeSelectNodeById,
	updateNodeConfig,
	useAppDispatch,
	useAppSelector,
} from "@gatewai/react-store";
import { resolveVideoSourceUrl } from "@gatewai/remotion-compositions";
import {
	Button,
	cn,
	DraggableNumberInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@gatewai/ui-kit";
import {
	Link as LinkIcon,
	MoveHorizontal,
	MoveVertical,
	Unlink as UnlinkIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VideoCropConfig } from "../shared/config.js";

// ─── Global styles ────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes vcropFadeIn {
    from { opacity: 0; transform: scale(0.995); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes vcropBadgePop {
    from { opacity: 0; transform: translateY(3px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────────────
type HandleType =
	| "move"
	| "resize-nw"
	| "resize-n"
	| "resize-ne"
	| "resize-e"
	| "resize-se"
	| "resize-s"
	| "resize-sw"
	| "resize-w";

/**
 * Internal percentage-based crop state.
 * All values are in [0, 100] representing percentages of the source video dimensions.
 *
 * VideoCropConfig now stores the same percentage representation, so conversions
 * between config and PctCrop are trivial identity mappings.
 */
type PctCrop = {
	leftPct: number;
	topPct: number;
	widthPct: number;
	heightPct: number;
};

type DragState = {
	type: HandleType;
	startX: number;
	startY: number;
	startCrop: PctCrop;
};

type AspectRatioPreset = { label: string; value: number | null };

// ─── Constants ────────────────────────────────────────────────────────────────
const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
	{ label: "Free", value: null },
	{ label: "1:1", value: 1 },
	{ label: "4:3", value: 4 / 3 },
	{ label: "3:2", value: 3 / 2 },
	{ label: "16:9", value: 16 / 9 },
	{ label: "2:3", value: 2 / 3 },
	{ label: "3:4", value: 3 / 4 },
	{ label: "9:16", value: 9 / 16 },
];

const CURSOR: Record<HandleType, string> = {
	move: "grab",
	"resize-nw": "nw-resize",
	"resize-n": "n-resize",
	"resize-ne": "ne-resize",
	"resize-e": "e-resize",
	"resize-se": "se-resize",
	"resize-s": "s-resize",
	"resize-sw": "sw-resize",
	"resize-w": "w-resize",
};

const MIN_PCT = 5;

// ─── Ratio helpers ────────────────────────────────────────────────────────────
/**
 * Convert a pixel aspect ratio (w/h) to a percentage-space ratio.
 * The SVG viewBox is 0-100 in both axes regardless of video aspect ratio, so a
 * 1:1 pixel crop is NOT a square in percentage space for non-square videos.
 */
function pixelRatioToPctRatio(
	pixelRatio: number,
	sourceSize: { w: number; h: number } | null,
): number {
	if (!sourceSize || sourceSize.w === 0 || sourceSize.h === 0)
		return pixelRatio;
	return pixelRatio * (sourceSize.h / sourceSize.w);
}

function pctRatioToPixelRatio(
	pctRatio: number,
	sourceSize: { w: number; h: number } | null,
): number {
	if (!sourceSize || sourceSize.h === 0 || sourceSize.w === 0) return pctRatio;
	return pctRatio * (sourceSize.w / sourceSize.h);
}

// ─── Constrain ────────────────────────────────────────────────────────────────
function constrain(
	crop: PctCrop,
	pctRatio: number | null = null,
	dragType: HandleType = "move",
): PctCrop {
	let { leftPct: l, topPct: t, widthPct: w, heightPct: h } = crop;

	if (pctRatio !== null && dragType !== "move") {
		const heightDriven = dragType === "resize-n" || dragType === "resize-s";
		const rightAnchor =
			dragType === "resize-w" ||
			dragType === "resize-nw" ||
			dragType === "resize-sw";
		const bottomAnchor =
			dragType === "resize-n" ||
			dragType === "resize-nw" ||
			dragType === "resize-ne";

		const rightEdge = l + w;
		const bottomEdge = t + h;

		if (heightDriven) {
			w = Math.max(MIN_PCT, h) * pctRatio;
			h = Math.max(MIN_PCT, h);
		} else {
			w = Math.max(MIN_PCT, w);
			h = w / pctRatio;
		}

		if (rightAnchor) l = rightEdge - w;
		if (bottomAnchor) t = bottomEdge - h;

		const availW = rightAnchor ? rightEdge : 100 - l;
		const availH = bottomAnchor ? bottomEdge : 100 - t;
		const overflow = w > availW || h > availH;
		const underflow = w < MIN_PCT || h < MIN_PCT;

		if (overflow || underflow) {
			const scaleDown = overflow ? Math.min(availW / w, availH / h) : 1;
			const scaleUp = underflow ? Math.max(MIN_PCT / w, MIN_PCT / h) : 1;
			const scale = Math.min(scaleDown, Math.max(1, scaleUp));
			w *= scale;
			h *= scale;
			if (rightAnchor) l = rightEdge - w;
			if (bottomAnchor) t = bottomEdge - h;
		}
	} else {
		w = Math.min(100, Math.max(MIN_PCT, w));
		h = Math.min(100, Math.max(MIN_PCT, h));
	}

	l = Math.max(0, Math.min(100 - w, l));
	t = Math.max(0, Math.min(100 - h, t));

	return { leftPct: l, topPct: t, widthPct: w, heightPct: h };
}

// ─── Config ↔ PctCrop conversions ────────────────────────────────────────────
/**
 * Config now stores percentages directly, so this is a straight field rename.
 * Falls back to full-frame (0, 0, 100, 100) when config values are absent.
 */
function configToPct(config: VideoCropConfig): PctCrop {
	return {
		leftPct: config.leftPercentage ?? 0,
		topPct: config.topPercentage ?? 0,
		widthPct: config.widthPercentage ?? 100,
		heightPct: config.heightPercentage ?? 100,
	};
}

/** Convert PctCrop back to the percentage-based config for the node store. */
function pctToConfig(pct: PctCrop): VideoCropConfig {
	return {
		leftPercentage: pct.leftPct,
		topPercentage: pct.topPct,
		widthPercentage: pct.widthPct,
		heightPercentage: pct.heightPct,
	};
}

// ─── CropConfigPanel ─────────────────────────────────────────────────────────
interface CropConfigPanelProps {
	crop: PctCrop;
	aspectRatioPreset: string;
	isLocked: boolean;
	sourceSize: { w: number; h: number } | null;
	onChange: (crop: PctCrop) => void;
	onAspectRatioChange: (preset: string) => void;
	onToggleLock: () => void;
}

const CropConfigPanel = memo(
	({
		crop,
		aspectRatioPreset,
		isLocked,
		sourceSize,
		onChange,
		onAspectRatioChange,
		onToggleLock,
	}: CropConfigPanelProps) => {
		// Display pixel values derived from percentages + sourceSize (UI only — not stored).
		const pixelW = sourceSize
			? Math.round((crop.widthPct / 100) * sourceSize.w)
			: null;
		const pixelH = sourceSize
			? Math.round((crop.heightPct / 100) * sourceSize.h)
			: null;

		const [wInput, setWInput] = useState(pixelW ?? Math.round(crop.widthPct));
		const [hInput, setHInput] = useState(pixelH ?? Math.round(crop.heightPct));

		useEffect(() => {
			setWInput(pixelW ?? Math.round(crop.widthPct));
			setHInput(pixelH ?? Math.round(crop.heightPct));
		}, [crop.widthPct, crop.heightPct, pixelW, pixelH]);

		const handleDimensionChange = (axis: "w" | "h", val: number) => {
			const currentPixelRatio = sourceSize
				? ((crop.widthPct / 100) * sourceSize.w) /
					((crop.heightPct / 100) * sourceSize.h)
				: crop.widthPct / crop.heightPct;

			let newWPct = crop.widthPct;
			let newHPct = crop.heightPct;

			if (axis === "w") {
				setWInput(val);
				newWPct = sourceSize ? (val / sourceSize.w) * 100 : val;
				if (isLocked) {
					const newHpx = val / currentPixelRatio;
					newHPct = sourceSize ? (newHpx / sourceSize.h) * 100 : newHpx;
					setHInput(Math.round(sourceSize ? newHpx : newHPct));
				}
			} else {
				setHInput(val);
				newHPct = sourceSize ? (val / sourceSize.h) * 100 : val;
				if (isLocked) {
					const newWpx = val * currentPixelRatio;
					newWPct = sourceSize ? (newWpx / sourceSize.w) * 100 : newWpx;
					setWInput(Math.round(sourceSize ? newWpx : newWPct));
				}
			}

			onChange(
				constrain({
					...crop,
					widthPct: newWPct,
					heightPct: newHPct,
				}),
			);
		};

		return (
			<div className="flex items-end gap-3 p-1.5 border-t border-border bg-card/50">
				<div className="flex flex-col gap-2 flex-none">
					<span className="text-[11px] text-muted-foreground tracking-wide whitespace-nowrap">
						Aspect ratio
					</span>
					<Select value={aspectRatioPreset} onValueChange={onAspectRatioChange}>
						<SelectTrigger className="h-7 w-[90px] text-xs">
							<SelectValue placeholder="Ratio" />
						</SelectTrigger>
						<SelectContent>
							{ASPECT_RATIO_PRESETS.map((p) => (
								<SelectItem key={p.label} value={p.label} className="text-xs">
									{p.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<DraggableNumberInput
					label="Width"
					icon={MoveHorizontal}
					value={Math.round(wInput)}
					onChange={(v) => handleDimensionChange("w", v)}
					min={1}
					max={sourceSize?.w ?? 100}
					className="w-20"
				/>
				<DraggableNumberInput
					label="Height"
					icon={MoveVertical}
					value={Math.round(hInput)}
					onChange={(v) => handleDimensionChange("h", v)}
					min={1}
					max={sourceSize?.h ?? 100}
					className="w-20"
				/>
				<Button
					variant="ghost"
					size="icon"
					className={cn(
						"h-7 w-7 rounded-md transition-colors",
						isLocked
							? "text-primary bg-primary/10 hover:bg-primary/20"
							: "text-muted-foreground hover:text-foreground",
					)}
					onClick={onToggleLock}
					title={isLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
				>
					{isLocked ? (
						<LinkIcon className="w-3.5 h-3.5" />
					) : (
						<UnlinkIcon className="w-3.5 h-3.5" />
					)}
				</Button>
			</div>
		);
	},
);

// ─── CropOverlay ─────────────────────────────────────────────────────────────
interface CropOverlayProps {
	crop: PctCrop;
	svgSize: { w: number; h: number };
	isDragging: boolean;
	drag: DragState | null;
	sourceSize: { w: number; h: number } | null;
	onStartDrag: (e: React.PointerEvent, type: HandleType) => void;
}

const CropOverlay = memo(
	({
		crop,
		svgSize,
		isDragging,
		drag,
		sourceSize,
		onStartDrag,
	}: CropOverlayProps) => {
		const maskId = useRef(
			`vcm-${Math.random().toString(36).slice(2, 9)}`,
		).current;

		const { leftPct: l, topPct: t, widthPct: w, heightPct: h } = crop;
		const x1 = l,
			y1 = t,
			x2 = l + w,
			y2 = t + h;
		const cx = l + w / 2;

		const thirds = {
			v1: l + w / 3,
			v2: l + (w * 2) / 3,
			h1: t + h / 3,
			h2: t + (h * 2) / 3,
		};

		const px = (n: number) => (n / svgSize.w) * 100;
		const ARM = px(13);
		const CORNER_HIT = px(13);
		const EDGE_HIT = px(7);

		const cornerPath = (dir: "nw" | "ne" | "sw" | "se") => {
			switch (dir) {
				case "nw":
					return `M ${x1 + ARM},${y1} L ${x1},${y1} L ${x1},${y1 + ARM}`;
				case "ne":
					return `M ${x2 - ARM},${y1} L ${x2},${y1} L ${x2},${y1 + ARM}`;
				case "sw":
					return `M ${x1},${y2 - ARM} L ${x1},${y2} L ${x1 + ARM},${y2}`;
				case "se":
					return `M ${x2},${y2 - ARM} L ${x2},${y2} L ${x2 - ARM},${y2}`;
			}
		};

		const corners: [HandleType, "nw" | "ne" | "sw" | "se", number, number][] = [
			["resize-nw", "nw", x1, y1],
			["resize-ne", "ne", x2, y1],
			["resize-sw", "sw", x1, y2],
			["resize-se", "se", x2, y2],
		];

		const badgeLabel = sourceSize
			? `${Math.round((w / 100) * sourceSize.w)} × ${Math.round((h / 100) * sourceSize.h)} px`
			: `${Math.round(w)}% × ${Math.round(h)}%`;

		const isMoveDrag = drag?.type === "move";

		return (
			<svg
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
				style={{
					animation: "vcropFadeIn 0.25s cubic-bezier(0.16,1,0.3,1) both",
				}}
			>
				<defs>
					<mask id={maskId}>
						<rect x="0" y="0" width="100" height="100" fill="white" />
						<rect x={x1} y={y1} width={w} height={h} fill="black" />
					</mask>
					<filter
						id="vcropShadow"
						x="-200%"
						y="-200%"
						width="500%"
						height="500%"
					>
						<feDropShadow
							dx="0"
							dy="0.4"
							stdDeviation="1"
							floodColor="rgba(0,0,0,0.65)"
						/>
					</filter>
				</defs>

				{/* Backdrop */}
				<rect
					x="0"
					y="0"
					width="100"
					height="100"
					fill="rgba(0,0,0,0.42)"
					mask={`url(#${maskId})`}
					className="pointer-events-none"
				/>

				{/* Rule-of-thirds */}
				<g
					className="pointer-events-none"
					style={{
						opacity: isDragging ? 0.28 : 0.1,
						transition: "opacity 0.4s ease",
					}}
				>
					<line
						x1={thirds.v1}
						y1={y1}
						x2={thirds.v1}
						y2={y2}
						stroke="white"
						strokeWidth="0.2"
					/>
					<line
						x1={thirds.v2}
						y1={y1}
						x2={thirds.v2}
						y2={y2}
						stroke="white"
						strokeWidth="0.2"
					/>
					<line
						x1={x1}
						y1={thirds.h1}
						x2={x2}
						y2={thirds.h1}
						stroke="white"
						strokeWidth="0.2"
					/>
					<line
						x1={x1}
						y1={thirds.h2}
						x2={x2}
						y2={thirds.h2}
						stroke="white"
						strokeWidth="0.2"
					/>
				</g>

				{/* Crop border – shadow */}
				<rect
					x={x1}
					y={y1}
					width={w}
					height={h}
					fill="none"
					stroke="rgba(0,0,0,0.25)"
					strokeWidth="1.2"
					className="pointer-events-none"
				/>
				{/* Crop border – primary */}
				<rect
					x={x1}
					y={y1}
					width={w}
					height={h}
					fill="none"
					stroke="rgba(255,255,255,0.88)"
					strokeWidth="0.4"
					className="pointer-events-none"
				/>

				{/* Interior move hit-area */}
				<rect
					x={x1 + CORNER_HIT}
					y={y1 + CORNER_HIT}
					width={Math.max(0, w - CORNER_HIT * 2)}
					height={Math.max(0, h - CORNER_HIT * 2)}
					fill="transparent"
					style={{ cursor: isMoveDrag ? "grabbing" : "grab" }}
					className="pointer-events-auto"
					onPointerDown={(e) => onStartDrag(e, "move")}
				/>

				{/* Edge hit-areas */}
				<rect
					x={x1 + CORNER_HIT}
					y={y1 - EDGE_HIT}
					width={Math.max(0, w - CORNER_HIT * 2)}
					height={EDGE_HIT * 2}
					fill="transparent"
					style={{ cursor: CURSOR["resize-n"] }}
					className="pointer-events-auto"
					onPointerDown={(e) => onStartDrag(e, "resize-n")}
				/>
				<rect
					x={x1 + CORNER_HIT}
					y={y2 - EDGE_HIT}
					width={Math.max(0, w - CORNER_HIT * 2)}
					height={EDGE_HIT * 2}
					fill="transparent"
					style={{ cursor: CURSOR["resize-s"] }}
					className="pointer-events-auto"
					onPointerDown={(e) => onStartDrag(e, "resize-s")}
				/>
				<rect
					x={x2 - EDGE_HIT}
					y={y1 + CORNER_HIT}
					width={EDGE_HIT * 2}
					height={Math.max(0, h - CORNER_HIT * 2)}
					fill="transparent"
					style={{ cursor: CURSOR["resize-e"] }}
					className="pointer-events-auto"
					onPointerDown={(e) => onStartDrag(e, "resize-e")}
				/>
				<rect
					x={x1 - EDGE_HIT}
					y={y1 + CORNER_HIT}
					width={EDGE_HIT * 2}
					height={Math.max(0, h - CORNER_HIT * 2)}
					fill="transparent"
					style={{ cursor: CURSOR["resize-w"] }}
					className="pointer-events-auto"
					onPointerDown={(e) => onStartDrag(e, "resize-w")}
				/>

				{/* Corner handles */}
				{corners.map(([type, dir, hx, hy]) => (
					<g key={type} className="pointer-events-auto">
						<path
							d={cornerPath(dir)}
							fill="none"
							stroke="rgba(0,0,0,0.45)"
							strokeWidth="2.4"
							strokeLinecap="round"
							className="pointer-events-none"
							filter="url(#vcropShadow)"
						/>
						<path
							d={cornerPath(dir)}
							fill="none"
							stroke="white"
							strokeWidth="1.6"
							strokeLinecap="round"
							className="pointer-events-none"
						/>
						<rect
							x={hx - CORNER_HIT}
							y={hy - CORNER_HIT}
							width={CORNER_HIT * 2}
							height={CORNER_HIT * 2}
							fill="transparent"
							style={{ cursor: CURSOR[type] }}
							className="pointer-events-auto"
							onPointerDown={(e) => onStartDrag(e, type)}
						/>
					</g>
				))}

				{/* Dimension badge */}
				{isDragging && (
					<g
						className="pointer-events-none"
						style={{
							animation: "vcropBadgePop 0.18s cubic-bezier(0.16,1,0.3,1) both",
						}}
					>
						<rect
							x={cx - 12}
							y={y2 + 1.5}
							width={24}
							height={5.2}
							rx="2"
							fill="rgba(0,0,0,0.7)"
						/>
						<text
							x={cx}
							y={y2 + 5.2}
							textAnchor="middle"
							fill="rgba(255,255,255,0.9)"
							fontSize="2.8"
							fontFamily="-apple-system,'SF Pro Display',BlinkMacSystemFont,monospace"
							fontWeight="500"
							letterSpacing="0.02em"
						>
							{badgeLabel}
						</text>
					</g>
				)}
			</svg>
		);
	},
);

// ─── Default state ────────────────────────────────────────────────────────────
const DEFAULT_PCT: PctCrop = {
	leftPct: 10,
	topPct: 10,
	widthPct: 80,
	heightPct: 80,
};

// ─── VideoCropNodeComponent ───────────────────────────────────────────────────
const VideoCropNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const dispatch = useAppDispatch();
		const edges = useAppSelector(
			makeSelectEdgesByTargetNodeId(props.id),
		) as any[];
		const inputHandleId = useMemo(() => edges?.[0]?.targetHandleId, [edges]);
		const { inputs } = useNodeResult(props.id);

		const inputVideo = inputs[inputHandleId!]?.outputItem?.data as
			| VirtualVideoData
			| undefined;

		const videoSrc = inputVideo ? resolveVideoSourceUrl(inputVideo) : undefined;

		// sourceSize is only used for pixel-value display in the UI panel and for
		// converting between pixel aspect-ratio presets and percentage-space ratios.
		// It is no longer involved in reading/writing the config.
		const sourceSize = useMemo(() => {
			if (!inputVideo?.sourceMeta) return null;
			const { width: w, height: h } = inputVideo.sourceMeta;
			if (!w || !h) return null;
			return { w, h };
		}, [inputVideo]);

		const node = useAppSelector(makeSelectNodeById(props.id)) as any;
		const nodeConfig = node?.data?.config as VideoCropConfig | undefined;

		const svgRef = useRef<HTMLDivElement>(null);
		const latestCropRef = useRef<PctCrop | null>(null);
		const [isFullscreen, setIsFullscreen] = useState(false);

		useEffect(() => {
			const onFullscreenChange = () => {
				setIsFullscreen(!!document.fullscreenElement);
			};
			document.addEventListener("fullscreenchange", onFullscreenChange);
			return () =>
				document.removeEventListener("fullscreenchange", onFullscreenChange);
		}, []);

		// Config → internal PctCrop is now a direct field rename — no sourceSize math.
		const configAsPct = useMemo(
			() => (nodeConfig ? configToPct(nodeConfig) : DEFAULT_PCT),
			[
				nodeConfig?.leftPercentage,
				nodeConfig?.topPercentage,
				nodeConfig?.widthPercentage,
				nodeConfig?.heightPercentage,
			],
		);

		const [crop, setCrop] = useState<PctCrop>(configAsPct);
		const [drag, setDrag] = useState<DragState | null>(null);
		const [svgSize, setSvgSize] = useState({ w: 1, h: 1 });
		const [aspectPreset, setAspectPreset] = useState("Free");
		const [customRatio, setCustomRatio] = useState<number | null>(null);

		const effectiveRatio = useMemo<number | null>(() => {
			const preset = ASPECT_RATIO_PRESETS.find((p) => p.label === aspectPreset);
			return preset?.value ?? customRatio ?? null;
		}, [aspectPreset, customRatio]);

		// Aspect ratio presets are expressed as pixel ratios (e.g. 16/9).
		// The overlay works in percentage space, so we convert when constraining.
		const effectivePctRatio = useMemo<number | null>(() => {
			if (effectiveRatio === null) return null;
			return pixelRatioToPctRatio(effectiveRatio, sourceSize);
		}, [effectiveRatio, sourceSize]);

		const isLocked = effectiveRatio !== null;

		useEffect(() => {
			latestCropRef.current = crop;
		}, [crop]);

		// Sync external config changes (undo/redo, remote updates) into local state.
		useEffect(() => {
			if (nodeConfig) setCrop(configToPct(nodeConfig));
		}, [nodeConfig]);

		useEffect(() => {
			if (!svgRef.current) return;
			const ro = new ResizeObserver(([entry]) => {
				const { width, height } = entry.contentRect;
				if (width > 0 && height > 0) setSvgSize({ w: width, h: height });
			});
			ro.observe(svgRef.current);
			return () => ro.disconnect();
		}, []);

		// Config is now percentage-based — no sourceSize conversion needed here.
		const updateConfig = useCallback(
			(c: PctCrop) =>
				dispatch(
					updateNodeConfig({
						id: props.id,
						newConfig: pctToConfig(c),
					}),
				),
			[dispatch, props.id],
		);

		const handleAspectRatioChange = useCallback(
			(preset: string) => {
				setAspectPreset(preset);
				if (preset === "Free") {
					setCustomRatio(null);
					return;
				}
				const p = ASPECT_RATIO_PRESETS.find((ap) => ap.label === preset);
				if (!p?.value) return;

				const pctRatio = pixelRatioToPctRatio(p.value, sourceSize);

				setCrop((prev) => {
					const cx = prev.leftPct + prev.widthPct / 2;
					const cy = prev.topPct + prev.heightPct / 2;
					let newW = prev.widthPct;
					let newH = newW / pctRatio;
					if (newH > 100) {
						newH = 100;
						newW = newH * pctRatio;
					}
					const next = constrain(
						{
							leftPct: cx - newW / 2,
							topPct: cy - newH / 2,
							widthPct: newW,
							heightPct: newH,
						},
						pctRatio,
						"resize-se",
					);
					updateConfig(next);
					return next;
				});
			},
			[updateConfig, sourceSize],
		);

		const handleToggleLock = useCallback(() => {
			if (aspectPreset !== "Free") {
				setAspectPreset("Free");
				setCustomRatio(null);
			} else if (customRatio !== null) {
				setCustomRatio(null);
			} else {
				// Lock to the current crop's pixel ratio (converted from pct space).
				const pixelRatio = pctRatioToPixelRatio(
					crop.widthPct / crop.heightPct,
					sourceSize,
				);
				setCustomRatio(pixelRatio);
			}
		}, [aspectPreset, customRatio, crop, sourceSize]);

		const startDrag = useCallback(
			(e: React.PointerEvent, type: HandleType) => {
				e.preventDefault();
				e.stopPropagation();
				(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
				setDrag({
					type,
					startX: e.clientX,
					startY: e.clientY,
					startCrop: { ...crop },
				});
			},
			[crop],
		);

		useEffect(() => {
			if (!drag) return;

			const onMove = (e: PointerEvent) => {
				e.preventDefault();
				const dx = ((e.clientX - drag.startX) / svgSize.w) * 100;
				const dy = ((e.clientY - drag.startY) / svgSize.h) * 100;
				const c: PctCrop = { ...drag.startCrop };

				switch (drag.type) {
					case "move":
						c.leftPct += dx;
						c.topPct += dy;
						break;
					case "resize-nw":
						c.leftPct += dx;
						c.widthPct -= dx;
						c.topPct += dy;
						c.heightPct -= dy;
						break;
					case "resize-n":
						c.topPct += dy;
						c.heightPct -= dy;
						break;
					case "resize-ne":
						c.widthPct += dx;
						c.topPct += dy;
						c.heightPct -= dy;
						break;
					case "resize-e":
						c.widthPct += dx;
						break;
					case "resize-se":
						c.widthPct += dx;
						c.heightPct += dy;
						break;
					case "resize-s":
						c.heightPct += dy;
						break;
					case "resize-sw":
						c.leftPct += dx;
						c.widthPct -= dx;
						c.heightPct += dy;
						break;
					case "resize-w":
						c.leftPct += dx;
						c.widthPct -= dx;
						break;
				}

				setCrop(constrain(c, effectivePctRatio, drag.type));
			};

			const onUp = () => {
				if (latestCropRef.current) updateConfig(latestCropRef.current);
				setDrag(null);
			};

			window.addEventListener("pointermove", onMove, { passive: false });
			window.addEventListener("pointerup", onUp);
			return () => {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
			};
		}, [drag, svgSize, updateConfig, effectivePctRatio]);

		const overlay =
			inputVideo && !isFullscreen ? (
				<div
					ref={svgRef}
					className="absolute inset-0 w-full h-full pointer-events-none"
				>
					<CropOverlay
						crop={crop}
						svgSize={svgSize}
						isDragging={drag !== null}
						drag={drag}
						sourceSize={sourceSize}
						onStartDrag={startDrag}
					/>
				</div>
			) : undefined;

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<style>{GLOBAL_STYLES}</style>

				<div className="select-none rounded-xl overflow-hidden bg-card border border-border">
					{/* ── Video + overlay ───────────────────────────────── */}
					<div
						className={cn("relative w-full bg-black/20", {
							"h-64": !inputVideo,
						})}
						style={{ minHeight: inputVideo ? undefined : "12rem" }}
					>
						{inputVideo ? (
							<VideoRenderer
								src={videoSrc}
								virtualVideo={inputVideo}
								durationMs={inputVideo?.sourceMeta?.durationMs}
								controls={true}
								className="rounded-none w-full h-full"
								overlay={overlay}
							/>
						) : (
							<div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40 text-xs tracking-wide">
								No video connected
							</div>
						)}
					</div>

					{/* ── Config panel ──────────────────────────────────── */}
					<CropConfigPanel
						crop={crop}
						aspectRatioPreset={aspectPreset}
						isLocked={isLocked}
						sourceSize={sourceSize}
						onChange={(next) => {
							setCrop(next);
							updateConfig(next);
						}}
						onAspectRatioChange={handleAspectRatioChange}
						onToggleLock={handleToggleLock}
					/>

					{/* ── Run button ────────────────────────────────────── */}
					<div className="flex justify-end items-center w-full px-2 py-1.5 border-t border-border">
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { VideoCropNodeComponent };
