import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateId } from "@gatewai/core";
import {
	fontManager,
	GetAssetEndpoint,
	GetFontAssetUrl,
} from "@gatewai/core/browser";
import type {
	AnimationType,
	ExtendedLayer,
	FileData,
	OutputItem,
	VideoAnimation,
	VirtualMediaData,
} from "@gatewai/core/types";
import { dataTypeColors } from "@gatewai/core/types";
import type { HandleEntityType, NodeEntityType } from "@gatewai/react-store";
import {
	handleSelectors,
	useAppSelector,
	useGetFontListQuery,
} from "@gatewai/react-store";
import {
	CAPTION_LAYER_DEFAULTS,
	CompositionScene,
	computeVideoCropRenderProps,
	createVirtualMedia,
	getActiveMediaMetadata,
	TEXT_LAYER_DEFAULTS,
} from "@gatewai/remotion-compositions";
import { resolveMediaSourceUrlBrowser } from "@gatewai/remotion-compositions/browser";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	CollapsibleSection,
	ColorPicker,
	cn,
	DraggableNumberInput,
	Label,
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
	Popover,
	PopoverContent,
	PopoverTrigger,
	ScrollArea,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Slider,
	StyleControls,
	Switch,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
	TypographyControls,
} from "@gatewai/ui-kit";
import { Player, type PlayerRef } from "@remotion/player";
import {
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	Blend,
	Box,
	ChevronDown,
	ChevronRight,
	EyeOff,
	Film,
	GripHorizontal,
	GripVertical,
	Hand,
	Image as ImageIcon,
	Layers,
	Link as LinkIcon,
	Maximize2,
	Minus,
	MousePointer,
	Move,
	MoveHorizontal,
	MoveVertical,
	Music,
	Pause,
	Play,
	Plus,
	RotateCcw,
	RotateCw,
	Save,
	Settings2,
	Sparkles,
	Subtitles,
	Trash2,
	Type,
	Unlink as UnlinkIcon,
	Volume2,
	XIcon,
	Zap,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import React, {
	createContext,
	type Dispatch,
	type SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { VideoCompositorNodeConfig } from "../../../shared/config.js";
import { DEFAULT_DURATION_MS, FPS } from "../config/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorLayer = ExtendedLayer & {
	videoNaturalWidth?: number;
	videoNaturalHeight?: number;
	videoCropOffsetX?: number;
	videoCropOffsetY?: number;
	cropTranslatePercentageX?: number;
	cropTranslatePercentageY?: number;
	captionPreset?: "default" | "tiktok";
	useRoundedTextBox?: boolean;
};

type ResizeAnchor = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";
type EditorMode = "select" | "pan";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RULER_HEIGHT = 32;
const TRACK_HEIGHT = 34;
const HEADER_WIDTH = 200;
const DEFAULT_TIMELINE_HEIGHT = 220;
const MIN_TIMELINE_HEIGHT = 120;
const MAX_TIMELINE_HEIGHT = 500;
const OVERVIEW_HEIGHT = 20;

const ASPECT_RATIOS = [
	{ label: "Youtube / HD (16:9)", width: 1280, height: 720 },
	{ label: "Full HD (16:9)", width: 1920, height: 1080 },
	{ label: "TikTok / Reel (9:16)", width: 720, height: 1280 },
	{ label: "Square (1:1)", width: 1080, height: 1080 },
	{ label: "Portrait (4:5)", width: 1080, height: 1350 },
];

const ANIMATION_CATEGORIES = [
	{
		label: "Entrance",
		color: "text-emerald-400",
		bgColor: "bg-emerald-500/10",
		borderColor: "border-emerald-500/20",
		dotColor: "bg-emerald-400",
		animations: [
			{
				type: "fade-in" as AnimationType,
				label: "Fade In",
				icon: Sparkles,
				desc: "Smooth opacity fade",
			},
			{
				type: "slide-in-left" as AnimationType,
				label: "Slide Left",
				icon: ArrowRight,
				desc: "Enter from left",
			},
			{
				type: "slide-in-right" as AnimationType,
				label: "Slide Right",
				icon: ArrowLeft,
				desc: "Enter from right",
			},
			{
				type: "slide-in-top" as AnimationType,
				label: "Slide Down",
				icon: ArrowDown,
				desc: "Enter from top",
			},
			{
				type: "slide-in-bottom" as AnimationType,
				label: "Slide Up",
				icon: ArrowUp,
				desc: "Enter from bottom",
			},
			{
				type: "zoom-in" as AnimationType,
				label: "Zoom In",
				icon: ZoomIn,
				desc: "Scale up to full size",
			},
		],
	},
	{
		label: "Exit",
		color: "text-rose-400",
		bgColor: "bg-rose-500/10",
		borderColor: "border-rose-500/20",
		dotColor: "bg-rose-400",
		animations: [
			{
				type: "fade-out" as AnimationType,
				label: "Fade Out",
				icon: EyeOff,
				desc: "Fade to transparent",
			},
			{
				type: "zoom-out" as AnimationType,
				label: "Zoom Out",
				icon: ZoomOut,
				desc: "Scale down to nothing",
			},
		],
	},
	{
		label: "Emphasis",
		color: "text-amber-400",
		bgColor: "bg-amber-500/10",
		borderColor: "border-amber-500/20",
		dotColor: "bg-amber-400",
		animations: [
			{
				type: "rotate-cw" as AnimationType,
				label: "Rotate CW",
				icon: RotateCw,
				desc: "Spin clockwise",
			},
			{
				type: "rotate-ccw" as AnimationType,
				label: "Rotate CCW",
				icon: RotateCcw,
				desc: "Spin counter-clockwise",
			},
			{
				type: "bounce" as AnimationType,
				label: "Bounce",
				icon: ArrowUp,
				desc: "Elastic bounce",
			},
			{
				type: "shake" as AnimationType,
				label: "Shake",
				icon: Move,
				desc: "Vibrate horizontally",
			},
		],
	},
];

const ROUNDED_BOX_DEFAULTS = {
	backgroundColor: "rgba(0, 0, 0, 0.7)",
	padding: 16,
	borderRadius: 8,
} as const;

const SHADOW_PRESETS = [
	{
		label: "Soft",
		icon: "◌",
		val: "0px 4px 12px rgba(0,0,0,0.6)",
		preview: "0px 4px 12px rgba(0,0,0,0.6)",
	},
	{
		label: "Hard",
		icon: "◼",
		val: "3px 3px 0px rgba(0,0,0,0.9)",
		preview: "3px 3px 0px rgba(0,0,0,0.9)",
	},
	{
		label: "Glow",
		icon: "✦",
		val: "0px 0px 10px rgba(255,255,255,0.8)",
		preview: "0px 0px 10px rgba(255,255,255,0.8)",
	},
	{
		label: "Neon",
		icon: "⚡",
		val: "0px 0px 15px rgba(59,130,246,0.9)",
		preview: "0px 0px 15px rgba(59,130,246,0.9)",
	},
];

const TEXT_BOX_PRESETS = [
	{
		label: "Pill",
		padding: 20,
		borderRadius: 999,
		backgroundColor: "rgba(0,0,0,0.75)",
	},
	{
		label: "Chip",
		padding: 12,
		borderRadius: 6,
		backgroundColor: "rgba(0,0,0,0.6)",
	},
	{ label: "Bold", padding: 16, borderRadius: 4, backgroundColor: "#000000" },
	{
		label: "Frosted",
		padding: 18,
		borderRadius: 16,
		backgroundColor: "rgba(255,255,255,0.15)",
	},
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isFileMedia = (type: string): boolean =>
	type === "Image" || type === "SVG" || type === "Caption";

const isCaptionLayer = (type: string): boolean => type === "Caption";

const roundToEven = (num?: number) => Math.round((num ?? 0) / 2) * 2;

const getEffectiveDurationMs = (
	virtualMedia: VirtualMediaData | undefined | null,
	accumulatedStartSec = 0,
): number | null => {
	if (!virtualMedia) return null;
	const op = virtualMedia.operation;

	if (op?.op === "cut") {
		const cutStart = (Number(op.startSec) || 0) + accumulatedStartSec;
		const cutEnd = Number(op.endSec) || 0;
		const cutDurationMs = Math.max(0, cutEnd - cutStart) * 1000;
		const child = virtualMedia.children?.[0];
		if (child) {
			const childDurationMs = getEffectiveDurationMs(child, cutStart);
			if (childDurationMs !== null)
				return Math.min(cutDurationMs, childDurationMs);
		}
		return cutDurationMs;
	}

	if (op?.op === "speed") {
		const rate = Number(op.rate) || 1;
		const child = virtualMedia.children?.[0];
		if (child) {
			const childMs = getEffectiveDurationMs(child, accumulatedStartSec / rate);
			if (childMs !== null) return childMs * rate;
		}
		return null;
	}

	for (const child of virtualMedia.children ?? []) {
		const found = getEffectiveDurationMs(child, accumulatedStartSec);
		if (found !== null) return found;
	}

	return null;
};

const measureText = (text: string, style: Partial<EditorLayer>) => {
	if (typeof document === "undefined") return { width: 100, height: 40 };

	const d = document.createElement("div");
	Object.assign(d.style, {
		fontFamily: style.fontFamily ?? "Inter",
		fontSize: `${style.fontSize ?? 40}px`,
		fontWeight: style.fontWeight ?? "normal",
		fontStyle: style.fontStyle ?? "normal",
		letterSpacing: `${style.letterSpacing ?? 0}px`,
		lineHeight: `${style.lineHeight ?? 1.2}`,
		padding: `${style.padding ?? 0}px`,
		position: "absolute",
		visibility: "hidden",
		whiteSpace: "pre",
		width: "max-content",
	});
	d.textContent = text;
	document.body.appendChild(d);
	const width = d.offsetWidth;
	const height = d.offsetHeight;
	document.body.removeChild(d);

	return { width, height };
};

const fetchSrtDurationMs = async (url: string): Promise<number | null> => {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		const text = await res.text();
		const RE_TIMESTAMP =
			/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/g;
		let maxEndMs = 0;
		let match: RegExpExecArray | null;
		while ((match = RE_TIMESTAMP.exec(text)) !== null) {
			const endMs =
				Number(match[5]) * 3_600_000 +
				Number(match[6]) * 60_000 +
				Number(match[7]) * 1_000 +
				Number(match[8]);
			if (endMs > maxEndMs) maxEndMs = endMs;
		}
		return maxEndMs > 0 ? maxEndMs : null;
	} catch {
		return null;
	}
};

const resolveColorConfig = (layer: EditorLayer) => {
	return (
		dataTypeColors[layer.type] ?? {
			bg: "bg-gray-600",
			border: "border-gray-500",
			text: "text-gray-100",
			hex: "#4b5563",
		}
	);
};

const resolveLayerLabel = (
	handle: HandleEntityType | undefined,
	layer: EditorLayer,
): string => {
	if (
		handle?.label &&
		typeof handle.label === "string" &&
		handle.label.trim() !== ""
	) {
		return handle.label;
	}
	if (
		Array.isArray(handle?.dataTypes) &&
		handle.dataTypes.length > 0 &&
		handle.dataTypes[0]
	) {
		return handle.dataTypes[0];
	}
	return layer.name ?? layer.id;
};

const serializeLayersForSave = (layers: EditorLayer[]) =>
	layers.reduce<
		Record<
			string,
			Omit<
				EditorLayer,
				| "src"
				| "text"
				| "isPlaceholder"
				| "videoNaturalWidth"
				| "videoNaturalHeight"
				| "cropTranslatePercentageX"
				| "cropTranslatePercentageY"
			>
		>
	>((acc, layer) => {
		const {
			src,
			text,
			isPlaceholder,
			videoNaturalWidth,
			videoNaturalHeight,
			cropTranslatePercentageX,
			cropTranslatePercentageY,
			...savedLayer
		} = layer;
		acc[layer.id] = savedLayer;
		return acc;
	}, {});

const parseTextShadowStr = (shadowStr?: string) => {
	if (!shadowStr) return null;
	const match = shadowStr.match(
		/^\s*(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(.+)\s*$/,
	);
	if (match) {
		return {
			x: parseFloat(match[1]),
			y: parseFloat(match[2]),
			blur: parseFloat(match[3]),
			color: match[4].trim(),
		};
	}
	return { x: 2, y: 2, blur: 4, color: "rgba(0,0,0,0.75)" };
};

// ---------------------------------------------------------------------------
// Zoom helpers — log-scale mapping
// ---------------------------------------------------------------------------

/** Minimum pixels-per-second: 1 hour fits in ~900px → 0.25 px/sec */
const TIMELINE_MIN_PPS = 0.25;
/** Maximum pixels-per-second: 20px per frame at 30fps → 600 px/sec */
const TIMELINE_MAX_PPS = 600;

const ppsFromNorm = (norm: number) =>
	TIMELINE_MIN_PPS *
	(TIMELINE_MAX_PPS / TIMELINE_MIN_PPS) ** Math.max(0, Math.min(1, norm));

const normFromPps = (pps: number) =>
	Math.log(Math.max(TIMELINE_MIN_PPS, pps) / TIMELINE_MIN_PPS) /
	Math.log(TIMELINE_MAX_PPS / TIMELINE_MIN_PPS);

/** Returns a human-readable label for the current zoom level */
const zoomScaleLabel = (pps: number): string => {
	if (pps >= 200) return `${Math.round(1000 / pps)}ms`;
	if (pps >= 10) return `${(1 / pps).toFixed(2)}s/px`;
	if (pps >= 1) return `${(1 / pps).toFixed(1)}s/px`;
	const minPerPx = 1 / pps / 60;
	if (minPerPx < 1) return `${(1 / pps).toFixed(0)}s/px`;
	return `${minPerPx.toFixed(1)}m/px`;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface EditorContextType {
	layers: EditorLayer[];
	updateLayers: (
		updater: SetStateAction<EditorLayer[]>,
		isUserChange?: boolean,
	) => void;
	deleteLayer: (id: string) => void;
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;
	getTextData: (id: string) => string;
	getAssetUrl: (id: string) => string | undefined;
	fps: number;
	setFps: (fps: number) => void;
	backgroundColor: string;
	setBackgroundColor: (color: string) => void;
	getMediaDuration: (
		id: string | undefined | null,
	) => number | null | undefined;
	viewportWidth: number;
	viewportHeight: number;
	updateViewportWidth: (w: number) => void;
	updateViewportHeight: (h: number) => void;
	durationInMS: number;
	currentFrame: number;
	setCurrentFrame: (frame: number) => void;
	isPlaying: boolean;
	setIsPlaying: (playing: boolean) => void;
	playerRef: React.RefObject<PlayerRef | null>;
	zoom: number;
	setZoom: Dispatch<SetStateAction<number>>;
	pan: { x: number; y: number };
	setPan: Dispatch<SetStateAction<{ x: number; y: number }>>;
	zoomIn: () => void;
	zoomOut: () => void;
	zoomTo: (val: number) => void;
	fitView: () => void;
	mode: EditorMode;
	setMode: Dispatch<SetStateAction<EditorMode>>;
	isDirty: boolean;
	setIsDirty: Dispatch<SetStateAction<boolean>>;
	timelineScrollRef: React.RefObject<HTMLDivElement | null>;
	timelineHeight: number;
	setTimelineHeight: Dispatch<SetStateAction<number>>;
	initialLayersData: Map<string, OutputItem<any>>;
	markLayerTrimmed: (id: string) => void;
	isLayerTrimmed: (id: string) => boolean;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

const useEditor = () => {
	const ctx = useContext(EditorContext);
	if (!ctx) throw new Error("useEditor must be used within EditorProvider");
	return ctx;
};

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

const LayerIcon: React.FC<{ type: string; className?: string }> = ({
	type,
	className = "w-3 h-3",
}) => {
	const icons: Record<string, React.ReactNode> = {
		Video: <Film className={className} />,
		Audio: <Music className={className} />,
		Image: <ImageIcon className={className} />,
		SVG: <ImageIcon className={className} />,
		Text: <Type className={className} />,
		Caption: <Subtitles className={className} />,
	};
	return <>{icons[type] ?? <Layers className={className} />}</>;
};

const WithTooltip: React.FC<{
	tip: React.ReactNode;
	children: React.ReactElement;
}> = ({ tip, children }) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>{children}</TooltipTrigger>
			<TooltipContent>{tip}</TooltipContent>
		</Tooltip>
	</TooltipProvider>
);

// ---------------------------------------------------------------------------
// TextShadowSection
// ---------------------------------------------------------------------------

const TextShadowSection: React.FC<{
	layer: EditorLayer;
	update: (patch: Partial<EditorLayer>) => void;
}> = ({ layer, update }) => {
	const shadowParams = useMemo(
		() => parseTextShadowStr(layer.textShadow),
		[layer.textShadow],
	);
	const isOn = !!layer.textShadow;

	const handleToggle = (checked: boolean) => {
		if (checked) update({ textShadow: "0px 4px 12px rgba(0,0,0,0.6)" });
		else update({ textShadow: undefined });
	};

	const updateParam = (key: "x" | "y" | "blur" | "color", val: any) => {
		const current = shadowParams || {
			x: 0,
			y: 4,
			blur: 12,
			color: "rgba(0,0,0,0.6)",
		};
		const next = { ...current, [key]: val };
		update({
			textShadow: `${next.x}px ${next.y}px ${next.blur}px ${next.color}`,
		});
	};

	if (layer.type !== "Text" && layer.type !== "Caption") return null;

	return (
		<CollapsibleSection title="Drop Shadow" icon={Blend} defaultOpen>
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Blend className="w-3.5 h-3.5 text-purple-400" />
						<span className="text-[11px] text-gray-300">Text Shadow</span>
					</div>
					<Switch
						checked={isOn}
						onCheckedChange={handleToggle}
						className="data-[state=checked]:bg-purple-500"
					/>
				</div>

				{isOn && shadowParams && (
					<>
						<div className="space-y-1.5">
							<span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
								Shadow Color
							</span>
							<ColorPicker
								value={shadowParams.color}
								onChange={(v) => updateParam("color", v)}
							/>
						</div>
						<div className="grid grid-cols-3 gap-2">
							<div className="space-y-1">
								<span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">
									X Offset
								</span>
								<DraggableNumberInput
									label="px"
									value={shadowParams.x}
									onChange={(v) => updateParam("x", v)}
								/>
							</div>
							<div className="space-y-1">
								<span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">
									Y Offset
								</span>
								<DraggableNumberInput
									label="px"
									value={shadowParams.y}
									onChange={(v) => updateParam("y", v)}
								/>
							</div>
							<div className="space-y-1">
								<span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">
									Blur
								</span>
								<DraggableNumberInput
									label="px"
									value={shadowParams.blur}
									onChange={(v) => updateParam("blur", Math.max(0, v))}
								/>
							</div>
						</div>
						<div className="space-y-1.5">
							<span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
								Quick Presets
							</span>
							<div className="grid grid-cols-4 gap-1.5">
								{SHADOW_PRESETS.map((preset) => {
									const isActive = layer.textShadow === preset.val;
									return (
										<button
											key={preset.label}
											type="button"
											onClick={() => update({ textShadow: preset.val })}
											className={cn(
												"relative flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer",
												isActive
													? "border-purple-500/60 bg-purple-500/10 ring-1 ring-purple-500/30"
													: "border-white/8 bg-white/3 hover:bg-white/8 hover:border-white/20",
											)}
										>
											<span
												className="text-sm font-bold text-white leading-none select-none"
												style={{ textShadow: preset.preview }}
											>
												Aa
											</span>
											<span className="text-[9px] text-gray-400 font-medium leading-none">
												{preset.label}
											</span>
											{isActive && (
												<span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-400" />
											)}
										</button>
									);
								})}
							</div>
						</div>
					</>
				)}
			</div>
		</CollapsibleSection>
	);
};

// ---------------------------------------------------------------------------
// AnimationsInspectorSection
// ---------------------------------------------------------------------------

const AnimationsInspectorSection: React.FC<{
	layer: EditorLayer;
	update: (patch: Partial<EditorLayer>) => void;
}> = ({ layer, update }) => {
	const [showPicker, setShowPicker] = useState(false);
	const [hoveredType, setHoveredType] = useState<AnimationType | null>(null);

	const addAnimation = (type: AnimationType) => {
		const newAnimation: VideoAnimation = { id: generateId(), type, value: 1 };
		update({ animations: [...(layer.animations || []), newAnimation] });
	};

	const updateAnimation = (animId: string, patch: Partial<VideoAnimation>) => {
		update({
			animations: (layer.animations || []).map((a) =>
				a.id === animId ? { ...a, ...patch } : a,
			),
		});
	};

	const removeAnimation = (animId: string) => {
		update({
			animations: (layer.animations || []).filter((a) => a.id !== animId),
		});
	};

	const getAnimMeta = (type: AnimationType) => {
		for (const cat of ANIMATION_CATEGORIES) {
			const found = cat.animations.find((a) => a.type === type);
			if (found) return { ...found, catColor: cat.color, catBg: cat.bgColor };
		}
		return {
			label: type,
			icon: Zap,
			catColor: "text-gray-400",
			catBg: "bg-gray-500/10",
			desc: "",
		};
	};

	const alreadyAdded = new Set((layer.animations || []).map((a) => a.type));

	return (
		<CollapsibleSection title="Animations" icon={Zap} defaultOpen>
			<div className="space-y-2.5">
				{layer.animations && layer.animations.length > 0 && (
					<div className="space-y-1.5">
						{layer.animations.map((anim) => {
							const meta = getAnimMeta(anim.type);
							const Icon = meta.icon;
							return (
								<div
									key={anim.id}
									className="group relative flex flex-col gap-2 bg-black/25 border border-white/8 rounded-xl p-3 transition-all hover:border-white/15 hover:bg-black/35"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2.5">
											<div className={cn("p-2 rounded-lg", meta.catBg)}>
												<Icon className={cn("w-3.5 h-3.5", meta.catColor)} />
											</div>
											<div className="flex flex-col">
												<span className="text-[11px] font-semibold text-gray-100 leading-tight">
													{meta.label}
												</span>
												<span className="text-[9px] text-gray-500 leading-tight mt-0.5">
													{meta.desc}
												</span>
											</div>
										</div>
										<button
											type="button"
											className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
											onClick={() => removeAnimation(anim.id)}
										>
											<Trash2 className="w-3.5 h-3.5" />
										</button>
									</div>
									<div className="flex items-center gap-2.5 px-0.5">
										<span className="text-[9px] font-bold uppercase tracking-widest text-gray-600 w-12 shrink-0">
											Duration
										</span>
										<Slider
											value={[anim.value]}
											min={0.1}
											max={5}
											step={0.1}
											onValueChange={([v]) =>
												updateAnimation(anim.id, { value: v })
											}
											className="flex-1"
										/>
										<span className="text-[10px] font-mono text-gray-400 w-8 text-right shrink-0">
											{anim.value.toFixed(1)}s
										</span>
									</div>
								</div>
							);
						})}
					</div>
				)}

				<button
					type="button"
					onClick={() => setShowPicker((v) => !v)}
					className={cn(
						"w-full flex items-center justify-between h-9 px-3 rounded-xl border text-[11px] font-medium transition-all duration-150",
						showPicker
							? "border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/15"
							: "border-dashed border-white/15 bg-transparent text-gray-400 hover:bg-white/5 hover:border-white/25 hover:text-gray-200",
					)}
				>
					<span className="flex items-center gap-2">
						<Plus
							className={cn(
								"w-3.5 h-3.5 transition-transform",
								showPicker && "rotate-45",
							)}
						/>
						{showPicker ? "Close picker" : "Add Animation"}
					</span>
					<ChevronRight
						className={cn(
							"w-3.5 h-3.5 transition-transform duration-200",
							showPicker && "rotate-90",
						)}
					/>
				</button>

				{showPicker && (
					<div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
						{ANIMATION_CATEGORIES.map((cat, catIdx) => (
							<div
								key={cat.label}
								className={cn(catIdx > 0 && "border-t border-white/5")}
							>
								<div className="flex items-center gap-2 px-3 py-2 bg-black/20">
									<span
										className={cn(
											"w-1.5 h-1.5 rounded-full shrink-0",
											cat.dotColor,
										)}
									/>
									<span
										className={cn(
											"text-[10px] font-bold uppercase tracking-widest",
											cat.color,
										)}
									>
										{cat.label}
									</span>
								</div>
								<div className="grid grid-cols-3 gap-1.5 p-2">
									{cat.animations.map((a) => {
										const isAdded = alreadyAdded.has(a.type);
										const isHovered = hoveredType === a.type;
										return (
											<button
												key={a.type}
												type="button"
												disabled={isAdded}
												onClick={() => addAnimation(a.type)}
												onMouseEnter={() => setHoveredType(a.type)}
												onMouseLeave={() => setHoveredType(null)}
												className={cn(
													"relative flex flex-col items-center gap-2 py-3 px-1.5 rounded-lg border transition-all duration-150 cursor-pointer group/card",
													isAdded
														? "border-white/5 bg-white/2 opacity-40 cursor-not-allowed"
														: isHovered
															? `${cat.borderColor} ${cat.bgColor}`
															: "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/18",
												)}
											>
												<div
													className={cn(
														"p-2.5 rounded-lg transition-colors",
														isHovered && !isAdded ? cat.bgColor : "bg-white/5",
													)}
												>
													<a.icon
														className={cn(
															"w-4 h-4 transition-colors",
															isHovered && !isAdded
																? cat.color
																: "text-gray-400",
														)}
													/>
												</div>
												<div className="flex flex-col items-center gap-0.5">
													<span className="text-[10px] font-semibold text-gray-200 text-center leading-tight">
														{a.label}
													</span>
													<span className="text-[8.5px] text-gray-500 text-center leading-tight">
														{a.desc}
													</span>
												</div>
												{isAdded && (
													<span className="absolute top-1.5 right-1.5 text-[8px] font-bold text-gray-500">
														✓
													</span>
												)}
											</button>
										);
									})}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</CollapsibleSection>
	);
};

// ---------------------------------------------------------------------------
// TextBoxSection
// ---------------------------------------------------------------------------

const TextBoxSection: React.FC<{
	layer: EditorLayer;
	update: (patch: Partial<EditorLayer>) => void;
}> = ({ layer, update }) => {
	const isOn = layer.useRoundedTextBox === true;

	const handleToggle = (checked: boolean) => {
		if (checked) {
			update({
				useRoundedTextBox: true,
				backgroundColor:
					layer.backgroundColor ?? ROUNDED_BOX_DEFAULTS.backgroundColor,
				padding: layer.padding ?? ROUNDED_BOX_DEFAULTS.padding,
				borderRadius: layer.borderRadius ?? ROUNDED_BOX_DEFAULTS.borderRadius,
			});
		} else {
			update({ useRoundedTextBox: false, backgroundColor: undefined });
		}
	};

	return (
		<CollapsibleSection title="Text Box" icon={Box} defaultOpen>
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Box className="w-3.5 h-3.5 text-blue-400" />
						<span className="text-[11px] text-gray-300">
							Rounded Background
						</span>
					</div>
					<Switch
						checked={isOn}
						onCheckedChange={handleToggle}
						className="data-[state=checked]:bg-blue-500"
					/>
				</div>

				{isOn && (
					<>
						<div className="space-y-1.5">
							<span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
								Background Colour
							</span>
							<ColorPicker
								value={
									layer.backgroundColor ?? ROUNDED_BOX_DEFAULTS.backgroundColor
								}
								onChange={(v) => update({ backgroundColor: v })}
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-1">
								<span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">
									H-Padding
								</span>
								<DraggableNumberInput
									label="px"
									icon={MoveHorizontal}
									value={layer.padding ?? ROUNDED_BOX_DEFAULTS.padding}
									onChange={(v) => update({ padding: Math.max(0, v) })}
								/>
							</div>
							<div className="space-y-1">
								<span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">
									Corner Radius
								</span>
								<DraggableNumberInput
									label="px"
									icon={Box}
									value={
										layer.borderRadius ?? ROUNDED_BOX_DEFAULTS.borderRadius
									}
									onChange={(v) => update({ borderRadius: Math.max(0, v) })}
								/>
							</div>
						</div>
						<div className="space-y-1.5">
							<span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
								Quick Presets
							</span>
							<div className="grid grid-cols-2 gap-1.5">
								{TEXT_BOX_PRESETS.map((preset) => {
									const isActive =
										layer.padding === preset.padding &&
										layer.borderRadius === preset.borderRadius &&
										layer.backgroundColor === preset.backgroundColor;
									return (
										<button
											key={preset.label}
											type="button"
											onClick={() =>
												update({
													padding: preset.padding,
													borderRadius: preset.borderRadius,
													backgroundColor: preset.backgroundColor,
												})
											}
											className={cn(
												"relative flex flex-col items-center gap-2 py-3 px-2 rounded-lg border transition-all duration-150 cursor-pointer",
												isActive
													? "border-blue-500/50 bg-blue-500/8 ring-1 ring-blue-500/20"
													: "border-white/8 bg-white/2 hover:bg-white/6 hover:border-white/18",
											)}
										>
											<div
												className="text-[10px] font-semibold text-white leading-none select-none"
												style={{
													backgroundColor: preset.backgroundColor,
													borderRadius: Math.min(preset.borderRadius, 14),
													padding: `4px ${Math.min(preset.padding * 0.45, 12)}px`,
												}}
											>
												{preset.label}
											</div>
											<span className="text-[9px] text-gray-500 leading-none">
												r={Math.min(preset.borderRadius, 999)} p=
												{preset.padding}
											</span>
											{isActive && (
												<span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
											)}
										</button>
									);
								})}
							</div>
						</div>
					</>
				)}
			</div>
		</CollapsibleSection>
	);
};

// ---------------------------------------------------------------------------
// UnifiedClip — enhanced with duration label and better resize handles
// ---------------------------------------------------------------------------

const UnifiedClip: React.FC<{
	layer: EditorLayer;
	isSelected: boolean;
	pixelsPerSecond: number;
	fps: number;
}> = ({ layer, isSelected, pixelsPerSecond, fps }) => {
	const handles = useAppSelector(handleSelectors.selectEntities);
	const handleId = layer.inputHandleId ?? "";
	const handle = handleId ? handles[handleId] : undefined;
	const name = resolveLayerLabel(handle, layer);
	const baseConfig = resolveColorConfig(layer);

	const durationMs = layer.durationInMS ?? DEFAULT_DURATION_MS;
	const durationSec = durationMs / 1000;
	const clipWidthPx = durationSec * pixelsPerSecond;

	// Only show duration when clip is wide enough (>60px)
	const showDuration = clipWidthPx > 60;
	const showName = clipWidthPx > 36;

	const formatDuration = (ms: number) => {
		const s = ms / 1000;
		if (s < 60) return `${s.toFixed(1)}s`;
		const m = Math.floor(s / 60);
		const rem = (s % 60).toFixed(0).padStart(2, "0");
		return `${m}:${rem}`;
	};

	return (
		<div
			className={cn(
				"h-full w-full relative overflow-hidden rounded-[5px] transition-all duration-75 border",
				baseConfig.bg,
				baseConfig.border,
				isSelected
					? "brightness-125 ring-1 ring-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
					: "opacity-80 hover:opacity-100 hover:brightness-110",
			)}
		>
			{/* Subtle diagonal texture */}
			<div
				className="absolute inset-0 opacity-[0.07] pointer-events-none"
				style={{
					backgroundImage:
						"repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0px, rgba(255,255,255,0.3) 1px, transparent 1px, transparent 6px)",
				}}
			/>
			{/* Left fade for visual depth */}
			<div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" />

			{/* Content */}
			<div className="absolute inset-0 px-2 flex items-center justify-between gap-1 pointer-events-none overflow-hidden">
				{showName && (
					<div className="flex items-center gap-1.5 min-w-0 flex-1">
						<LayerIcon
							type={layer.type}
							className="w-2.5 h-2.5 text-white/80 shrink-0"
						/>
						<span className="text-[10px] text-white font-semibold truncate drop-shadow select-none leading-none">
							{name}
						</span>
					</div>
				)}
				{showDuration && (
					<span className="text-[9px] font-mono text-white/50 shrink-0 select-none">
						{formatDuration(durationMs)}
					</span>
				)}
			</div>

			{/* Indicators */}
			{layer.useRoundedTextBox && (
				<div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center bg-blue-500/20 px-1 py-0.5 rounded text-[7px] font-bold text-blue-300 border border-blue-500/30 pointer-events-none">
					<Box className="w-2 h-2" />
				</div>
			)}

			{/* Selection border indicators */}
			{isSelected && (
				<>
					<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/50 rounded-l" />
					<div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/50 rounded-r" />
				</>
			)}
		</div>
	);
};

// ---------------------------------------------------------------------------
// InteractionOverlay
// ---------------------------------------------------------------------------

const RESIZE_HANDLE_CONFIG: Array<{
	pos: ResizeAnchor;
	cursor: string;
	posClass: string;
}> = [
	{ pos: "tl", cursor: "cursor-nwse-resize", posClass: "-top-1.5 -left-1.5" },
	{
		pos: "t",
		cursor: "cursor-ns-resize",
		posClass: "-top-1.5 left-1/2 -translate-x-1/2",
	},
	{ pos: "tr", cursor: "cursor-nesw-resize", posClass: "-top-1.5 -right-1.5" },
	{
		pos: "r",
		cursor: "cursor-ew-resize",
		posClass: "top-1/2 -right-1.5 -translate-y-1/2",
	},
	{
		pos: "br",
		cursor: "cursor-nwse-resize",
		posClass: "-bottom-1.5 -right-1.5",
	},
	{
		pos: "b",
		cursor: "cursor-ns-resize",
		posClass: "-bottom-1.5 left-1/2 -translate-x-1/2",
	},
	{
		pos: "bl",
		cursor: "cursor-nesw-resize",
		posClass: "-bottom-1.5 -left-1.5",
	},
	{
		pos: "l",
		cursor: "cursor-ew-resize",
		posClass: "top-1/2 -left-1.5 -translate-y-1/2",
	},
];

const InteractionOverlay: React.FC = () => {
	const {
		layers,
		selectedId,
		setSelectedId,
		updateLayers,
		zoom,
		pan,
		viewportWidth,
		viewportHeight,
		currentFrame,
		mode,
		setPan,
	} = useEditor();

	const [isDragging, setIsDragging] = useState(false);
	const [isResizing, setIsResizing] = useState(false);
	const [isRotating, setIsRotating] = useState(false);
	const [isPanning, setIsPanning] = useState(false);
	const [resizeAnchor, setResizeAnchor] = useState<ResizeAnchor | null>(null);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [initialPan, setInitialPan] = useState({ x: 0, y: 0 });
	const [initialPos, setInitialPos] = useState({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		rotation: 0,
		scale: 1,
	});
	const [initialAngle, setInitialAngle] = useState(0);

	const visibleLayers = layers
		.filter(
			(l) =>
				l.type !== "Audio" &&
				currentFrame >= (l.startFrame ?? 0) &&
				currentFrame <
					(l.startFrame ?? 0) +
						((l.durationInMS ?? DEFAULT_DURATION_MS) / 1000) * FPS,
		)
		.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

	const captureLayer = (layerId: string) => {
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return null;
		return {
			x: layer.x,
			y: layer.y,
			width: layer.width ?? 0,
			height: layer.height ?? 0,
			rotation: layer.rotation,
			scale: layer.scale ?? 1,
		};
	};

	const handleMouseDown = (
		e: React.MouseEvent,
		layerId?: string,
		anchor?: ResizeAnchor,
	) => {
		if (e.button === 1 || mode === "pan") {
			e.preventDefault();
			setIsPanning(true);
			setDragStart({ x: e.clientX, y: e.clientY });
			setInitialPan({ x: pan.x, y: pan.y });
			return;
		}
		if (e.button !== 0) return;
		e.stopPropagation();
		if (!layerId) {
			setSelectedId(null);
			return;
		}
		const pos = captureLayer(layerId);
		if (!pos) return;
		setSelectedId(layerId);
		setDragStart({ x: e.clientX, y: e.clientY });
		setInitialPos(pos);
		if (anchor) {
			setIsResizing(true);
			setResizeAnchor(anchor);
		} else setIsDragging(true);
	};

	const handleRotateStart = (e: React.MouseEvent, layerId: string) => {
		e.stopPropagation();
		e.preventDefault();
		setSelectedId(layerId);
		const pos = captureLayer(layerId);
		if (!pos) return;
		const centerX = pos.x + pos.width / 2;
		const centerY = pos.y + pos.height / 2;
		setInitialAngle(
			Math.atan2(
				e.clientY - (centerY * zoom + pan.y),
				e.clientX - (centerX * zoom + pan.x),
			),
		);
		setInitialPos(pos);
		setIsRotating(true);
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isPanning) {
			setPan({
				x: initialPan.x + (e.clientX - dragStart.x),
				y: initialPan.y + (e.clientY - dragStart.y),
			});
			return;
		}
		if (!selectedId) return;
		const dx = (e.clientX - dragStart.x) / zoom;
		const dy = (e.clientY - dragStart.y) / zoom;

		if (isDragging) {
			updateLayers((prev) =>
				prev.map((l) =>
					l.id === selectedId
						? {
								...l,
								x: Math.round(initialPos.x + dx),
								y: Math.round(initialPos.y + dy),
							}
						: l,
				),
			);
			return;
		}

		if (isResizing && resizeAnchor) {
			const layer = layers.find((l) => l.id === selectedId);
			const theta = initialPos.rotation * (Math.PI / 180);
			const cos = Math.cos(theta);
			const sin = Math.sin(theta);
			const localDx = (cos * dx + sin * dy) / initialPos.scale;
			const localDy = (-sin * dx + cos * dy) / initialPos.scale;

			let effectiveAnchor = resizeAnchor;
			if (layer?.lockAspect) {
				if (resizeAnchor === "r") effectiveAnchor = "br";
				if (resizeAnchor === "l") effectiveAnchor = "bl";
				if (resizeAnchor === "b") effectiveAnchor = "br";
				if (resizeAnchor === "t") effectiveAnchor = "tr";
			}

			const signW = effectiveAnchor.includes("l")
				? -1
				: effectiveAnchor.includes("r")
					? 1
					: 0;
			const signH = effectiveAnchor.includes("t")
				? -1
				: effectiveAnchor.includes("b")
					? 1
					: 0;

			let changeW = signW !== 0 ? localDx * signW : 0;
			let changeH = signH !== 0 ? localDy * signH : 0;

			if (layer?.lockAspect) {
				const ratio = initialPos.height / initialPos.width || 1;
				if (resizeAnchor === "r" || resizeAnchor === "l")
					changeH = changeW * ratio;
				else if (resizeAnchor === "b" || resizeAnchor === "t")
					changeW = changeH / ratio;
				else {
					if (Math.abs(changeW) * ratio > Math.abs(changeH))
						changeH = changeW * ratio;
					else changeW = changeH / ratio;
				}
			}

			const newWidth = Math.max(10, initialPos.width + changeW);
			const newHeight = Math.max(10, initialPos.height + changeH);
			const diffW = newWidth - initialPos.width;
			const diffH = newHeight - initialPos.height;
			const localShiftX = effectiveAnchor.includes("r")
				? diffW / 2
				: effectiveAnchor.includes("l")
					? -diffW / 2
					: 0;
			const localShiftY = effectiveAnchor.includes("b")
				? diffH / 2
				: effectiveAnchor.includes("t")
					? -diffH / 2
					: 0;

			updateLayers((prev) =>
				prev.map((l) =>
					l.id === selectedId
						? {
								...l,
								width: Math.round(newWidth),
								height: Math.round(newHeight),
								x: Math.round(
									initialPos.x +
										(cos * localShiftX - sin * localShiftY) -
										diffW / 2,
								),
								y: Math.round(
									initialPos.y +
										(sin * localShiftX + cos * localShiftY) -
										diffH / 2,
								),
								autoDimensions: false,
							}
						: l,
				),
			);
			return;
		}

		if (isRotating) {
			const layer = layers.find((l) => l.id === selectedId);
			if (!layer) return;
			const centerX = layer.x + (layer.width ?? 0) / 2;
			const centerY = layer.y + (layer.height ?? 0) / 2;
			const currentAngle = Math.atan2(
				e.clientY - (centerY * zoom + pan.y),
				e.clientX - (centerX * zoom + pan.x),
			);
			const newRot =
				initialPos.rotation + ((currentAngle - initialAngle) * 180) / Math.PI;
			updateLayers((prev) =>
				prev.map((l) =>
					l.id === selectedId ? { ...l, rotation: Math.round(newRot) } : l,
				),
			);
		}
	};

	const handleMouseUp = () => {
		setIsDragging(false);
		setIsResizing(false);
		setResizeAnchor(null);
		setIsRotating(false);
		setIsPanning(false);
	};

	return (
		<div
			className="absolute inset-0 z-10 overflow-hidden outline-none"
			style={{ cursor: isPanning || mode === "pan" ? "grab" : "default" }}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onMouseDown={handleMouseDown}
			role="button"
			tabIndex={0}
		>
			<div
				className="absolute origin-top-left"
				style={{
					width: viewportWidth,
					height: viewportHeight,
					transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
				}}
			>
				{visibleLayers.map((layer) => (
					<button
						key={layer.id}
						type="button"
						onKeyDown={(e: React.KeyboardEvent) => {
							if (e.key === "Enter") setSelectedId(layer.id);
						}}
						onMouseDown={(e: React.MouseEvent) => handleMouseDown(e, layer.id)}
						className={`absolute group outline-none select-none p-0 m-0 border-0 bg-transparent text-left ${selectedId === layer.id ? "z-50" : "z-auto"}`}
						style={{
							left: layer.x,
							top: layer.y,
							width: layer.width,
							height: layer.height,
							transform: `rotate(${layer.rotation}deg) scale(${layer.scale})`,
							transformOrigin: "center center",
							boxSizing: "border-box",
						}}
					>
						<div
							className={`absolute inset-0 pointer-events-none transition-all duration-150 ${selectedId === layer.id ? "border-2 border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]" : "border border-transparent group-hover:border-blue-400/50"}`}
						/>
						{selectedId === layer.id && (
							<>
								{layer.type !== "Text" &&
									!isCaptionLayer(layer.type) &&
									RESIZE_HANDLE_CONFIG.map(({ pos, cursor, posClass }) => (
										<div
											key={pos}
											role="button"
											tabIndex={-1}
											className={`absolute bg-white border border-blue-600 rounded-full shadow-sm z-50 transition-transform hover:scale-125 ${pos.length === 1 ? "w-2.5 h-2.5" : "w-3 h-3"} ${posClass} ${cursor}`}
											onMouseDown={(e: React.MouseEvent) =>
												handleMouseDown(e, layer.id, pos)
											}
										/>
									))}
								<div
									className="absolute -top-6 left-1/2 -translate-x-1/2 h-6 w-px bg-blue-500"
									style={{ transform: `scaleX(${1 / zoom})` }}
								/>
								<div
									role="button"
									tabIndex={-1}
									className="absolute -top-8 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-blue-600 rounded-full shadow-sm cursor-grab active:cursor-grabbing hover:scale-110"
									onMouseDown={(e: React.MouseEvent) =>
										handleRotateStart(e, layer.id)
									}
								/>
							</>
						)}
					</button>
				))}
			</div>
		</div>
	);
};

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

const Toolbar: React.FC<{
	onClose: () => void;
	onSave: () => void;
	timeRef: React.RefObject<HTMLDivElement | null>;
}> = ({ onClose, onSave, timeRef }) => {
	const {
		zoom,
		zoomIn,
		zoomOut,
		zoomTo,
		fitView,
		isDirty,
		isPlaying,
		setIsPlaying,
		playerRef,
		currentFrame,
		fps,
		mode,
		setMode,
	} = useEditor();
	const [showCloseDialog, setShowCloseDialog] = useState(false);

	const handlePlayPause = () => {
		if (playerRef.current) {
			if (isPlaying) playerRef.current.pause();
			else playerRef.current.play();
			setIsPlaying(!isPlaying);
		}
	};

	const zoomMenuItems = [
		{ label: "Zoom In", shortcut: "+", action: zoomIn },
		{ label: "Zoom Out", shortcut: "-", action: zoomOut },
		{ label: "100%", shortcut: "1", action: () => zoomTo(1) },
		{ label: "Fit to Screen", shortcut: "0", action: fitView },
	];

	return (
		<>
			<TooltipProvider>
				<div className="flex items-center gap-1.5 p-1.5 rounded-full border border-border/50 bg-background/80 backdrop-blur-md shadow-2xl ring-1 ring-white/5 z-50">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className={`rounded-full w-9 h-9 transition-colors ${isPlaying ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "hover:bg-white/10 text-white"}`}
								onClick={handlePlayPause}
							>
								{isPlaying ? (
									<Pause className="w-4 h-4 fill-current" />
								) : (
									<Play className="w-4 h-4 fill-current ml-0.5" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>{isPlaying ? "Pause (Space)" : "Play (Space)"}</p>
						</TooltipContent>
					</Tooltip>

					<div className="w-px h-5 bg-white/10 mx-1" />

					<div
						ref={timeRef}
						className="text-[11px] font-mono tabular-nums text-neutral-300 min-w-17.5 text-center select-none cursor-default"
					>
						{Math.floor(currentFrame / fps)}s :{" "}
						{(currentFrame % fps).toString().padStart(2, "0")}f
					</div>

					<div className="w-px h-5 bg-white/10 mx-1" />

					<div className="flex rounded-full p-0.5">
						{(["select", "pan"] as const).map((m) => (
							<Tooltip key={m}>
								<TooltipTrigger asChild>
									<Button
										variant={mode === m ? "secondary" : "ghost"}
										size="icon"
										className="rounded-full w-8 h-8"
										onClick={() => setMode(m)}
									>
										{m === "select" ? (
											<MousePointer className="w-3.5 h-3.5" />
										) : (
											<Hand className="w-3.5 h-3.5" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{m === "select"
										? "Select Tool (V)"
										: "Pan Tool (H) or hold Space"}
								</TooltipContent>
							</Tooltip>
						))}
					</div>

					<div className="w-px h-5 bg-white/10 mx-1" />

					<Menubar className="border-none bg-transparent h-auto p-0">
						<MenubarMenu>
							<MenubarTrigger asChild>
								<Button
									variant="ghost"
									className="h-8 px-3 text-[11px] rounded-full text-gray-300 hover:text-white hover:bg-white/10 font-medium min-w-20 justify-between"
								>
									{Math.round(zoom * 100)}%
									<ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
								</Button>
							</MenubarTrigger>
							<MenubarContent
								align="center"
								className="min-w-40 bg-neutral-900/95 backdrop-blur-xl border-white/10 text-gray-200"
							>
								{zoomMenuItems.map(({ label, shortcut, action }) => (
									<MenubarItem key={label} onClick={action}>
										<span className="flex-1">{label}</span>
										<span className="text-xs text-gray-500 ml-4">
											{shortcut}
										</span>
									</MenubarItem>
								))}
							</MenubarContent>
						</MenubarMenu>
					</Menubar>

					<div className="w-px h-5 bg-white/10 mx-1" />

					<div className="flex items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									size="sm"
									variant="default"
									className="h-8 text-[11px] font-semibold rounded-full px-4"
									onClick={onSave}
									disabled={!isDirty}
								>
									<Save className="w-3.5 h-3.5 mr-1" /> Save
								</Button>
							</TooltipTrigger>
							<TooltipContent>Save (⌘S)</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									size="icon"
									variant="ghost"
									className="h-8 w-8 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
									onClick={() =>
										isDirty ? setShowCloseDialog(true) : onClose()
									}
								>
									<XIcon className="w-4 h-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Close (Esc)</TooltipContent>
						</Tooltip>
					</div>
				</div>
			</TooltipProvider>

			<AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
				<AlertDialogContent className="bg-neutral-900 border-white/10">
					<AlertDialogHeader>
						<AlertDialogTitle className="text-white">
							Unsaved Changes
						</AlertDialogTitle>
						<AlertDialogDescription className="text-gray-400">
							You have unsaved changes in this composition. Would you like to
							save before closing?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={() => setShowCloseDialog(false)}
							className="bg-transparent border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
						>
							Cancel
						</AlertDialogCancel>
						<Button
							variant="destructive"
							onClick={() => {
								setShowCloseDialog(false);
								onClose();
							}}
							className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0"
						>
							Discard
						</Button>
						<AlertDialogAction
							onClick={() => {
								onSave();
								setShowCloseDialog(false);
								onClose();
							}}
							className="bg-primary text-primary-foreground hover:bg-primary/90"
						>
							Save & Close
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};

// ---------------------------------------------------------------------------
// SortableTrackHeader
// ---------------------------------------------------------------------------

const SortableTrackHeader: React.FC<{
	layer: EditorLayer;
	isSelected: boolean;
	onSelect: () => void;
	index: number;
}> = ({ layer, isSelected, onSelect, index }) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: layer.id });
	const handles = useAppSelector(handleSelectors.selectEntities);
	const handleId = layer.inputHandleId ?? "";
	const handle = handleId ? handles[handleId] : undefined;
	const name = resolveLayerLabel(handle, layer);
	const colorConfig = resolveColorConfig(layer);

	return (
		<button
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
				height: TRACK_HEIGHT,
				minHeight: `${TRACK_HEIGHT}px`,
				zIndex: isDragging ? 999 : "auto",
			}}
			type="button"
			className={cn(
				"w-full text-left p-0 m-0 bg-transparent border-0 border-b border-white/[0.04] flex items-center pl-2 pr-2 text-xs gap-2 group outline-none transition-all select-none",
				isSelected
					? "bg-white/[0.06] text-blue-100"
					: "hover:bg-white/[0.04] text-gray-400",
				isDragging ? "opacity-50 bg-neutral-900" : "",
				index % 2 === 0 ? "" : "bg-white/[0.015]",
			)}
			onClick={onSelect}
		>
			<div
				{...attributes}
				{...listeners}
				className="cursor-grab active:cursor-grabbing p-1 text-gray-700 hover:text-gray-400 transition-colors rounded hover:bg-white/5 shrink-0"
			>
				<GripVertical className="h-3 w-3" />
			</div>
			<div
				className={cn(
					"w-5 h-5 rounded-[4px] flex items-center justify-center shrink-0",
					colorConfig ? `${colorConfig.bg}/30` : "bg-white/10",
				)}
			>
				<LayerIcon
					type={layer.type}
					className={cn("w-3 h-3", colorConfig?.text ?? "text-gray-300")}
				/>
			</div>
			<span className="truncate font-medium text-[11px] leading-tight flex-1 min-w-0 opacity-75 group-hover:opacity-100 transition-opacity">
				{name}
			</span>
			<div className="flex items-center gap-1 shrink-0">
				{layer.animations && layer.animations.length > 0 && (
					<WithTooltip tip="Animations">
						<div className="w-4 h-4 flex items-center justify-center rounded bg-amber-500/10">
							<Zap className="w-2.5 h-2.5 text-amber-400" />
						</div>
					</WithTooltip>
				)}
				{layer.useRoundedTextBox && (
					<WithTooltip tip="Text box">
						<div className="w-4 h-4 flex items-center justify-center rounded bg-blue-500/10">
							<Box className="w-2.5 h-2.5 text-blue-400" />
						</div>
					</WithTooltip>
				)}
			</div>
		</button>
	);
};

// ---------------------------------------------------------------------------
// Timecode formatter
// ---------------------------------------------------------------------------

const formatTimecode = (
	totalSeconds: number,
	showSubSecond = false,
): string => {
	if (totalSeconds < 0) totalSeconds = 0;
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = Math.floor(totalSeconds % 60);
	const ms = Math.round((totalSeconds % 1) * 1000);
	const pad = (n: number) => n.toString().padStart(2, "0");

	if (showSubSecond && totalSeconds < 10) {
		return `${s}.${ms.toString().padStart(3, "0")}`;
	}
	if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
	if (m > 0) return `${pad(m)}:${pad(s)}`;
	return `${s}s`;
};

// ---------------------------------------------------------------------------
// TimelinePanel — completely redesigned
// ---------------------------------------------------------------------------

const TimelinePanel: React.FC = () => {
	const {
		layers,
		updateLayers,
		durationInMS,
		currentFrame,
		setCurrentFrame,
		playerRef,
		selectedId,
		setSelectedId,
		isPlaying,
		fps,
		timelineScrollRef: scrollContainerRef,
		timelineHeight,
		setTimelineHeight,
		initialLayersData,
		markLayerTrimmed,
	} = useEditor();

	const playheadRef = useRef<HTMLDivElement>(null);
	const rulerRef = useRef<HTMLDivElement>(null);
	const overviewRef = useRef<HTMLDivElement>(null);
	const trackAreaRef = useRef<HTMLDivElement>(null);

	// --- Core zoom state (normalized 0-1, maps log to pixelsPerSecond) ---
	const [zoomNorm, setZoomNorm] = useState(0.38);
	const pixelsPerSecond = useMemo(() => ppsFromNorm(zoomNorm), [zoomNorm]);
	const pixelsPerFrame = pixelsPerSecond / fps;

	// --- UI state ---
	const [isResizingTimeline, setIsResizingTimeline] = useState(false);
	const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
	const [cursorTimeSec, setCursorTimeSec] = useState<number | null>(null);
	const [isHoveringRuler, setIsHoveringRuler] = useState(false);

	// Track area width for overview calculations
	const [trackAreaWidth, setTrackAreaWidth] = useState(0);

	const sortedLayers = [...layers].sort(
		(a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
	);

	const totalSeconds = durationInMS / 1000;
	const totalTimelineWidth = Math.max(
		trackAreaWidth,
		totalSeconds * pixelsPerSecond + 400,
	);

	// Observe track area width
	useEffect(() => {
		const el = trackAreaRef.current;
		if (!el) return;
		const obs = new ResizeObserver((entries) =>
			setTrackAreaWidth(entries[0].contentRect.width),
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, []);

	// --- Zoom helpers ---
	const zoomInTimeline = useCallback(
		() => setZoomNorm((z) => Math.min(1, z + 0.07)),
		[],
	);
	const zoomOutTimeline = useCallback(
		() => setZoomNorm((z) => Math.max(0, z - 0.07)),
		[],
	);

	const fitToContent = useCallback(() => {
		if (!scrollContainerRef.current) return;
		const avail = scrollContainerRef.current.clientWidth - HEADER_WIDTH - 32;
		if (avail <= 0 || totalSeconds <= 0) return;
		const targetPps = avail / totalSeconds;
		const clampedPps = Math.min(
			TIMELINE_MAX_PPS,
			Math.max(TIMELINE_MIN_PPS, targetPps),
		);
		setZoomNorm(normFromPps(clampedPps));
	}, [totalSeconds, scrollContainerRef]);

	// Fit on first mount
	useEffect(() => {
		fitToContent();
	}, []);

	// Scroll-wheel zoom on the timeline canvas (alt/ctrl held)
	useEffect(() => {
		const el = scrollContainerRef.current;
		if (!el) return;
		const handleWheel = (e: WheelEvent) => {
			if (e.altKey || e.ctrlKey || e.metaKey) {
				e.preventDefault();
				e.stopPropagation();
				const delta = -e.deltaY * 0.0015;
				// Zoom centered on mouse position
				const mouseX =
					e.clientX - el.getBoundingClientRect().left - HEADER_WIDTH;
				const timePosAtMouse = (el.scrollLeft + mouseX) / pixelsPerSecond;
				setZoomNorm((z) => {
					const newZ = Math.min(1, Math.max(0, z + delta));
					const newPps = ppsFromNorm(newZ);
					// Adjust scroll to keep the time position under the cursor
					requestAnimationFrame(() => {
						if (el) el.scrollLeft = timePosAtMouse * newPps - mouseX;
					});
					return newZ;
				});
			}
		};
		el.addEventListener("wheel", handleWheel, { passive: false });
		return () => el.removeEventListener("wheel", handleWheel);
	}, [pixelsPerSecond, scrollContainerRef]);

	// --- DnD sensors ---
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIndex = sortedLayers.findIndex((l) => l.id === active.id);
		const newIndex = sortedLayers.findIndex((l) => l.id === over.id);
		const newSorted = arrayMove(sortedLayers, oldIndex, newIndex).map(
			(l, idx, arr) => ({ ...l, zIndex: arr.length - idx }),
		);
		updateLayers((prev) => {
			const updateMap = new Map(newSorted.map((l) => [l.id, l]));
			return prev.map((l) => updateMap.get(l.id) || l);
		});
	};

	// --- Playhead RAF sync ---
	useEffect(() => {
		let rafId: number | null = null;
		const loop = () => {
			if (playerRef.current) {
				const frame = playerRef.current.getCurrentFrame();
				if (playheadRef.current) {
					playheadRef.current.style.transform = `translateX(${frame * pixelsPerFrame}px)`;
				}
				if (isPlaying && scrollContainerRef.current) {
					const x = frame * pixelsPerFrame;
					const width = scrollContainerRef.current.clientWidth - HEADER_WIDTH;
					const scroll = scrollContainerRef.current.scrollLeft;
					if (x > scroll + width - 100)
						scrollContainerRef.current.scrollLeft = x - 100;
				}
			}
			rafId = requestAnimationFrame(loop);
		};
		if (isPlaying) loop();
		else if (playheadRef.current) {
			playheadRef.current.style.transform = `translateX(${currentFrame * pixelsPerFrame}px)`;
		}
		return () => {
			if (rafId) cancelAnimationFrame(rafId);
		};
	}, [isPlaying, currentFrame, pixelsPerFrame, playerRef]);

	// --- Ruler interaction ---
	const seekToX = useCallback(
		(clientX: number) => {
			if (!rulerRef.current || !scrollContainerRef.current) return;
			const rulerLeft = rulerRef.current.getBoundingClientRect().left;
			const scrollLeft = scrollContainerRef.current.scrollLeft;
			const x = clientX - rulerLeft + scrollLeft;
			const frame = Math.max(0, Math.floor(x / pixelsPerFrame));
			playerRef.current?.seekTo(frame);
			setCurrentFrame(frame);
		},
		[pixelsPerFrame, playerRef, setCurrentFrame, scrollContainerRef],
	);

	const handleRulerMouseDown = (e: React.MouseEvent) => {
		if (e.button !== 0) return;
		e.preventDefault();
		setIsDraggingPlayhead(true);
		seekToX(e.clientX);
	};

	const handleRulerMouseMove = (e: React.MouseEvent) => {
		if (!rulerRef.current || !scrollContainerRef.current) return;
		const rulerLeft = rulerRef.current.getBoundingClientRect().left;
		const scrollLeft = scrollContainerRef.current.scrollLeft;
		const x = Math.max(0, e.clientX - rulerLeft + scrollLeft);
		setCursorTimeSec(x / pixelsPerSecond);
		if (isDraggingPlayhead) seekToX(e.clientX);
	};

	useEffect(() => {
		if (!isDraggingPlayhead) return;
		const onUp = () => setIsDraggingPlayhead(false);
		const onMove = (e: MouseEvent) => {
			if (isDraggingPlayhead) seekToX(e.clientX);
		};
		window.addEventListener("mouseup", onUp);
		window.addEventListener("mousemove", onMove);
		return () => {
			window.removeEventListener("mouseup", onUp);
			window.removeEventListener("mousemove", onMove);
		};
	}, [isDraggingPlayhead, seekToX]);

	// --- Clip manipulation ---
	const handleClipManipulation = (
		e: React.MouseEvent,
		layerId: string,
		type: "move" | "trim",
	) => {
		e.stopPropagation();
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;
		const startX = e.clientX;
		const initialStart = layer.startFrame ?? 0;
		const initialDuration = layer.durationInMS ?? DEFAULT_DURATION_MS;

		const onMove = (ev: MouseEvent) => {
			const diffFrames = Math.round((ev.clientX - startX) / pixelsPerFrame);
			if (type === "move") {
				updateLayers((prev) =>
					prev.map((l) =>
						l.id === layerId
							? { ...l, startFrame: Math.max(0, initialStart + diffFrames) }
							: l,
					),
				);
			} else {
				const diffMS = (diffFrames / fps) * 1000;
				let newDuration = Math.max(1, initialDuration + diffMS);
				const initialItem = initialLayersData.get(layerId);
				if (
					initialItem &&
					(initialItem.type === "Video" || initialItem.type === "Audio")
				) {
					const virtualMedia = initialItem.data as VirtualMediaData;
					const metadata = getActiveMediaMetadata(virtualMedia);
					const cutDurationMs = getEffectiveDurationMs(virtualMedia);
					const maxDuration = cutDurationMs ?? metadata?.durationMs;
					if (maxDuration) newDuration = Math.min(newDuration, maxDuration);
				}
				markLayerTrimmed(layerId);
				updateLayers((prev) =>
					prev.map((l) =>
						l.id === layerId ? { ...l, durationInMS: newDuration } : l,
					),
				);
			}
		};
		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	// --- Timeline height resize ---
	const handleTimelineResize = (e: React.MouseEvent) => {
		e.preventDefault();
		const startY = e.clientY;
		const startHeight = timelineHeight;
		setIsResizingTimeline(true);
		const onMove = (ev: MouseEvent) => {
			setTimelineHeight(
				Math.min(
					MAX_TIMELINE_HEIGHT,
					Math.max(MIN_TIMELINE_HEIGHT, startHeight + (startY - ev.clientY)),
				),
			);
		};
		const onUp = () => {
			setIsResizingTimeline(false);
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	// --- Dynamic ruler tick calculation ---
	const { majorTickSeconds, minorTickSeconds, showFrameTicks } = useMemo(() => {
		const minMajorSpacingPx = 80;
		const targetSeconds = minMajorSpacingPx / pixelsPerSecond;

		const steps = [
			1 / fps, // 1 frame
			2 / fps,
			5 / fps,
			10 / fps,
			0.5,
			1,
			2,
			5,
			10,
			15,
			30,
			60,
			120,
			300,
			600,
			900,
			1800,
			3600,
			7200,
		];

		const major =
			steps.find((step) => step >= targetSeconds) || steps[steps.length - 1];

		let minor = major / 5;
		if (major === 1 / fps) minor = major;
		else if (major === 0.5) minor = 0.1;
		else if (major === 1) minor = 0.25;
		else if (major === 2) minor = 0.5;
		else if (major === 15) minor = 5;
		else if (major === 30) minor = 10;
		else if (major >= 60) minor = major / 4;

		// Show frame ticks only when zoomed in enough (>4px per frame)
		const showFrameTicks = pixelsPerFrame >= 4;

		return { majorTickSeconds: major, minorTickSeconds: minor, showFrameTicks };
	}, [pixelsPerSecond, fps, pixelsPerFrame]);

	const ticksCount = Math.ceil(totalSeconds / majorTickSeconds) + 2;
	const patternWidth = majorTickSeconds * pixelsPerSecond;
	const subTicksCount = Math.max(
		2,
		Math.round(majorTickSeconds / minorTickSeconds),
	);

	// Scale label (for the zoom control)
	const scaleLabel = useMemo(() => {
		if (pixelsPerFrame >= 8) return `${Math.round(pixelsPerFrame)}px/f`;
		if (pixelsPerSecond >= 100)
			return `${(1000 / pixelsPerSecond).toFixed(0)}ms`;
		if (pixelsPerSecond >= 1) return `${(1 / pixelsPerSecond).toFixed(1)}s/px`;
		return `${(60 / pixelsPerSecond).toFixed(1)}m/px`;
	}, [pixelsPerSecond, pixelsPerFrame]);

	// Overview viewport indicator
	const overviewViewport = useMemo(() => {
		if (!scrollContainerRef.current || totalSeconds <= 0 || trackAreaWidth <= 0)
			return null;
		const scrollLeft = scrollContainerRef.current.scrollLeft;
		const visibleWidth = scrollContainerRef.current.clientWidth - HEADER_WIDTH;
		const timelineTotal = totalSeconds * pixelsPerSecond;
		if (timelineTotal <= 0) return null;
		const left = (scrollLeft / timelineTotal) * 100;
		const width = (visibleWidth / timelineTotal) * 100;
		return {
			left: Math.max(0, Math.min(100, left)),
			width: Math.max(1, Math.min(100, width)),
		};
	}, [
		scrollContainerRef,
		totalSeconds,
		pixelsPerSecond,
		trackAreaWidth,
		currentFrame,
	]);

	// Current playhead position as % of total for overview
	const playheadOverviewPct = useMemo(() => {
		const totalFrames = (durationInMS / 1000) * fps;
		if (totalFrames <= 0) return 0;
		return (currentFrame / totalFrames) * 100;
	}, [currentFrame, durationInMS, fps]);

	return (
		<div
			className="flex flex-col border-t border-white/[0.07] bg-[#0c0c0c] shrink-0 select-none z-30"
			style={{
				height: timelineHeight,
				boxShadow:
					"0 -1px 0 rgba(255,255,255,0.04), 0 -8px 32px rgba(0,0,0,0.6)",
			}}
		>
			{/* Resize handle */}
			<div
				className={cn(
					"h-1 flex items-center justify-center cursor-ns-resize group transition-colors shrink-0",
					isResizingTimeline ? "bg-blue-500/30" : "hover:bg-white/[0.06]",
				)}
				onMouseDown={handleTimelineResize}
			>
				<div
					className={cn(
						"w-8 h-0.5 rounded-full transition-colors",
						isResizingTimeline
							? "bg-blue-400"
							: "bg-white/10 group-hover:bg-white/25",
					)}
				/>
			</div>

			{/* Header bar */}
			<div className="h-9 border-b border-white/[0.05] flex items-center justify-between px-3 bg-[#0f0f0f] shrink-0">
				{/* Left: label */}
				<div className="flex items-center gap-2">
					<Layers className="w-3 h-3 text-neutral-600" />
					<span className="text-[10px] font-semibold text-neutral-500 tracking-widest uppercase">
						Timeline
					</span>
				</div>

				{/* Center: zoom controls */}
				<div className="flex items-center gap-1.5">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={fitToContent}
									className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-200 hover:bg-white/8 transition-all"
								>
									<Maximize2 className="w-3 h-3" />
								</button>
							</TooltipTrigger>
							<TooltipContent>Fit to content</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<button
						type="button"
						onClick={zoomOutTimeline}
						className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-200 hover:bg-white/8 transition-all"
					>
						<ZoomOut className="w-3 h-3" />
					</button>

					{/* Log-scale zoom slider */}
					<div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-1">
						<input
							type="range"
							min={0}
							max={1}
							step={0.001}
							value={zoomNorm}
							onChange={(e) => setZoomNorm(Number(e.target.value))}
							className="w-20 h-1 accent-blue-500 cursor-pointer"
							style={{ accentColor: "#3b82f6" }}
						/>
						<span className="text-[9px] font-mono text-gray-500 w-12 text-right tabular-nums shrink-0">
							{scaleLabel}
						</span>
					</div>

					<button
						type="button"
						onClick={zoomInTimeline}
						className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:text-gray-200 hover:bg-white/8 transition-all"
					>
						<ZoomIn className="w-3 h-3" />
					</button>

					<span className="text-[9px] text-gray-700 ml-1">
						Alt+scroll to zoom
					</span>
				</div>

				{/* Right: total duration */}
				<div className="text-[10px] font-mono text-gray-600 tabular-nums">
					{formatTimecode(totalSeconds)}
				</div>
			</div>

			{/* Scrollable area */}
			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-auto min-h-0"
				style={{
					scrollbarWidth: "thin",
					scrollbarColor: "#2a2a2a #0c0c0c",
				}}
			>
				<div
					className="relative flex flex-col min-h-full"
					style={{
						width: Math.max(
							scrollContainerRef.current?.clientWidth || 0,
							HEADER_WIDTH + totalTimelineWidth,
						),
					}}
				>
					{/* ── Ruler ── */}
					<div
						className="sticky top-0 z-50 flex shrink-0"
						style={{ height: RULER_HEIGHT }}
					>
						{/* Corner cell */}
						<div
							className="sticky left-0 z-50 border-r border-b bg-[#0f0f0f] shrink-0"
							style={{
								width: HEADER_WIDTH,
								borderColor: "rgba(255,255,255,0.05)",
							}}
						>
							<div className="h-full flex items-center justify-center">
								<span className="text-[9px] font-bold uppercase tracking-widest text-neutral-700">
									Tracks
								</span>
							</div>
						</div>

						{/* Ruler track */}
						<div
							ref={rulerRef}
							className="flex-1 relative select-none bg-[#0f0f0f] border-b"
							style={{
								borderColor: "rgba(255,255,255,0.05)",
								cursor: isDraggingPlayhead ? "grabbing" : "crosshair",
							}}
							onMouseDown={handleRulerMouseDown}
							onMouseMove={handleRulerMouseMove}
							onMouseEnter={() => setIsHoveringRuler(true)}
							onMouseLeave={() => {
								setIsHoveringRuler(false);
								setCursorTimeSec(null);
							}}
						>
							{/* Tick marks via SVG pattern */}
							<svg
								className="absolute inset-0 pointer-events-none"
								width="100%"
								height="100%"
							>
								<defs>
									<pattern
										id="ruler-major"
										x="0"
										y="0"
										width={patternWidth}
										height={RULER_HEIGHT}
										patternUnits="userSpaceOnUse"
									>
										{/* Major tick */}
										<line
											x1="0.5"
											y1={RULER_HEIGHT}
											x2="0.5"
											y2={RULER_HEIGHT - 16}
											stroke="rgba(255,255,255,0.2)"
											strokeWidth="1"
										/>
										{/* Minor ticks */}
										{Array.from({ length: Math.max(0, subTicksCount - 1) }).map(
											(_, i) => {
												const x = ((i + 1) / subTicksCount) * patternWidth;
												const isHalf = i + 1 === Math.floor(subTicksCount / 2);
												return (
													<line
														key={i}
														x1={x + 0.5}
														y1={RULER_HEIGHT}
														x2={x + 0.5}
														y2={RULER_HEIGHT - (isHalf ? 8 : 5)}
														stroke={
															isHalf
																? "rgba(255,255,255,0.12)"
																: "rgba(255,255,255,0.07)"
														}
													/>
												);
											},
										)}
									</pattern>
								</defs>
								<rect width="100%" height="100%" fill="url(#ruler-major)" />
							</svg>

							{/* Major tick labels */}
							{Array.from({ length: ticksCount }).map((_, i) => {
								const sec = i * majorTickSeconds;
								const x = sec * pixelsPerSecond;
								// Skip if too close to left edge
								if (x < 4) return null;
								return (
									<span
										key={`label_${sec}`}
										className="absolute pointer-events-none select-none"
										style={{
											left: x + 4,
											top: 6,
											fontSize: "9px",
											fontFamily: "ui-monospace, monospace",
											color: "rgba(255,255,255,0.35)",
											fontWeight: 500,
											letterSpacing: "0.02em",
											lineHeight: 1,
											whiteSpace: "nowrap",
										}}
									>
										{formatTimecode(sec)}
									</span>
								);
							})}

							{/* Frame tick labels when very zoomed in */}
							{showFrameTicks &&
								pixelsPerFrame >= 20 &&
								Array.from({
									length: Math.min(500, Math.ceil(totalSeconds * fps)),
								}).map((_, i) => {
									if (i % fps === 0) return null; // skip second marks (already shown)
									const x = i * pixelsPerFrame;
									return (
										<span
											key={`f_${i}`}
											className="absolute pointer-events-none select-none"
											style={{
												left: x + 2,
												bottom: 3,
												fontSize: "7px",
												fontFamily: "ui-monospace, monospace",
												color: "rgba(255,255,255,0.2)",
												lineHeight: 1,
											}}
										>
											{i % fps}
										</span>
									);
								})}

							{/* Cursor time indicator */}
							{isHoveringRuler &&
								cursorTimeSec !== null &&
								!isDraggingPlayhead && (
									<div
										className="absolute top-0 bottom-0 pointer-events-none z-10"
										style={{ left: cursorTimeSec * pixelsPerSecond }}
									>
										<div className="absolute w-px h-full bg-white/20" />
										<div
											className="absolute -top-0 text-[8px] font-mono text-white/70 bg-neutral-900/90 border border-white/10 rounded px-1 py-0.5 whitespace-nowrap"
											style={{ left: 4, top: 4 }}
										>
											{formatTimecode(cursorTimeSec, true)}
										</div>
									</div>
								)}

							{/* Playhead marker on ruler */}
							<div
								ref={playheadRef}
								className="absolute top-0 bottom-0 z-20 pointer-events-none will-change-transform"
								style={{ height: "100vh" }}
							>
								{/* Triangle head */}
								<div className="absolute -translate-x-1/2 top-0 pointer-events-none">
									<svg
										width="11"
										height="12"
										viewBox="0 0 11 12"
										className="overflow-visible"
									>
										<polygon points="0,0 11,0 11,8 5.5,12 0,8" fill="#3b82f6" />
									</svg>
								</div>
								{/* Stem */}
								<div
									className="absolute top-0 h-full"
									style={{
										left: "0.5px",
										width: "1px",
										background: "rgba(59,130,246,0.7)",
										boxShadow: "0 0 4px rgba(59,130,246,0.4)",
									}}
								/>
								{/* Time label on playhead */}
								<div
									className="absolute top-3 left-2 text-[8px] font-mono text-blue-300/80 whitespace-nowrap pointer-events-none"
									style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
								>
									{formatTimecode(currentFrame / fps, true)}
								</div>
							</div>
						</div>
					</div>

					{/* ── Track rows ── */}
					<div className="flex relative flex-1">
						{/* Sticky track headers */}
						<div
							className="sticky left-0 z-30 shrink-0 border-r"
							style={{
								width: HEADER_WIDTH,
								borderColor: "rgba(255,255,255,0.05)",
								background: "#0e0e0e",
							}}
						>
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={handleDragEnd}
							>
								<SortableContext
									items={sortedLayers.map((l) => l.id)}
									strategy={verticalListSortingStrategy}
								>
									{sortedLayers.map((layer, idx) => (
										<SortableTrackHeader
											key={layer.id}
											layer={layer}
											isSelected={layer.id === selectedId}
											onSelect={() => setSelectedId(layer.id)}
											index={idx}
										/>
									))}
								</SortableContext>
							</DndContext>
						</div>

						{/* Track canvas */}
						<div
							ref={trackAreaRef}
							className="flex-1 relative min-h-full"
							style={{ background: "#0a0a0a" }}
						>
							{/* Vertical grid lines (major ticks) */}
							<div
								className="absolute inset-0 pointer-events-none"
								style={{
									backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent ${patternWidth}px)`,
									backgroundSize: `${patternWidth}px 100%`,
								}}
							/>

							{sortedLayers.map((layer, idx) => {
								const durationMS = layer.durationInMS ?? DEFAULT_DURATION_MS;
								const isSelected = layer.id === selectedId;
								const clipLeft = (layer.startFrame ?? 0) * pixelsPerFrame;
								const clipWidth = Math.max(
									6,
									(durationMS / 1000) * fps * pixelsPerFrame,
								);

								return (
									<div
										key={layer.id}
										className={cn(
											"border-b relative",
											idx % 2 === 1 ? "bg-white/[0.008]" : "",
											isSelected ? "bg-blue-500/[0.04]" : "",
										)}
										style={{
											height: TRACK_HEIGHT,
											borderColor: "rgba(255,255,255,0.03)",
										}}
									>
										{/* Clip button */}
										<button
											type="button"
											className={cn(
												"absolute top-1.5 bottom-1.5 rounded-[5px] cursor-move outline-none p-0 m-0 border-0 bg-transparent overflow-visible",
												isSelected ? "z-20" : "z-10",
											)}
											style={{
												left: clipLeft,
												width: clipWidth,
												minWidth: "6px",
											}}
											onMouseDown={(e: React.MouseEvent) =>
												handleClipManipulation(e, layer.id, "move")
											}
											onClick={(e: React.MouseEvent) => {
												e.stopPropagation();
												setSelectedId(layer.id);
											}}
											onKeyDown={(e: React.KeyboardEvent) => {
												if (e.key === "Enter") setSelectedId(layer.id);
											}}
										>
											<UnifiedClip
												layer={layer}
												isSelected={isSelected}
												pixelsPerSecond={pixelsPerSecond}
												fps={fps}
											/>

											{/* Trim handle — right edge */}
											<div
												className="absolute -right-1 top-0 bottom-0 w-4 cursor-e-resize z-30 flex items-center justify-end pr-0.5 group/trim"
												onMouseDown={(e: React.MouseEvent) => {
													e.stopPropagation();
													handleClipManipulation(e, layer.id, "trim");
												}}
											>
												<div className="w-1 h-5 rounded-full bg-white/10 group-hover/trim:bg-white/40 transition-colors" />
											</div>
										</button>
									</div>
								);
							})}

							{/* Empty state */}
							{sortedLayers.length === 0 && (
								<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
									<span className="text-[11px] text-gray-700">
										No layers — add media to get started
									</span>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* ── Overview / Minimap bar ── */}
			<div
				ref={overviewRef}
				className="shrink-0 border-t relative overflow-hidden"
				style={{
					height: OVERVIEW_HEIGHT,
					borderColor: "rgba(255,255,255,0.04)",
					background: "#080808",
				}}
			>
				<div
					className="absolute left-0 top-0 bottom-0"
					style={{
						width: HEADER_WIDTH,
						borderRight: "1px solid rgba(255,255,255,0.04)",
						background: "#090909",
					}}
				>
					<div className="h-full flex items-center px-3">
						<span className="text-[8px] uppercase tracking-widest font-bold text-neutral-700">
							Overview
						</span>
					</div>
				</div>

				<div
					className="absolute top-0 bottom-0 right-0"
					style={{ left: HEADER_WIDTH }}
				>
					{/* Layer bars in overview */}
					{sortedLayers.map((layer, idx) => {
						const colorConfig = resolveColorConfig(layer);
						const startFrac =
							((layer.startFrame ?? 0) * pixelsPerFrame) /
							Math.max(1, totalSeconds * pixelsPerSecond);
						const widthFrac =
							(((layer.durationInMS ?? DEFAULT_DURATION_MS) / 1000) *
								fps *
								pixelsPerFrame) /
							Math.max(1, totalSeconds * pixelsPerSecond);
						return (
							<div
								key={layer.id}
								className={cn("absolute rounded-sm opacity-60", colorConfig.bg)}
								style={{
									left: `${Math.max(0, startFrac * 100)}%`,
									width: `${Math.max(0.2, widthFrac * 100)}%`,
									top: 3 + (idx % 3) * 4,
									height: 3,
								}}
							/>
						);
					})}

					{/* Viewport window indicator */}
					{overviewViewport && (
						<div
							className="absolute top-0 bottom-0 border border-blue-500/40 bg-blue-500/10 rounded-sm pointer-events-none"
							style={{
								left: `${overviewViewport.left}%`,
								width: `${overviewViewport.width}%`,
							}}
						/>
					)}

					{/* Playhead position on overview */}
					<div
						className="absolute top-0 bottom-0 w-px bg-blue-500/60 pointer-events-none"
						style={{ left: `${playheadOverviewPct}%` }}
					/>

					{/* Clickable overview */}
					<div
						className="absolute inset-0 cursor-pointer"
						role="button"
						tabIndex={-1}
						onClick={(e) => {
							const rect = e.currentTarget.getBoundingClientRect();
							const frac = (e.clientX - rect.left) / rect.width;
							const frame = Math.round(frac * (durationInMS / 1000) * fps);
							playerRef.current?.seekTo(frame);
							setCurrentFrame(frame);
							// Also scroll the timeline to show this position
							if (scrollContainerRef.current) {
								const targetScrollLeft =
									frac * totalSeconds * pixelsPerSecond -
									(scrollContainerRef.current.clientWidth - HEADER_WIDTH) / 2;
								scrollContainerRef.current.scrollLeft = Math.max(
									0,
									targetScrollLeft,
								);
							}
						}}
					/>
				</div>
			</div>
		</div>
	);
};

// ---------------------------------------------------------------------------
// InspectorPanel
// ---------------------------------------------------------------------------

const InspectorPanel: React.FC = () => {
	const {
		selectedId,
		layers,
		updateLayers,
		viewportWidth,
		viewportHeight,
		updateViewportWidth,
		updateViewportHeight,
		fps,
		setFps,
		backgroundColor,
		setBackgroundColor,
	} = useEditor();

	const selectedLayer = layers.find((f) => f.id === selectedId);
	const { data: fontList } = useGetFontListQuery({});
	const handles = useAppSelector(handleSelectors.selectEntities);

	const update = (patch: Partial<EditorLayer>) => {
		updateLayers((prev) =>
			prev.map((l) => {
				if (l.id !== selectedId) return l;
				const nextLayer = { ...l, ...patch };
				if (nextLayer.type === "Text") {
					const textProps = [
						"text",
						"fontSize",
						"fontFamily",
						"fontWeight",
						"fontStyle",
						"letterSpacing",
						"lineHeight",
						"padding",
					];
					if (textProps.some((prop) => prop in patch)) {
						const dims = measureText(nextLayer.text || "", nextLayer);
						nextLayer.width = dims.width;
						nextLayer.height = dims.height;
					}
				} else if (nextLayer.type === "Caption") {
					const captionProps = ["fontSize", "lineHeight", "padding"];
					if (captionProps.some((prop) => prop in patch)) {
						const fSize = nextLayer.fontSize ?? 48;
						const lHeight = nextLayer.lineHeight ?? 1.2;
						const pad = nextLayer.padding ?? 0;
						nextLayer.height = Math.round(fSize * lHeight * 3 + pad * 2);
					}
				}
				return nextLayer;
			}),
		);
	};

	if (!selectedLayer) {
		return (
			<div className="w-80 h-full border-l border-white/5 bg-[#0f0f0f] flex flex-col z-20 shadow-xl shrink-0 overflow-hidden">
				<div className="p-4 bg-neutral-900 border-b border-white/5">
					<div className="flex items-center gap-2 text-xs font-bold text-gray-200 uppercase tracking-wide">
						<Settings2 className="w-3.5 h-3.5 text-blue-400" /> Canvas Settings
					</div>
				</div>
				<ScrollArea className="flex-1 min-h-0">
					<div className="p-4 pb-6 space-y-6">
						<div className="space-y-4">
							<div className="space-y-1.5">
								<Label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
									Preset
								</Label>
								<Select
									onValueChange={(val) => {
										const preset = ASPECT_RATIOS.find((r) => r.label === val);
										if (preset) {
											updateViewportWidth(preset.width);
											updateViewportHeight(preset.height);
										}
									}}
								>
									<SelectTrigger className="h-8 text-[11px] bg-white/5 border-white/10 text-gray-300 focus:ring-blue-500/20">
										<SelectValue placeholder="Select Aspect Ratio" />
									</SelectTrigger>
									<SelectContent className="bg-neutral-800 border-white/10 text-gray-300">
										{ASPECT_RATIOS.map((r) => (
											<SelectItem key={r.label} value={r.label}>
												<span className="flex items-center justify-between w-full gap-6">
													<span>{r.label}</span>
													<span className="text-[10px] text-gray-500 font-mono">
														{r.width}x{r.height}
													</span>
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
									Resolution
								</Label>
								<div className="grid grid-cols-2 gap-2">
									<DraggableNumberInput
										label="W"
										icon={MoveHorizontal}
										value={Math.round(viewportWidth)}
										onChange={(v) => updateViewportWidth(Math.max(2, v))}
									/>
									<DraggableNumberInput
										label="H"
										icon={MoveVertical}
										value={Math.round(viewportHeight)}
										onChange={(v) => updateViewportHeight(Math.max(2, v))}
									/>
								</div>
							</div>
							<div className="space-y-1.5">
								<Label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
									Background Colour
								</Label>
								<ColorPicker
									showAlpha={false}
									value={backgroundColor}
									onChange={setBackgroundColor}
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
									Frame Rate
								</Label>
								<Select
									value={fps.toString()}
									onValueChange={(val) => setFps(Number(val))}
								>
									<SelectTrigger className="h-8 text-[11px] bg-white/5 border-white/10 text-gray-300 focus:ring-blue-500/20">
										<SelectValue placeholder="Select FPS" />
									</SelectTrigger>
									<SelectContent className="bg-neutral-800 border-white/10 text-gray-300">
										{[24, 25, 30, 50, 60].map((rate) => (
											<SelectItem key={rate} value={rate.toString()}>
												{rate} FPS
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="w-full h-px bg-white/5" />
						<div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-white/10 rounded-lg bg-white/2">
							<MousePointer className="w-8 h-8 text-gray-700 mb-3" />
							<p className="text-sm font-medium text-gray-400">
								No Layer Selected
							</p>
							<p className="text-xs text-gray-600 mt-1">
								Click on a clip in the timeline or canvas to edit properties.
							</p>
						</div>
					</div>
				</ScrollArea>
			</div>
		);
	}

	const targetHandleId = selectedLayer.inputHandleId ?? "";
	const handle = targetHandleId ? handles[targetHandleId] : null;
	const displayName = resolveLayerLabel(handle, selectedLayer);
	const hasCropDimensions =
		selectedLayer.type === "Video" &&
		selectedLayer.videoNaturalWidth != null &&
		selectedLayer.videoNaturalHeight != null;
	const showAutoDimensions =
		(selectedLayer.type === "Image" ||
			selectedLayer.type === "SVG" ||
			selectedLayer.type === "Video") &&
		!isCaptionLayer(selectedLayer.type);

	const handleAutoDimensions = () => {
		if (selectedLayer.autoDimensions) {
			update({ autoDimensions: false });
			return;
		}
		update({
			autoDimensions: true,
			width: selectedLayer.width,
			height: selectedLayer.height,
		});
	};

	const autoDimensionsTooltip = hasCropDimensions
		? "Sync dimensions with cropped source media"
		: "Sync dimensions with source media";
	const suppressSizeInputs =
		selectedLayer.type === "Text" || isCaptionLayer(selectedLayer.type);
	const isTextOrCaption =
		selectedLayer.type === "Text" || selectedLayer.type === "Caption";
	const roundedBoxActive = isTextOrCaption && selectedLayer.useRoundedTextBox;

	return (
		<div className="w-80 h-full border-l border-white/5 bg-[#0f0f0f] z-20 shadow-xl flex flex-col shrink-0 overflow-hidden">
			<div className="flex items-center justify-between p-4 border-b border-white/5 bg-neutral-900/50">
				<div className="flex flex-col min-w-0">
					<span className="text-[10px] uppercase font-bold tracking-wider mb-0.5 text-blue-400">
						Properties
					</span>
					<h2 className="text-sm font-semibold text-white truncate max-w-50">
						{displayName}
					</h2>
				</div>
				<span
					className={cn(
						"text-[9px] px-2 py-1 rounded font-medium uppercase border tracking-wider",
						"bg-white/10 text-gray-300 border-white/5",
					)}
				>
					{selectedLayer.type}
				</span>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="pb-6">
					{selectedLayer.type !== "Audio" && (
						<div className="border-b border-white/5 p-4 space-y-3">
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
									<Move className="w-3.5 h-3.5" /> Transform
								</div>
								{showAutoDimensions && (
									<WithTooltip tip={autoDimensionsTooltip}>
										<Button
											variant={
												selectedLayer.autoDimensions ? "secondary" : "ghost"
											}
											size="sm"
											className={cn(
												"h-6 text-[10px] px-2",
												selectedLayer.autoDimensions
													? "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
													: "text-gray-500 hover:text-gray-300 bg-white/5",
											)}
											onClick={handleAutoDimensions}
										>
											<Sparkles className="w-3 h-3 mr-1" /> Auto W/H
										</Button>
									</WithTooltip>
								)}
							</div>

							<div className="grid grid-cols-2 gap-2">
								<DraggableNumberInput
									label="X"
									icon={MoveHorizontal}
									value={Math.round(selectedLayer.x)}
									onChange={(v) => update({ x: v })}
								/>
								<DraggableNumberInput
									label="Y"
									icon={MoveVertical}
									value={Math.round(selectedLayer.y)}
									onChange={(v) => update({ y: v })}
								/>
							</div>

							{!suppressSizeInputs && (
								<TooltipProvider>
									<div className="flex items-end gap-2">
										<DraggableNumberInput
											label="W"
											icon={MoveHorizontal}
											value={Math.round(selectedLayer.width ?? 0)}
											onChange={(v) => {
												const ratio =
													(selectedLayer.height || 1) /
													(selectedLayer.width || 1);
												update({
													width: Math.max(2, v),
													height: selectedLayer.lockAspect
														? Math.max(2, Math.round(v * ratio))
														: selectedLayer.height,
													autoDimensions: false,
												});
											}}
										/>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className={cn(
														"h-7 w-7 rounded-md transition-colors shrink-0",
														selectedLayer.lockAspect
															? "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
															: "text-gray-500 hover:text-gray-300 bg-white/5",
													)}
													onClick={() =>
														update({ lockAspect: !selectedLayer.lockAspect })
													}
												>
													{selectedLayer.lockAspect ? (
														<LinkIcon className="w-3.5 h-3.5" />
													) : (
														<UnlinkIcon className="w-3.5 h-3.5" />
													)}
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>
													{selectedLayer.lockAspect
														? "Unlock Aspect Ratio"
														: "Lock Aspect Ratio"}
												</p>
											</TooltipContent>
										</Tooltip>
										<DraggableNumberInput
											label="H"
											icon={MoveVertical}
											value={Math.round(selectedLayer.height ?? 0)}
											onChange={(v) => {
												const ratio =
													(selectedLayer.width || 1) /
													(selectedLayer.height || 1);
												update({
													height: Math.max(2, v),
													width: selectedLayer.lockAspect
														? Math.max(2, Math.round(v / ratio))
														: selectedLayer.width,
													autoDimensions: false,
												});
											}}
										/>
									</div>
								</TooltipProvider>
							)}

							<div className="grid grid-cols-2 gap-2">
								<DraggableNumberInput
									label="Rot"
									icon={RotateCw}
									value={Math.round(selectedLayer.rotation)}
									onChange={(v) => update({ rotation: v })}
								/>
								<DraggableNumberInput
									label="Scale"
									icon={Move}
									value={Number((selectedLayer.scale ?? 1).toFixed(2))}
									step={0.1}
									onChange={(v) => update({ scale: v })}
								/>
							</div>
						</div>
					)}

					{selectedLayer.type !== "Audio" && (
						<AnimationsInspectorSection layer={selectedLayer} update={update} />
					)}

					{isTextOrCaption && (
						<TextBoxSection layer={selectedLayer} update={update} />
					)}
					{isTextOrCaption && (
						<TextShadowSection layer={selectedLayer} update={update} />
					)}

					{(selectedLayer.type === "Video" ||
						selectedLayer.type === "Audio") && (
						<CollapsibleSection title="Audio" icon={Music}>
							<div className="space-y-3">
								<div className="flex items-center gap-2">
									<Volume2 className="w-4 h-4 text-gray-500 shrink-0" />
									<Slider
										value={[selectedLayer.volume ?? 1]}
										min={0}
										max={1}
										step={0.01}
										onValueChange={([v]) => update({ volume: v })}
									/>
									<span className="text-[9px] text-gray-400 w-6 text-right">
										{Math.round((selectedLayer.volume ?? 1) * 100)}%
									</span>
								</div>
							</div>
						</CollapsibleSection>
					)}

					{(selectedLayer.type === "Text" ||
						selectedLayer.type === "Caption") && (
						<TypographyControls
							fontFamily={selectedLayer.fontFamily ?? "Inter"}
							fontSize={selectedLayer.fontSize ?? 40}
							fill={selectedLayer.fill ?? "#fff"}
							fontStyle={selectedLayer.fontStyle ?? "normal"}
							textDecoration={selectedLayer.textDecoration ?? ""}
							fontWeight={
								selectedLayer.fontWeight
									? String(selectedLayer.fontWeight)
									: "400"
							}
							align={selectedLayer.align as any}
							letterSpacing={selectedLayer.letterSpacing}
							lineHeight={selectedLayer.lineHeight}
							fontList={fontList as string[]}
							onChange={update}
						/>
					)}

					{selectedLayer.type === "Caption" && (
						<CollapsibleSection
							title="Caption Style"
							icon={Subtitles}
							defaultOpen
						>
							<div className="space-y-3">
								<div className="flex flex-col gap-1.5">
									<Label className="text-[10px] text-gray-400">Preset</Label>
									<Select
										value={(selectedLayer as any).captionPreset || "default"}
										onValueChange={(v) =>
											update({ captionPreset: v as "default" | "tiktok" })
										}
									>
										<SelectTrigger className="h-7 text-[10px] bg-black/20 border-white/10">
											<SelectValue placeholder="Select preset" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="default" className="text-[10px]">
												Default Subtitles
											</SelectItem>
											<SelectItem value="tiktok" className="text-[10px]">
												TikTok Style
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</CollapsibleSection>
					)}

					<StyleControls
						backgroundColor={selectedLayer.backgroundColor}
						stroke={
							selectedLayer.type === "Text" || selectedLayer.type === "Caption"
								? selectedLayer.stroke
								: selectedLayer.borderColor
						}
						strokeWidth={
							selectedLayer.type === "Text" || selectedLayer.type === "Caption"
								? selectedLayer.strokeWidth
								: selectedLayer.borderWidth
						}
						cornerRadius={selectedLayer.borderRadius}
						padding={selectedLayer.padding}
						opacity={selectedLayer.opacity}
						showBackground={
							["Image", "SVG", "Video"].includes(selectedLayer.type) ||
							(isTextOrCaption && !roundedBoxActive)
						}
						showStroke={selectedLayer.type !== "Audio"}
						showCornerRadius={
							!roundedBoxActive &&
							selectedLayer.type !== "Text" &&
							selectedLayer.type !== "Caption" &&
							selectedLayer.type !== "Audio"
						}
						showPadding={
							!roundedBoxActive &&
							(selectedLayer.type === "Text" ||
								selectedLayer.type === "Caption")
						}
						showOpacity={selectedLayer.type !== "Audio"}
						onChange={(updates) => {
							const mappedUpdates = { ...updates };
							if (updates.cornerRadius !== undefined) {
								mappedUpdates.borderRadius = updates.cornerRadius;
								delete mappedUpdates.cornerRadius;
							}
							if (
								selectedLayer.type !== "Text" &&
								selectedLayer.type !== "Caption"
							) {
								if (updates.stroke !== undefined)
									mappedUpdates.borderColor = updates.stroke;
								if (updates.strokeWidth !== undefined)
									mappedUpdates.borderWidth = updates.strokeWidth;
							}
							update(mappedUpdates);
						}}
					/>
				</div>
			</ScrollArea>
		</div>
	);
};

// ---------------------------------------------------------------------------
// VideoDesignerEditor — root component
// ---------------------------------------------------------------------------

export interface VideoDesignerEditorProps {
	initialLayers: Map<
		string,
		OutputItem<"Text" | "Image" | "SVG" | "Video" | "Audio" | "Caption">
	>;
	node: NodeEntityType;
	onClose: () => void;
	onSave: (config: VideoCompositorNodeConfig) => void;
}

export const VideoDesignerEditor: React.FC<VideoDesignerEditorProps> = ({
	initialLayers,
	node,
	onClose,
	onSave,
}) => {
	console.log({ initialLayers });
	const nodeConfig = node.config;
	const handles = useAppSelector(handleSelectors.selectEntities);

	const [fps, setFps] = useState(nodeConfig?.FPS ?? FPS);
	const [backgroundColor, setBackgroundColor] = useState(
		nodeConfig?.backgroundColor ?? "#000000",
	);
	const [layers, setLayers] = useState<EditorLayer[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isDirty, setIsDirty] = useState(false);
	const [viewportWidth, setViewportWidth] = useState(
		roundToEven(nodeConfig?.width ?? 1280),
	);
	const [viewportHeight, setViewportHeight] = useState(
		roundToEven(nodeConfig?.height) || 720,
	);
	const [zoom, setZoom] = useState(0.5);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [mode, setMode] = useState<EditorMode>("select");
	const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_HEIGHT);
	const [currentFrame, setCurrentFrame] = useState(0);
	const [isPlaying, setIsPlayingState] = useState(false);
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
	const [sizeKnown, setSizeKnown] = useState(false);

	const playerRef = useRef<PlayerRef>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const timeRef = useRef<HTMLDivElement>(null);
	const lastModeRef = useRef<EditorMode>("select");
	const timelineScrollRef = useRef<HTMLDivElement>(null);
	const trimmedLayerIdsRef = useRef<Set<string>>(new Set());

	const markLayerTrimmed = useCallback((id: string) => {
		trimmedLayerIdsRef.current.add(id);
	}, []);
	const isLayerTrimmed = useCallback(
		(id: string) => trimmedLayerIdsRef.current.has(id),
		[],
	);

	const getTextData = (id: string) => {
		const item = initialLayers.get(id);
		return item?.type === "Text"
			? (item as OutputItem<"Text">).data || "Text"
			: "";
	};

	const getAssetUrl = (id: string) => {
		const item = initialLayers.get(id);
		if (!item) return undefined;
		if (item.type === "Video" || item.type === "Audio")
			return resolveMediaSourceUrlBrowser(item.data as VirtualMediaData);
		const fileData = item.data as FileData;
		return fileData.entity?.id
			? GetAssetEndpoint(fileData.entity)
			: fileData?.processData?.dataUrl;
	};

	const getMediaDuration = (id: string | undefined | null) => {
		if (!id) return undefined;
		const item = initialLayers.get(id);
		if (!item) return undefined;
		if (item.type === "Video" || item.type === "Audio")
			return (item.data as VirtualMediaData).metadata?.durationMs;
		const fileData = item.data as FileData;
		return fileData.entity?.duration ?? fileData?.processData?.duration;
	};

	const updateLayersHandler = (
		updater: SetStateAction<EditorLayer[]>,
		isUserChange = true,
	) => {
		setLayers(updater);
		if (isUserChange) setIsDirty(true);
	};

	const deleteLayer = (id: string) => {
		setLayers((prev) => prev.filter((l) => l.id !== id));
		if (selectedId === id) setSelectedId(null);
		setIsDirty(true);
	};

	const recomputeVideoCrops = (prev: EditorLayer[]) =>
		prev.map((layer) => {
			if (layer.type !== "Video" || !layer.virtualMedia) return layer;
			return {
				...layer,
				...(computeVideoCropRenderProps(layer.virtualMedia) ?? {}),
			};
		});

	const updateViewportWidth = (w: number) => {
		setViewportWidth(roundToEven(Math.max(2, w)));
		setLayers(recomputeVideoCrops);
		setIsDirty(true);
	};

	const updateViewportHeight = (h: number) => {
		setViewportHeight(roundToEven(Math.max(2, h)));
		setLayers(recomputeVideoCrops);
		setIsDirty(true);
	};

	const setIsPlaying = (p: boolean) => {
		setIsPlayingState(p);
		if (p) playerRef.current?.play();
		else {
			playerRef.current?.pause();
			if (playerRef.current)
				setCurrentFrame(playerRef.current.getCurrentFrame());
		}
	};

	const handlePlaybackEnded = () => {
		setIsPlayingState(false);
		setCurrentFrame(0);
		playerRef.current?.seekTo(0);
		if (timelineScrollRef.current) timelineScrollRef.current.scrollLeft = 0;
	};

	const setCurrentFrameHandler = (frame: number) => {
		setCurrentFrame(frame);
		playerRef.current?.seekTo(frame);
	};

	const zoomIn = () => setZoom((z) => Math.min(3, z + 0.1));
	const zoomOut = () => setZoom((z) => Math.max(0.1, z - 0.1));
	const zoomTo = (val: number) => setZoom(val);

	const fitView = useCallback(() => {
		if (containerSize.width === 0 || containerSize.height === 0) return;
		const scale =
			Math.min(
				containerSize.width / viewportWidth,
				containerSize.height / viewportHeight,
			) * 0.9;
		setZoom(scale);
		setPan({
			x: (containerSize.width - viewportWidth * scale) / 2,
			y: (containerSize.height - viewportHeight * scale) / 2,
		});
	}, [containerSize, viewportWidth, viewportHeight]);

	const handleSave = () => {
		onSave({
			layerUpdates: serializeLayersForSave(layers),
			width: viewportWidth,
			height: viewportHeight,
			FPS: fps,
			backgroundColor,
		});
		setIsDirty(false);
	};

	// Load initial layers
	useEffect(() => {
		const loadInitialLayers = async () => {
			const layerUpdates = { ...nodeConfig?.layerUpdates };
			const loaded: EditorLayer[] = [];
			const fontPromises: Promise<void>[] = [];
			const asyncTasks: Promise<void>[] = [];

			let maxZ = Math.max(
				0,
				...Object.values(layerUpdates).map((l) => l.zIndex ?? 0),
			);

			initialLayers.forEach((item, id) => {
				const saved = layerUpdates[id] as EditorLayer | undefined;
				const isAutoDimensions = saved?.autoDimensions ?? true;
				const handleId = id ?? "";
				const handle = handles[handleId];
				const name = handle?.label ?? handle?.dataTypes?.[0] ?? id;

				let durationMs = 0;
				let text: string | undefined;
				let src: string | undefined;
				let virtualMedia: VirtualMediaData | undefined;
				let layerWidth = saved?.width;
				let layerHeight = saved?.height;
				let cropRenderProps: ReturnType<typeof computeVideoCropRenderProps> =
					null;

				if (item.type === "Text") {
					text = getTextData(id);
				} else if (item.type === "Video" || item.type === "Audio") {
					virtualMedia = item.data as VirtualMediaData;
					const metadata = getActiveMediaMetadata(virtualMedia);
					const cutDurationMs = getEffectiveDurationMs(virtualMedia);
					durationMs = cutDurationMs ?? metadata?.durationMs ?? 0;
					src = resolveMediaSourceUrlBrowser(virtualMedia);
					cropRenderProps = computeVideoCropRenderProps(virtualMedia);
					if (isAutoDimensions) {
						layerWidth = metadata?.width ?? undefined;
						layerHeight = metadata?.height ?? undefined;
					} else {
						layerWidth = layerWidth ?? metadata?.width ?? undefined;
						layerHeight = layerHeight ?? metadata?.height ?? undefined;
					}
				} else if (isFileMedia(item.type)) {
					const fileData = item.data as FileData;
					durationMs =
						fileData.entity?.duration ?? fileData.processData?.duration ?? 0;
					src = getAssetUrl(id);
					if (item.type !== "Caption") {
						const initialW =
							fileData.processData?.width ??
							fileData.entity?.width ??
							undefined;
						const initialH =
							fileData.processData?.height ??
							fileData.entity?.height ??
							undefined;
						if (isAutoDimensions && initialW != null && initialH != null) {
							layerWidth = initialW;
							layerHeight = initialH;
						} else {
							layerWidth = layerWidth ?? initialW;
							layerHeight = layerHeight ?? initialH;
						}
					}
				}

				const hasNativeDuration =
					(item.type === "Video" ||
						item.type === "Audio" ||
						item.type === "Caption") &&
					durationMs > 0;
				const calculatedDurationMS = hasNativeDuration
					? durationMs
					: DEFAULT_DURATION_MS;
				let resolvedDurationMS =
					isLayerTrimmed(id) && saved?.durationInMS != null
						? saved.durationInMS
						: (saved?.durationInMS ?? calculatedDurationMS);

				// CRITICAL FIX: Enforce clipping `resolvedDurationMS` to the native `durationMs` boundary
				// to ensure that dragging out trims cannot magically extend past a hard crop operation.
				if (hasNativeDuration) {
					resolvedDurationMS = Math.min(resolvedDurationMS, durationMs);
				}

				const base: Partial<EditorLayer> = {
					id,
					inputHandleId: id,
					x: 0,
					y: 0,
					rotation: 0,
					scale: 1,
					opacity: 1,
					zIndex: saved?.zIndex ?? ++maxZ,
					startFrame: 0,
					durationInMS: resolvedDurationMS,
					volume: 1,
					animations: saved?.animations ?? [],
					...saved,
					src,
					text,
					name,
					virtualMedia,
					autoDimensions: isAutoDimensions,
					...(cropRenderProps ?? {}),
				};

				if (item.type === "Text") {
					const { captionPreset: _captionPreset, ...restTextDefaults } =
						TEXT_LAYER_DEFAULTS;
					const fontFamily =
						saved?.fontFamily ?? TEXT_LAYER_DEFAULTS.fontFamily;
					const textLayerStyle: Partial<EditorLayer> = {
						...restTextDefaults,
						fontSize: saved?.fontSize ?? TEXT_LAYER_DEFAULTS.fontSize,
						fontFamily,
						fontStyle: saved?.fontStyle ?? TEXT_LAYER_DEFAULTS.fontStyle,
						fontWeight: saved?.fontWeight,
						letterSpacing: saved?.letterSpacing,
						lineHeight: saved?.lineHeight,
						padding: saved?.padding ?? TEXT_LAYER_DEFAULTS.padding,
					};
					if (!layerWidth || !layerHeight) {
						const dims = measureText(text ?? "", textLayerStyle);
						layerWidth = dims.width;
						layerHeight = dims.height;
					}
					loaded.push({
						...base,
						type: "Text",
						...textLayerStyle,
						textDecoration:
							saved?.textDecoration ?? TEXT_LAYER_DEFAULTS.textDecoration,
						fill: saved?.fill ?? TEXT_LAYER_DEFAULTS.fill,
						width: layerWidth,
						height: layerHeight,
						lockAspect: true,
						autoDimensions: false,
						virtualMedia: createVirtualMedia(text ?? "", "Text"),
					} as EditorLayer);
					if (fontFamily) {
						const fontUrl = GetFontAssetUrl(fontFamily);
						if (fontUrl)
							fontPromises.push(fontManager.loadFont(fontFamily, fontUrl));
					}
				} else if (item.type === "Caption") {
					const fSize =
						saved?.fontSize ?? (CAPTION_LAYER_DEFAULTS.fontSize as number);
					const lHeight =
						saved?.lineHeight ?? (CAPTION_LAYER_DEFAULTS.lineHeight as number);
					const pad = saved?.padding ?? 0;
					const autoHeight = Math.round(fSize * lHeight * 3 + pad * 2);
					const defaultY = Math.max(
						0,
						viewportHeight - autoHeight - Math.round(viewportHeight * 0.1),
					);
					const isLegacyFullscreen =
						saved?.height !== undefined &&
						saved?.height >= viewportHeight * 0.9;
					const initialY = isLegacyFullscreen
						? defaultY
						: (saved?.y ?? defaultY);
					loaded.push({
						...base,
						type: "Caption",
						width: viewportWidth,
						height: autoHeight,
						y: initialY,
						fontSize: fSize,
						fontFamily: saved?.fontFamily ?? "Inter",
						fill: saved?.fill ?? "#ffffff",
						align: saved?.align ?? "center",
						captionPreset: saved?.captionPreset ?? "default",
						lockAspect: false,
						autoDimensions: false,
					} as EditorLayer);
					if (src && !isLayerTrimmed(id) && !saved?.durationInMS) {
						const captionSrc = src;
						const layerId = id;
						asyncTasks.push(
							fetchSrtDurationMs(captionSrc).then((srtDurationMs) => {
								if (!srtDurationMs) return;
								setLayers((prev) =>
									prev.map((l) =>
										l.id === layerId && !isLayerTrimmed(l.id)
											? { ...l, durationInMS: srtDurationMs }
											: l,
									),
								);
							}),
						);
					}
				} else if (item.type === "Image" || item.type === "SVG") {
					loaded.push({
						...base,
						type: item.type as "Image" | "SVG",
						width: layerWidth ?? 400,
						height: layerHeight ?? 400,
						lockAspect: true,
					} as EditorLayer);
				} else if (item.type === "Video") {
					loaded.push({
						...base,
						type: "Video",
						width: layerWidth ?? 400,
						height: layerHeight ?? 400,
						lockAspect: true,
					} as EditorLayer);
				} else if (item.type === "Audio") {
					loaded.push({
						...base,
						type: "Audio",
						height: 0,
						width: 0,
						lockAspect: true,
					} as EditorLayer);
				}
			});

			await Promise.all([...fontPromises, ...asyncTasks]);
			setLayers(loaded);
		};
		loadInitialLayers();
	}, [initialLayers, nodeConfig]);

	const measurementSignature = layers
		.filter((l) => l.type !== "Audio" && !l.isPlaceholder)
		.map((l) => {
			if (l.type === "Text")
				return `${l.id}:text:${l.fontFamily}:${l.fontSize}:${l.fontStyle}:${l.textDecoration}:${l.lineHeight}`;
			if (l.type === "Video" && l.virtualMedia)
				return `${l.id}:${l.type.toLowerCase()}:${l.autoDimensions}:${l.virtualMedia.operation.op}`;
			if (l.type === "Caption")
				return `${l.id}:caption:${viewportWidth}x${viewportHeight}`;
			return `${l.id}:${l.type}:${l.autoDimensions}:${l.width ?? "null"}:${l.height ?? "null"}`;
		})
		.join("|");

	useEffect(() => {
		const layersToMeasure = layers.filter(
			(l) =>
				l.type !== "Audio" &&
				l.type !== "Caption" &&
				!l.isPlaceholder &&
				(l.width == null || l.height == null || l.autoDimensions === true),
		);
		if (layersToMeasure.length === 0) return;

		let mounted = true;
		const measure = async () => {
			const updates = new Map<string, Partial<EditorLayer>>();
			await Promise.all(
				layersToMeasure.map(async (layer) => {
					try {
						if (layer.type === "Video" && layer.virtualMedia) {
							const metadata = getActiveMediaMetadata(layer.virtualMedia);
							if (
								metadata?.width != null &&
								metadata?.height != null &&
								(layer.width !== metadata.width ||
									layer.height !== metadata.height)
							) {
								updates.set(layer.id, {
									width: metadata.width,
									height: metadata.height,
								});
							}
							return;
						}
						const url = layer.inputHandleId
							? getAssetUrl(layer.inputHandleId)
							: undefined;
						if (isFileMedia(layer.type) && url) {
							const img = new Image();
							img.src = url;
							await img.decode();
							const naturalW =
								img.naturalWidth > 0 ? img.naturalWidth : (layer.width ?? 400);
							const naturalH =
								img.naturalHeight > 0
									? img.naturalHeight
									: (layer.height ?? 400);
							if (layer.width !== naturalW || layer.height !== naturalH)
								updates.set(layer.id, { width: naturalW, height: naturalH });
						} else if (layer.type === "Video" && url) {
							const video = document.createElement("video");
							video.src = url;
							await new Promise<void>((res) => {
								video.onloadedmetadata = () => res();
								video.onerror = () => res();
							});
							if (
								video.videoWidth > 0 &&
								video.videoHeight > 0 &&
								(layer.width !== video.videoWidth ||
									layer.height !== video.videoHeight)
							) {
								updates.set(layer.id, {
									width: video.videoWidth,
									height: video.videoHeight,
								});
							}
						} else if (layer.type === "Text") {
							const d = document.createElement("div");
							Object.assign(d.style, {
								fontFamily: layer.fontFamily || "Inter",
								fontSize: `${layer.fontSize || 40}px`,
								fontStyle: layer.fontStyle || "normal",
								textDecoration: layer.textDecoration || "",
								lineHeight: `${layer.lineHeight ?? 1.2}`,
								position: "absolute",
								visibility: "hidden",
								whiteSpace: "pre",
							});
							d.textContent = layer.inputHandleId
								? getTextData(layer.inputHandleId)
								: "";
							document.body.appendChild(d);
							const newW = d.offsetWidth;
							const newH = d.offsetHeight;
							document.body.removeChild(d);
							if (
								Math.abs((layer.width ?? 0) - newW) > 1 ||
								Math.abs((layer.height ?? 0) - newH) > 1
							)
								updates.set(layer.id, { width: newW, height: newH });
						}
					} catch {
						updates.set(layer.id, {
							isPlaceholder: true,
							width: layer.width ?? 100,
							height: layer.height ?? 100,
						});
					}
				}),
			);
			if (mounted && updates.size > 0)
				setLayers((prev) =>
					prev.map((l) =>
						updates.has(l.id) ? { ...l, ...updates.get(l.id) } : l,
					),
				);
		};
		measure();
		return () => {
			mounted = false;
		};
	}, [measurementSignature]);

	useEffect(() => {
		setLayers((prev) =>
			prev.map((l) => {
				if (l.type === "Caption") {
					const fSize = l.fontSize ?? 48;
					const lHeight = l.lineHeight ?? 1.2;
					const pad = l.padding ?? 0;
					return {
						...l,
						width: viewportWidth,
						height: Math.round(fSize * lHeight * 3 + pad * 2),
					};
				}
				return l;
			}),
		);
	}, [viewportWidth, viewportHeight]);

	useEffect(() => {
		fitView();
	}, [viewportWidth, viewportHeight, fitView]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) =>
			setContainerSize({
				width: entries[0].contentRect.width,
				height: entries[0].contentRect.height,
			}),
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!sizeKnown && containerSize.width > 0) {
			fitView();
			setSizeKnown(true);
		}
	}, [containerSize, fitView, sizeKnown]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const handleWheel = (e: WheelEvent) => {
			e.preventDefault();
			if (e.ctrlKey || e.metaKey) {
				const rect = el.getBoundingClientRect();
				const pointerX = e.clientX - rect.left;
				const pointerY = e.clientY - rect.top;
				const newZoom = Math.min(
					Math.max(zoom * Math.exp(-e.deltaY * 0.003), 0.1),
					5,
				);
				if (newZoom !== zoom) {
					const mousePointTo = {
						x: (pointerX - pan.x) / zoom,
						y: (pointerY - pan.y) / zoom,
					};
					setPan({
						x: pointerX - mousePointTo.x * newZoom,
						y: pointerY - mousePointTo.y * newZoom,
					});
					setZoom(newZoom);
				}
				return;
			}
			let dx = e.deltaX;
			let dy = e.deltaY;
			if (e.shiftKey && dy !== 0 && dx === 0) {
				dx = dy;
				dy = 0;
			}
			setPan((p) => ({ x: p.x - dx, y: p.y - dy }));
		};
		el.addEventListener("wheel", handleWheel, { passive: false });
		return () => el.removeEventListener("wheel", handleWheel);
	}, [zoom, pan, mode]);

	useEffect(() => {
		playerRef.current?.seekTo(0);
		const player = playerRef.current;
		if (player) {
			player.addEventListener("ended", handlePlaybackEnded);
			return () => player.removeEventListener("ended", handlePlaybackEnded);
		}
	}, []);

	// Hotkeys
	useHotkeys("v", () => setMode("select"));
	useHotkeys("h", () => setMode("pan"));
	useHotkeys("=,+", () => zoomIn());
	useHotkeys("-", () => zoomOut());
	useHotkeys("0", () => fitView());
	useHotkeys("1", () => zoomTo(1));
	useHotkeys("escape", () => setSelectedId(null));
	useHotkeys("delete, backspace", () => {
		if (selectedId) deleteLayer(selectedId);
	});
	useHotkeys(
		"space",
		(e: KeyboardEvent) => {
			if (
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA"
			)
				return;
			e.preventDefault();
			if (mode !== "pan") {
				lastModeRef.current = mode;
				setMode("pan");
			}
		},
		{ keydown: true },
	);
	useHotkeys(
		"space",
		(e: KeyboardEvent) => {
			if (
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA"
			)
				return;
			e.preventDefault();
			setMode(lastModeRef.current);
		},
		{ keyup: true },
	);
	useHotkeys(
		"meta+s, ctrl+s",
		(e) => {
			e.preventDefault();
			if (isDirty) handleSave();
		},
		{ enableOnFormTags: true },
	);

	const durationInMS =
		layers.length > 0
			? Math.max(
					...layers.map(
						(l) =>
							(l.startFrame / fps) * 1000 +
							(l.durationInMS ?? DEFAULT_DURATION_MS),
					),
				)
			: DEFAULT_DURATION_MS;

	const contextValue: EditorContextType = {
		layers,
		updateLayers: updateLayersHandler,
		deleteLayer,
		selectedId,
		setSelectedId,
		getTextData,
		getAssetUrl,
		getMediaDuration,
		viewportWidth,
		viewportHeight,
		updateViewportWidth,
		updateViewportHeight,
		fps,
		setFps: (val) => {
			setFps(val);
			setIsDirty(true);
		},
		backgroundColor,
		setBackgroundColor: (val) => {
			setBackgroundColor(val);
			setIsDirty(true);
		},
		durationInMS,
		currentFrame,
		setCurrentFrame: setCurrentFrameHandler,
		isPlaying,
		setIsPlaying,
		playerRef,
		zoom,
		setZoom,
		pan,
		setPan,
		zoomIn,
		zoomOut,
		zoomTo,
		fitView,
		mode,
		setMode,
		isDirty,
		setIsDirty,
		timelineScrollRef,
		timelineHeight,
		setTimelineHeight,
		initialLayersData: initialLayers,
		markLayerTrimmed,
		isLayerTrimmed,
	};

	return (
		<EditorContext.Provider value={contextValue}>
			<div className="flex flex-col h-screen w-full bg-[#050505] text-gray-100 overflow-hidden font-sans select-none">
				<div className="flex flex-1 min-h-0 relative overflow-hidden">
					<div
						ref={containerRef}
						className="flex-1 relative overflow-hidden"
						onMouseDown={() => setSelectedId(null)}
						style={{
							backgroundColor: "#161616",
							backgroundImage:
								"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
							backgroundSize: "20px 20px",
						}}
						role="button"
						tabIndex={0}
					>
						<div
							className="absolute origin-top-left"
							style={{
								transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
								width: viewportWidth,
								height: viewportHeight,
								visibility: sizeKnown ? "visible" : "hidden",
							}}
						>
							<div
								className="shadow-[0_0_80px_rgba(0,0,0,0.95)] media-container relative bg-[#0a0a0a] ring-1 ring-white/10 rounded-sm"
								style={{ width: viewportWidth, height: viewportHeight }}
							>
								{selectedId && (
									<div className="absolute inset-0 pointer-events-none opacity-20 border-40 border-transparent">
										<div className="w-full h-full border border-white/50 border-dashed" />
									</div>
								)}
								<Player
									ref={playerRef}
									component={CompositionScene}
									inputProps={{
										layers,
										viewportWidth,
										viewportHeight,
										backgroundColor,
									}}
									acknowledgeRemotionLicense
									durationInFrames={Math.round((durationInMS / 1000) * fps)}
									fps={fps}
									compositionWidth={viewportWidth}
									compositionHeight={viewportHeight}
									style={{ width: "100%", height: "100%" }}
									controls={false}
									doubleClickToFullscreen={false}
								/>
							</div>
						</div>
						{!isPlaying && <InteractionOverlay />}
					</div>

					<InspectorPanel />

					<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300">
						<Toolbar onClose={onClose} onSave={handleSave} timeRef={timeRef} />
					</div>
				</div>
				<TimelinePanel />
			</div>
		</EditorContext.Provider>
	);
};
