import { ResolveFileDataUrl } from "@gatewai/core/browser";
import type { FileData } from "@gatewai/core/types";
import {
	BaseNode,
	CanvasRenderer,
	type NodeProps,
	useNodeResult,
} from "@gatewai/react-canvas";
import {
	makeSelectEdgesByTargetNodeId,
	makeSelectNodeById,
	updateNodeConfig,
	useAppDispatch,
	useAppSelector,
} from "@gatewai/react-store";
import {
	Button,
	cn,
	DraggableNumberInput,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
} from "@gatewai/ui-kit";
import {
	Link as LinkIcon,
	MoveHorizontal,
	MoveVertical,
	Unlink as UnlinkIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CropNodeConfig } from "@/shared/config.js";

// ─── Global styles ────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes cropFadeIn {
    from { opacity: 0; transform: scale(0.995); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes badgePop {
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

type DragState = {
	type: HandleType;
	startX: number;
	startY: number;
	startCrop: CropNodeConfig;
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

// ─── Ratio conversion helpers ─────────────────────────────────────────────────

/**
 * Convert a pixel-space aspect ratio (w/h in real pixels) to percentage-space
 * (widthPct / heightPct).
 *
 * Because 1% of width covers (naturalWidth / 100) pixels, and 1% of height
 * covers (naturalHeight / 100) pixels:
 *
 *   pixelRatio = (widthPct * nw/100) / (heightPct * nh/100)
 *              = (widthPct / heightPct) * (nw / nh)
 *
 * Therefore:
 *   pctRatio = pixelRatio * (nh / nw)
 */
function pixelRatioToPctRatio(
	pixelRatio: number,
	naturalSize: { w: number; h: number } | null,
): number {
	if (!naturalSize || naturalSize.w === 0 || naturalSize.h === 0) {
		return pixelRatio;
	}
	return pixelRatio * (naturalSize.h / naturalSize.w);
}

/**
 * Convert a percentage-space ratio back to pixel-space ratio.
 * Inverse of pixelRatioToPctRatio.
 */
function pctRatioToPixelRatio(
	pctRatio: number,
	naturalSize: { w: number; h: number } | null,
): number {
	if (!naturalSize || naturalSize.h === 0 || naturalSize.w === 0) {
		return pctRatio;
	}
	return pctRatio * (naturalSize.w / naturalSize.h);
}

// ─── Constrain ────────────────────────────────────────────────────────────────
/**
 * Apply bounds + optional aspect-ratio lock.
 *
 * IMPORTANT: `ratio` here must be in **percentage space** (widthPct / heightPct),
 * NOT pixel space. Use `pixelRatioToPctRatio` before calling this function
 * whenever you have a pixel-space ratio.
 *
 * For ratio-locked resizes the invariant is that the "fixed" edge (opposite to
 * the dragged handle) must not move. The drag handler preserves this by
 * adjusting both position and size together (e.g. resize-nw: l += dx, w -= dx).
 * So l+w and t+h already encode the fixed anchor edges when we get here.
 *
 * Strategy:
 *   1. Enforce ratio from the driving axis (w for h/e-drags, h for n/s-drags).
 *   2. Reposition so the anchor edge stays put.
 *   3. If the result overflows the [0,100] canvas, uniformly scale the crop
 *      down until it fits, then re-anchor.
 *   4. Final position clamp so nothing goes outside the canvas.
 */
function constrain(
	crop: CropNodeConfig,
	// percentage-space ratio (widthPct / heightPct), or null for free
	pctRatio: number | null = null,
	dragType: HandleType = "move",
): CropNodeConfig {
	let {
		leftPercentage: l,
		topPercentage: t,
		widthPercentage: w,
		heightPercentage: h,
	} = crop;

	if (pctRatio !== null && dragType !== "move") {
		// Which axis drives?
		const heightDriven = dragType === "resize-n" || dragType === "resize-s";

		// The drag handler preserves l+w for right-anchor drags and t+h for bottom-anchor drags.
		const rightAnchor =
			dragType === "resize-w" ||
			dragType === "resize-nw" ||
			dragType === "resize-sw";
		const bottomAnchor =
			dragType === "resize-n" ||
			dragType === "resize-nw" ||
			dragType === "resize-ne";

		// Capture the fixed edges before we mutate w / h.
		const rightEdge = l + w;
		const bottomEdge = t + h;

		// Enforce ratio.
		if (heightDriven) {
			w = Math.max(MIN_PCT, h) * pctRatio;
			h = Math.max(MIN_PCT, h);
		} else {
			w = Math.max(MIN_PCT, w);
			h = w / pctRatio;
		}

		// Re-anchor position.
		if (rightAnchor) l = rightEdge - w;
		if (bottomAnchor) t = bottomEdge - h;

		// Max available space from the anchor side.
		const availW = rightAnchor ? rightEdge : 100 - l;
		const availH = bottomAnchor ? bottomEdge : 100 - t;

		// If the ratio-enforced crop overflows or is too small, scale uniformly.
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
		// Unconstrained: simple clamp.
		w = Math.min(100, Math.max(MIN_PCT, w));
		h = Math.min(100, Math.max(MIN_PCT, h));
	}

	// Final position clamp — never let the crop escape the canvas.
	l = Math.max(0, Math.min(100 - w, l));
	t = Math.max(0, Math.min(100 - h, t));

	return {
		leftPercentage: l,
		topPercentage: t,
		widthPercentage: w,
		heightPercentage: h,
	};
}

interface CropConfigPanelProps {
	crop: CropNodeConfig;
	aspectRatioPreset: string;
	isLocked: boolean;
	naturalWidth?: number;
	naturalHeight?: number;
	onChange: (crop: CropNodeConfig) => void;
	onAspectRatioChange: (preset: string) => void;
	onToggleLock: () => void;
	onReset: () => void;
}

const CropConfigPanel = memo(
	({
		crop,
		aspectRatioPreset,
		isLocked,
		naturalWidth,
		naturalHeight,
		onChange,
		onAspectRatioChange,
		onToggleLock,
	}: CropConfigPanelProps) => {
		const pixelW = naturalWidth
			? Math.round((crop.widthPercentage / 100) * naturalWidth)
			: null;
		const pixelH = naturalHeight
			? Math.round((crop.heightPercentage / 100) * naturalHeight)
			: null;

		const [wInput, setWInput] = useState(
			pixelW ?? Math.round(crop.widthPercentage),
		);
		const [hInput, setHInput] = useState(
			pixelH ?? Math.round(crop.heightPercentage),
		);

		useEffect(() => {
			setWInput(pixelW ?? Math.round(crop.widthPercentage));
			setHInput(pixelH ?? Math.round(crop.heightPercentage));
		}, [crop.widthPercentage, crop.heightPercentage, pixelW, pixelH]);

		const handleDimensionChange = (axis: "w" | "h", val: number) => {
			// Compute the current pixel-space ratio for lock propagation.
			const currentPixelRatio =
				naturalWidth && naturalHeight
					? ((crop.widthPercentage / 100) * naturalWidth) /
						((crop.heightPercentage / 100) * naturalHeight)
					: crop.widthPercentage / crop.heightPercentage;

			let newWPct = crop.widthPercentage;
			let newHPct = crop.heightPercentage;

			if (axis === "w") {
				setWInput(val);
				newWPct = naturalWidth ? (val / naturalWidth) * 100 : val;
				if (isLocked) {
					// Maintain pixel ratio: newHpx = newWpx / pixelRatio
					const newWpx = val;
					const newHpx = newWpx / currentPixelRatio;
					newHPct = naturalHeight ? (newHpx / naturalHeight) * 100 : newHpx;
					setHInput(Math.round(naturalHeight ? newHpx : newHPct));
				}
			} else {
				setHInput(val);
				newHPct = naturalHeight ? (val / naturalHeight) * 100 : val;
				if (isLocked) {
					// Maintain pixel ratio: newWpx = newHpx * pixelRatio
					const newHpx = val;
					const newWpx = newHpx * currentPixelRatio;
					newWPct = naturalWidth ? (newWpx / naturalWidth) * 100 : newWpx;
					setWInput(Math.round(naturalWidth ? newWpx : newWPct));
				}
			}

			onChange(
				constrain({
					...crop,
					widthPercentage: newWPct,
					heightPercentage: newHPct,
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
					max={naturalWidth ?? 100}
					className="w-20"
				/>
				<DraggableNumberInput
					label="Height"
					icon={MoveVertical}
					value={Math.round(hInput)}
					onChange={(v) => handleDimensionChange("h", v)}
					min={1}
					max={naturalHeight ?? 100}
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

// ─────────────────────────────────────────────────────────────────────────────
// CropOverlay
// ─────────────────────────────────────────────────────────────────────────────
interface CropOverlayProps {
	crop: CropNodeConfig;
	svgSize: { w: number; h: number };
	isDragging: boolean;
	drag: DragState | null;
	naturalSize: { w: number; h: number } | null;
	onStartDrag: (e: React.PointerEvent, type: HandleType) => void;
}

const CropOverlay = memo(
	({
		crop,
		svgSize,
		isDragging,
		drag,
		naturalSize,
		onStartDrag,
	}: CropOverlayProps) => {
		// Stable mask ID — one per component instance.
		const maskId = useRef(
			`cm-${Math.random().toString(36).slice(2, 9)}`,
		).current;

		const {
			leftPercentage: l,
			topPercentage: t,
			widthPercentage: w,
			heightPercentage: h,
		} = crop;
		const x1 = l,
			y1 = t,
			x2 = l + w,
			y2 = t + h;
		const cx = l + w / 2,
			cy = t + h / 2;

		const thirds = {
			v1: l + w / 3,
			v2: l + (w * 2) / 3,
			h1: t + h / 3,
			h2: t + (h * 2) / 3,
		};

		// Convert physical pixels to SVG viewBox units (viewBox is 0–100 both axes).
		const px = (n: number) => (n / svgSize.w) * 100;

		const ARM = px(13); // corner L-arm length
		const CORNER_HIT = px(13); // corner hit-area half-size
		const EDGE_HIT = px(7); // border-line hit-area half-thickness

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

		// Dimension badge label: px if we know naturalSize, else %.
		const badgeLabel = naturalSize
			? `${Math.round((w / 100) * naturalSize.w)} × ${Math.round((h / 100) * naturalSize.h)} px`
			: `${Math.round(w)}% × ${Math.round(h)}%`;

		const isMoveDrag = drag?.type === "move";

		return (
			<svg
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
				style={{
					animation: "cropFadeIn 0.25s cubic-bezier(0.16,1,0.3,1) both",
				}}
			>
				<defs>
					<mask id={maskId}>
						<rect x="0" y="0" width="100" height="100" fill="white" />
						<rect x={x1} y={y1} width={w} height={h} fill="black" />
					</mask>
					<filter id="hShadow" x="-200%" y="-200%" width="500%" height="500%">
						<feDropShadow
							dx="0"
							dy="0.4"
							stdDeviation="1"
							floodColor="rgba(0,0,0,0.65)"
						/>
					</filter>
				</defs>

				{/* ── Backdrop ─────────────────────────────────────── */}
				<rect
					x="0"
					y="0"
					width="100"
					height="100"
					fill="rgba(0,0,0,0.42)"
					mask={`url(#${maskId})`}
					className="pointer-events-none"
				/>

				{/* ── Rule-of-thirds ───────────────────────────────── */}
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

				{/* ── Crop border ───────────────────────────────────── */}
				{/* Shadow stroke */}
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
				{/* Primary stroke — intentionally thin */}
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

				{/* ── Interior move hit-area ────────────────────────── */}
				{/* Slightly inset so corner hit-areas take priority */}
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

				{/* ── Edge border hit-areas (draggable lines) ───────── */}
				{/* N edge */}
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
				{/* S edge */}
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
				{/* E edge */}
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
				{/* W edge */}
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

				{/* ── Corner handles ────────────────────────────────── */}
				{corners.map(([type, dir, hx, hy]) => (
					<g key={type} className="pointer-events-auto">
						{/* Shadow */}
						<path
							d={cornerPath(dir)}
							fill="none"
							stroke="rgba(0,0,0,0.45)"
							strokeWidth="2.4"
							strokeLinecap="round"
							className="pointer-events-none"
							filter="url(#hShadow)"
						/>
						{/* White arm */}
						<path
							d={cornerPath(dir)}
							fill="none"
							stroke="white"
							strokeWidth="1.6"
							strokeLinecap="round"
							className="pointer-events-none"
						/>
						{/* Hit area */}
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

				{/* ── Dimension badge ────────────────────────────────── */}
				{isDragging && (
					<g
						className="pointer-events-none"
						style={{
							animation: "badgePop 0.18s cubic-bezier(0.16,1,0.3,1) both",
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

// ─────────────────────────────────────────────────────────────────────────────
// CropNodeComponent
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CROP: CropNodeConfig = {
	leftPercentage: 10,
	topPercentage: 10,
	widthPercentage: 80,
	heightPercentage: 80,
};

const CropNodeComponent = memo((props: NodeProps) => {
	const dispatch = useAppDispatch();

	const edges = useAppSelector(makeSelectEdgesByTargetNodeId(props.id));
	const inputHandleId = useMemo(() => edges?.[0]?.targetHandleId, [edges]);
	const { inputs } = useNodeResult(props.id);
	const inputFileData = inputs[inputHandleId!]?.outputItem?.data as FileData;
	const imageUrl = ResolveFileDataUrl(inputFileData);
	console.log({ inputFileData, imageUrl });
	const node = useAppSelector(makeSelectNodeById(props.id));
	const nodeConfig = node?.config as CropNodeConfig;

	const svgRef = useRef<HTMLDivElement>(null);
	const latestCropRef = useRef<CropNodeConfig | null>(null);
	const imgRef = useRef<HTMLImageElement>(null);

	const [crop, setCrop] = useState<CropNodeConfig>(() => ({
		leftPercentage: nodeConfig?.leftPercentage ?? DEFAULT_CROP.leftPercentage,
		topPercentage: nodeConfig?.topPercentage ?? DEFAULT_CROP.topPercentage,
		widthPercentage:
			nodeConfig?.widthPercentage ?? DEFAULT_CROP.widthPercentage,
		heightPercentage:
			nodeConfig?.heightPercentage ?? DEFAULT_CROP.heightPercentage,
	}));
	const [drag, setDrag] = useState<DragState | null>(null);
	const [svgSize, setSvgSize] = useState({ w: 1, h: 1 });
	const [aspectPreset, setAspectPreset] = useState("Free");
	const [naturalSize, setNaturalSize] = useState<{
		w: number;
		h: number;
	} | null>(null);

	// customRatio: stored in **pixel space** (real px width / real px height).
	// Non-null only when preset is "Free" and the user has manually locked.
	const [customRatio, setCustomRatio] = useState<number | null>(null);

	/**
	 * effectiveRatio — the desired aspect ratio in **pixel space**.
	 * null  → free (unconstrained)
	 * number → enforce this pixel-space ratio while dragging / on preset change
	 */
	const effectiveRatio = useMemo<number | null>(() => {
		const preset = ASPECT_RATIO_PRESETS.find((p) => p.label === aspectPreset);
		return preset?.value ?? customRatio ?? null;
	}, [aspectPreset, customRatio]);

	/**
	 * effectivePctRatio — effectiveRatio converted to **percentage space**.
	 *
	 * The `constrain` function works purely in percentage coordinates
	 * (0–100 both axes).  Since the image is typically not square, a 1:1 pixel
	 * crop does NOT correspond to equal widthPct / heightPct values.
	 *
	 * Conversion:  pctRatio = pixelRatio * (naturalHeight / naturalWidth)
	 *
	 * This is the value that must be passed to `constrain` and used when
	 * computing new crop dimensions from a pixel ratio preset.
	 */
	const effectivePctRatio = useMemo<number | null>(() => {
		if (effectiveRatio === null) return null;
		return pixelRatioToPctRatio(effectiveRatio, naturalSize);
	}, [effectiveRatio, naturalSize]);

	const isLocked = effectiveRatio !== null;

	useEffect(() => {
		latestCropRef.current = crop;
	}, [crop]);

	// Sync external config changes into local state (e.g. undo/redo).
	useEffect(() => {
		if (nodeConfig) {
			setCrop({
				leftPercentage: nodeConfig.leftPercentage,
				topPercentage: nodeConfig.topPercentage,
				widthPercentage: nodeConfig.widthPercentage,
				heightPercentage: nodeConfig.heightPercentage,
			});
		}
	}, [nodeConfig]);

	// Observe container size for accurate px↔% translation during drag.
	useEffect(() => {
		if (!svgRef.current) return;
		const ro = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			if (width > 0 && height > 0) setSvgSize({ w: width, h: height });
		});
		ro.observe(svgRef.current);
		return () => ro.disconnect();
	}, []);

	const updateConfig = useCallback(
		(c: CropNodeConfig) =>
			dispatch(updateNodeConfig({ id: props.id, newConfig: c })),
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

			// pixelRatio is the desired real-pixel aspect ratio (e.g. 1 for 1:1).
			const pixelRatio = p.value;

			// pctRatio is the ratio in percentage space — accounts for the image's
			// own non-square aspect so the crop rectangle looks correct on screen.
			const pctRatio = pixelRatioToPctRatio(pixelRatio, naturalSize);

			setCrop((prev) => {
				const cx = prev.leftPercentage + prev.widthPercentage / 2;
				const cy = prev.topPercentage + prev.heightPercentage / 2;

				// Keep current width, derive height from the percentage-space ratio.
				let newW = prev.widthPercentage;
				let newH = newW / pctRatio;

				// If height would overflow, clamp via height and recompute width.
				if (newH > 100) {
					newH = 100;
					newW = newH * pctRatio;
				}

				const next = constrain(
					{
						leftPercentage: cx - newW / 2,
						topPercentage: cy - newH / 2,
						widthPercentage: newW,
						heightPercentage: newH,
					},
					pctRatio,
					"resize-se",
				);
				updateConfig(next);
				return next;
			});
		},
		[updateConfig, naturalSize],
	);

	const handleToggleLock = useCallback(() => {
		if (aspectPreset !== "Free") {
			// Preset active → unlock → switch to Free.
			setAspectPreset("Free");
			setCustomRatio(null);
		} else if (customRatio !== null) {
			// Free + locked → unlock.
			setCustomRatio(null);
		} else {
			// Free + unlocked → lock to current crop ratio.
			// Store in pixel space so it's consistent with preset values.
			const pixelRatio = pctRatioToPixelRatio(
				crop.widthPercentage / crop.heightPercentage,
				naturalSize,
			);
			setCustomRatio(pixelRatio);
		}
	}, [aspectPreset, customRatio, crop, naturalSize]);

	const handleReset = useCallback(() => {
		const next = { ...DEFAULT_CROP };
		setCrop(next);
		updateConfig(next);
		setAspectPreset("Free");
		setCustomRatio(null);
	}, [updateConfig]);

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

	// Global pointer handlers — attached only while dragging.
	useEffect(() => {
		if (!drag) return;

		const onMove = (e: PointerEvent) => {
			e.preventDefault();

			const dx = ((e.clientX - drag.startX) / svgSize.w) * 100;
			const dy = ((e.clientY - drag.startY) / svgSize.h) * 100;

			// Apply raw drag delta.
			const c: CropNodeConfig = { ...drag.startCrop };
			switch (drag.type) {
				case "move":
					c.leftPercentage += dx;
					c.topPercentage += dy;
					break;
				case "resize-nw":
					c.leftPercentage += dx;
					c.widthPercentage -= dx;
					c.topPercentage += dy;
					c.heightPercentage -= dy;
					break;
				case "resize-n":
					c.topPercentage += dy;
					c.heightPercentage -= dy;
					break;
				case "resize-ne":
					c.widthPercentage += dx;
					c.topPercentage += dy;
					c.heightPercentage -= dy;
					break;
				case "resize-e":
					c.widthPercentage += dx;
					break;
				case "resize-se":
					c.widthPercentage += dx;
					c.heightPercentage += dy;
					break;
				case "resize-s":
					c.heightPercentage += dy;
					break;
				case "resize-sw":
					c.leftPercentage += dx;
					c.widthPercentage -= dx;
					c.heightPercentage += dy;
					break;
				case "resize-w":
					c.leftPercentage += dx;
					c.widthPercentage -= dx;
					break;
			}

			// Use effectivePctRatio (percentage-space ratio) — NOT effectiveRatio
			// (pixel-space ratio) — so ratio is enforced correctly for non-square images.
			const next = constrain(c, effectivePctRatio, drag.type);
			setCrop(next);
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

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<style>{GLOBAL_STYLES}</style>

			<div className="select-none rounded-xl overflow-hidden bg-card border border-border">
				{/* ── Image + overlay ──────────────────────────────── */}
				<div
					ref={svgRef}
					className={cn("relative w-full bg-black/20", { "h-64": !imageUrl })}
					style={{ minHeight: imageUrl ? undefined : "12rem" }}
				>
					{imageUrl && (
						<>
							<div className="overflow-hidden w-full h-full">
								<CanvasRenderer imageUrl={imageUrl} />
								{/* Hidden img to read naturalWidth/Height */}
								<img
									ref={imgRef}
									src={imageUrl}
									alt=""
									className="hidden"
									onLoad={(e) => {
										const { naturalWidth: nw, naturalHeight: nh } =
											e.currentTarget;
										setNaturalSize({ w: nw, h: nh });
									}}
								/>
							</div>
							<CropOverlay
								crop={crop}
								svgSize={svgSize}
								isDragging={drag !== null}
								drag={drag}
								naturalSize={naturalSize}
								onStartDrag={startDrag}
							/>
						</>
					)}

					{!imageUrl && (
						<div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40 text-xs tracking-wide">
							No image connected
						</div>
					)}
				</div>

				{/* ── Config panel ─────────────────────────────────── */}
				<CropConfigPanel
					crop={crop}
					aspectRatioPreset={aspectPreset}
					isLocked={isLocked}
					naturalWidth={naturalSize?.w}
					naturalHeight={naturalSize?.h}
					onChange={(next) => {
						setCrop(next);
						updateConfig(next);
					}}
					onAspectRatioChange={handleAspectRatioChange}
					onToggleLock={handleToggleLock}
					onReset={handleReset}
				/>
			</div>
		</BaseNode>
	);
});

export { CropNodeComponent, CropConfigPanel };
