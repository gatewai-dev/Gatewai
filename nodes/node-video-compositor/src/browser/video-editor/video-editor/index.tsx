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
	VirtualVideoData,
} from "@gatewai/core/types";
import { dataTypeColors } from "@gatewai/core/types";
import type { HandleEntityType, NodeEntityType } from "@gatewai/react-store";
import {
	handleSelectors,
	useAppSelector,
	useGetFontListQuery,
} from "@gatewai/react-store";
import {
	CompositionScene,
	getActiveVideoMetadata,
	resolveVideoSourceUrl,
} from "@gatewai/remotion-compositions";
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
	ChevronDown,
	EyeOff,
	Film,
	GripHorizontal,
	GripVertical,
	Hand,
	Image as ImageIcon,
	Layers,
	Link as LinkIcon,
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
	Trash2,
	Type,
	Unlink as UnlinkIcon,
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
import { DEFAULT_DURATION_FRAMES, FPS } from "../config/index.js";

// --- Local Type Extension ---
/**
 * Extends the base layer with editor-specific and crop-rendering properties.
 *
 * Crop rendering properties (populated from VirtualVideoData.operations):
 *   - videoNaturalWidth/Height: the un-cropped source dimensions
 *   - videoCropOffsetX/Y: negative pixel offset to position source video inside
 *     the (overflow:hidden) layer container so the correct region is visible
 *
 * These allow CompositionScene (and CropAwareCompositionScene) to render the
 * cropped region correctly without server-side processing.
 */
export type EditorLayer = ExtendedLayer & {
	// Crop rendering — set whenever the virtualVideo has a crop operation
	videoNaturalWidth?: number;
	videoNaturalHeight?: number;
	videoCropOffsetX?: number; // pixels, typically negative
	videoCropOffsetY?: number; // pixels, typically negative
};

// --- Constants & Configuration ---
const RULER_HEIGHT = 28;
const TRACK_HEIGHT = 32;
const HEADER_WIDTH = 200;
const DEFAULT_TIMELINE_HEIGHT = 208;
const MIN_TIMELINE_HEIGHT = 120;
const MAX_TIMELINE_HEIGHT = 400;

const ASPECT_RATIOS = [
	{ label: "Youtube / HD (16:9)", width: 1280, height: 720 },
	{ label: "Full HD (16:9)", width: 1920, height: 1080 },
	{ label: "TikTok / Reel (9:16)", width: 720, height: 1280 },
	{ label: "Square (1:1)", width: 1080, height: 1080 },
	{ label: "Portrait (4:5)", width: 1080, height: 1350 },
];

// --- Helper Functions ---
const resolveLayerLabel = (
	handle: HandleEntityType,
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

/**
 * Inspects the operation stack of a VirtualVideoData and extracts the
 * information needed to render the crop visually in the editor preview.
 *
 * The caller should apply the result like:
 *
 *   <div style={{ width: croppedW, height: croppedH, overflow:'hidden', position:'relative' }}>
 *     <video style={{ position:'absolute', width: naturalW, height: naturalH,
 *                     left: offsetX, top: offsetY }} />
 *   </div>
 *
 * Returns null when no crop operation is present.
 */
function computeVideoCropRenderProps(virtualVideo: VirtualVideoData): {
	videoNaturalWidth: number;
	videoNaturalHeight: number;
	videoCropOffsetX: number;
	videoCropOffsetY: number;
} | null {
	const ops = virtualVideo.operations ?? [];

	// Walk the operation stack, tracking accumulated dimensions so we can
	// map crop percentages back to pixels at the time of each crop.
	let currentW = virtualVideo.sourceMeta?.width ?? 0;
	let currentH = virtualVideo.sourceMeta?.height ?? 0;

	// Accumulate crop offsets in source-video pixel space
	let totalOffsetX = 0; // pixels from the left of the *original* source
	let totalOffsetY = 0; // pixels from the top of the *original* source

	let hasCrop = false;

	for (const op of ops) {
		if (op.op === "crop") {
			hasCrop = true;
			// The crop percentages are relative to `currentW/H` at this step
			const cropLeftPx = (op.leftPercentage / 100) * currentW;
			const cropTopPx = (op.topPercentage / 100) * currentH;
			const cropW = (op.widthPercentage / 100) * currentW;
			const cropH = (op.heightPercentage / 100) * currentH;

			totalOffsetX += cropLeftPx;
			totalOffsetY += cropTopPx;
			currentW = cropW;
			currentH = cropH;
		} else if (op.op === "speed") {
			// Speed doesn't change spatial dimensions
		} else if (op.op === "cut") {
			// Cut doesn't change spatial dimensions
		} else if (op.metadata) {
			// For other ops that update metadata (rotate, flip, etc.),
			// update current dimensions from the metadata
			if (op.metadata.width) currentW = op.metadata.width;
			if (op.metadata.height) currentH = op.metadata.height;
		}
	}

	if (!hasCrop) return null;

	const sourceW = virtualVideo.sourceMeta?.width ?? 1;
	const sourceH = virtualVideo.sourceMeta?.height ?? 1;

	return {
		videoNaturalWidth: sourceW,
		videoNaturalHeight: sourceH,
		// Negative because we shift the video *left/up* to bring the crop region into view
		videoCropOffsetX: -totalOffsetX,
		videoCropOffsetY: -totalOffsetY,
	};
}

// --- Context & Types ---
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
	getMediaDuration: (
		id: string | undefined | null,
	) => number | null | undefined;
	viewportWidth: number;
	viewportHeight: number;
	updateViewportWidth: (w: number) => void;
	updateViewportHeight: (h: number) => void;
	fps: number;
	durationInFrames: number;
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
	mode: "select" | "pan";
	setMode: Dispatch<SetStateAction<"select" | "pan">>;
	isDirty: boolean;
	setIsDirty: Dispatch<SetStateAction<boolean>>;
	timelineScrollRef: React.RefObject<HTMLDivElement | null>;
	timelineHeight: number;
	setTimelineHeight: Dispatch<SetStateAction<number>>;
	initialLayersData: Map<string, OutputItem<any>>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);
const useEditor = () => {
	const ctx = useContext(EditorContext);
	if (!ctx) throw new Error("useEditor must be used within EditorProvider");
	return ctx;
};

// --- Components: Unified Clip ---
const UnifiedClip: React.FC<{
	layer: EditorLayer;
	isSelected: boolean;
}> = ({ layer, isSelected }) => {
	const handles = useAppSelector(handleSelectors.selectEntities);
	const handle = layer.inputHandleId ? handles[layer.inputHandleId] : undefined;
	const name = useMemo(() => resolveLayerLabel(handle, layer), [handle, layer]);

	const styleConfig = useMemo(() => {
		const config = dataTypeColors[layer.type] || {
			bg: "bg-gray-600",
			border: "border-gray-500",
			text: "text-gray-100",
			hex: "#4b5563",
		};

		let Icon = Layers;
		switch (layer.type) {
			case "Video":
				Icon = Film;
				break;
			case "Audio":
				Icon = Music;
				break;
			case "Image":
				Icon = ImageIcon;
				break;
			case "Text":
				Icon = Type;
				break;
		}

		return {
			...config,
			icon: Icon,
		};
	}, [layer.type]);

	const Icon = styleConfig.icon;

	return (
		<div
			className={`h-full w-full relative overflow-hidden rounded-md transition-all duration-75 border
      ${styleConfig.bg} ${styleConfig.border}
      ${isSelected ? "brightness-110 ring-2 ring-white/70 shadow-lg" : "opacity-90 hover:opacity-100 hover:brightness-105"}
    `}
		>
			<div
				className="absolute inset-0 opacity-10 pointer-events-none"
				style={{
					backgroundImage:
						"linear-gradient(45deg,rgba(0,0,0,.1) 25%,transparent 25%,transparent 50%,rgba(0,0,0,.1) 50%,rgba(0,0,0,.1) 75%,transparent 75%,transparent)",
					backgroundSize: "10px 10px",
				}}
			/>
			<div className="absolute inset-0 px-2 flex items-center justify-between pointer-events-none">
				<div className="flex items-center gap-1.5 min-w-0">
					<Icon className="w-3 h-3 text-white/90 shrink-0" />
					<span className="text-[10px] text-white font-medium truncate drop-shadow-md select-none">
						{name}
					</span>
				</div>
			</div>
			{isSelected && (
				<>
					<div className="absolute left-0 top-0 bottom-0 w-1 bg-white/30" />
					<div className="absolute right-0 top-0 bottom-0 w-1 bg-white/30" />
				</>
			)}
		</div>
	);
};

// --- Components: Timeline Core ---
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
	const [resizeAnchor, setResizeAnchor] = useState<
		"tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r" | null
	>(null);
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

	const visibleLayers = useMemo(() => {
		return layers
			.filter(
				(l) =>
					l.type !== "Audio" &&
					currentFrame >= (l.startFrame ?? 0) &&
					currentFrame <
						(l.startFrame ?? 0) +
							(l.durationInFrames ?? DEFAULT_DURATION_FRAMES),
			)
			.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
	}, [layers, currentFrame]);

	const handleMouseDown = (
		e: React.MouseEvent,
		layerId?: string,
		anchor?: "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r",
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
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;
		setSelectedId(layerId);
		setDragStart({ x: e.clientX, y: e.clientY });
		setInitialPos({
			x: layer.x,
			y: layer.y,
			width: layer.width ?? 0,
			height: layer.height ?? 0,
			rotation: layer.rotation,
			scale: layer.scale ?? 1,
		});
		if (anchor) {
			setIsResizing(true);
			setResizeAnchor(anchor);
		} else {
			setIsDragging(true);
		}
	};

	const handleRotateStart = (e: React.MouseEvent, layerId: string) => {
		e.stopPropagation();
		e.preventDefault();
		setSelectedId(layerId);
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;
		const centerX = layer.x + (layer.width ?? 0) / 2;
		const centerY = layer.y + (layer.height ?? 0) / 2;
		const screenCenterX = centerX * zoom + pan.x;
		const screenCenterY = centerY * zoom + pan.y;
		setInitialAngle(
			Math.atan2(e.clientY - screenCenterY, e.clientX - screenCenterX),
		);
		setInitialPos({
			...layer,
			width: layer.width ?? 0,
			height: layer.height ?? 0,
			x: layer.x,
			y: layer.y,
			rotation: layer.rotation,
			scale: layer.scale ?? 1,
		});
		setIsRotating(true);
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isPanning) {
			const dx = e.clientX - dragStart.x;
			const dy = e.clientY - dragStart.y;
			setPan({ x: initialPan.x + dx, y: initialPan.y + dy });
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
		} else if (isResizing && resizeAnchor) {
			const layer = layers.find((l) => l.id === selectedId);
			const theta = initialPos.rotation * (Math.PI / 180);
			const cos = Math.cos(theta);
			const sin = Math.sin(theta);
			let localDx = cos * dx + sin * dy;
			let localDy = -sin * dx + cos * dy;
			localDx /= initialPos.scale;
			localDy /= initialPos.scale;

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
				if (resizeAnchor === "r" || resizeAnchor === "l") {
					changeH = changeW * ratio;
				} else if (resizeAnchor === "b" || resizeAnchor === "t") {
					changeW = changeH / ratio;
				} else {
					if (Math.abs(changeW) * ratio > Math.abs(changeH)) {
						changeH = changeW * ratio;
					} else {
						changeW = changeH / ratio;
					}
				}
			}

			const newWidth = Math.max(10, initialPos.width + changeW);
			const newHeight = Math.max(10, initialPos.height + changeH);

			const diffW = newWidth - initialPos.width;
			const diffH = newHeight - initialPos.height;

			let localShiftX = 0;
			let localShiftY = 0;
			if (effectiveAnchor.includes("r")) localShiftX = diffW / 2;
			if (effectiveAnchor.includes("l")) localShiftX = -diffW / 2;
			if (effectiveAnchor.includes("b")) localShiftY = diffH / 2;
			if (effectiveAnchor.includes("t")) localShiftY = -diffH / 2;

			const worldShiftX = cos * localShiftX - sin * localShiftY;
			const worldShiftY = sin * localShiftX + cos * localShiftY;

			const newX = initialPos.x + worldShiftX - diffW / 2;
			const newY = initialPos.y + worldShiftY - diffH / 2;

			updateLayers((prev) =>
				prev.map((l) =>
					l.id === selectedId
						? {
								...l,
								width: Math.round(newWidth),
								height: Math.round(newHeight),
								x: Math.round(newX),
								y: Math.round(newY),
								autoDimensions: false,
							}
						: l,
				),
			);
		} else if (isRotating) {
			const layer = layers.find((l) => l.id === selectedId);
			if (!layer) return;
			const centerX = layer.x + (layer.width ?? 0) / 2;
			const centerY = layer.y + (layer.height ?? 0) / 2;
			const screenCenterX = centerX * zoom + pan.x;
			const screenCenterY = centerY * zoom + pan.y;
			const currentAngle = Math.atan2(
				e.clientY - screenCenterY,
				e.clientX - screenCenterX,
			);
			const delta = currentAngle - initialAngle;
			const newRot = initialPos.rotation + (delta * 180) / Math.PI;
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
			onMouseDown={(e) => handleMouseDown(e)}
			role="button"
			tabIndex={0}
			onKeyDown={() => {}}
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
						onKeyDown={(e) => {
							if (e.key === "Enter") setSelectedId(layer.id);
						}}
						onMouseDown={(e) => handleMouseDown(e, layer.id)}
						className={`absolute group outline-none select-none p-0 m-0 border-0 bg-transparent text-left ${
							selectedId === layer.id ? "z-50" : "z-auto"
						}`}
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
							className={`absolute inset-0 pointer-events-none transition-all duration-150 ${
								selectedId === layer.id
									? "border-2 border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]"
									: "border border-transparent group-hover:border-blue-400/50"
							}`}
						/>
						{selectedId === layer.id && (
							<>
								{layer.type !== "Text" &&
									(["tl", "t", "tr", "r", "br", "b", "bl", "l"] as const).map(
										(pos) => {
											let cursor = "";
											if (pos === "tl" || pos === "br")
												cursor = "cursor-nwse-resize";
											else if (pos === "tr" || pos === "bl")
												cursor = "cursor-nesw-resize";
											else if (pos === "t" || pos === "b")
												cursor = "cursor-ns-resize";
											else cursor = "cursor-ew-resize";

											let posClass = "";
											if (pos === "tl") posClass = "-top-1.5 -left-1.5";
											if (pos === "t")
												posClass = "-top-1.5 left-1/2 -translate-x-1/2";
											if (pos === "tr") posClass = "-top-1.5 -right-1.5";
											if (pos === "r")
												posClass = "top-1/2 -right-1.5 -translate-y-1/2";
											if (pos === "br") posClass = "-bottom-1.5 -right-1.5";
											if (pos === "b")
												posClass = "-bottom-1.5 left-1/2 -translate-x-1/2";
											if (pos === "bl") posClass = "-bottom-1.5 -left-1.5";
											if (pos === "l")
												posClass = "top-1/2 -left-1.5 -translate-y-1/2";

											return (
												<div
													key={pos}
													role="button"
													tabIndex={-1}
													className={`absolute bg-white border border-blue-600 rounded-full shadow-sm z-50 transition-transform hover:scale-125
                                                    ${pos.length === 1 ? "w-2.5 h-2.5" : "w-3 h-3"}
                                                    ${posClass} ${cursor}
                                                `}
													onMouseDown={(e) => handleMouseDown(e, layer.id, pos)}
												/>
											);
										},
									)}
								<div
									className="absolute -top-6 left-1/2 -translate-x-1/2 h-6 w-px bg-blue-500"
									style={{ transform: `scaleX(${1 / zoom})` }}
								/>
								<div
									role="button"
									tabIndex={-1}
									className="absolute -top-8 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-blue-600 rounded-full shadow-sm cursor-grab active:cursor-grabbing hover:scale-110"
									onMouseDown={(e) => handleRotateStart(e, layer.id)}
								/>
							</>
						)}
					</button>
				))}
			</div>
		</div>
	);
};

// --- Toolbar ---
const Toolbar = React.memo<{
	onClose: () => void;
	onSave: () => void;
	timeRef: React.RefObject<HTMLDivElement | null>;
}>(({ onClose, onSave, timeRef }) => {
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

	const handlePlayPause = useCallback(() => {
		if (playerRef.current) {
			if (isPlaying) playerRef.current.pause();
			else playerRef.current.play();
			setIsPlaying(!isPlaying);
		}
	}, [isPlaying, setIsPlaying, playerRef]);

	const handleCloseClick = useCallback(() => {
		if (isDirty) {
			setShowCloseDialog(true);
		} else {
			onClose();
		}
	}, [isDirty, onClose]);

	const handleSaveAndClose = useCallback(() => {
		onSave();
		setShowCloseDialog(false);
		onClose();
	}, [onSave, onClose]);

	const handleDiscardAndClose = useCallback(() => {
		setShowCloseDialog(false);
		onClose();
	}, [onClose]);

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
						className="text-[11px] font-mono tabular-nums text-neutral-300 min-w-[70px] text-center select-none cursor-default"
					>
						{Math.floor(currentFrame / fps)}s :{" "}
						{(currentFrame % fps).toString().padStart(2, "0")}f
					</div>
					<div className="w-px h-5 bg-white/10 mx-1" />
					<div className="flex rounded-full p-0.5">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={mode === "select" ? "secondary" : "ghost"}
									size="icon"
									className="rounded-full w-8 h-8"
									onClick={() => setMode("select")}
								>
									<MousePointer className="w-3.5 h-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Select Tool (V)</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={mode === "pan" ? "secondary" : "ghost"}
									size="icon"
									className="rounded-full w-8 h-8"
									onClick={() => setMode("pan")}
								>
									<Hand className="w-3.5 h-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Pan Tool (H) or hold Space</TooltipContent>
						</Tooltip>
					</div>
					<div className="w-px h-5 bg-white/10 mx-1" />
					<Menubar className="border-none bg-transparent h-auto p-0">
						<MenubarMenu>
							<MenubarTrigger asChild>
								<Button
									variant="ghost"
									className="h-8 px-3 text-[11px] rounded-full text-gray-300 hover:text-white hover:bg-white/10 font-medium min-w-[80px] justify-between"
								>
									{Math.round(zoom * 100)}%
									<ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
								</Button>
							</MenubarTrigger>
							<MenubarContent
								align="center"
								className="min-w-[160px] bg-neutral-900/95 backdrop-blur-xl border-white/10 text-gray-200"
							>
								<MenubarItem onClick={zoomIn}>
									<span className="flex-1">Zoom In</span>
									<span className="text-xs text-gray-500 ml-4">+</span>
								</MenubarItem>
								<MenubarItem onClick={zoomOut}>
									<span className="flex-1">Zoom Out</span>
									<span className="text-xs text-gray-500 ml-4">−</span>
								</MenubarItem>
								<MenubarItem onClick={() => zoomTo(1)}>
									<span className="flex-1">100%</span>
									<span className="text-xs text-gray-500 ml-4">1</span>
								</MenubarItem>
								<MenubarItem onClick={fitView}>
									<span className="flex-1">Fit to Screen</span>
									<span className="text-xs text-gray-500 ml-4">0</span>
								</MenubarItem>
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
									<Save className="w-3.5 h-3.5 mr-1" />
									Save
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
									onClick={handleCloseClick}
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
							onClick={handleDiscardAndClose}
							className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0"
						>
							Discard
						</Button>
						<AlertDialogAction
							onClick={handleSaveAndClose}
							className="bg-primary text-primary-foreground hover:bg-primary/90"
						>
							Save & Close
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
});

// --- Timeline Panel ---
interface SortableTrackProps {
	layer: EditorLayer;
	isSelected: boolean;
	onSelect: () => void;
}

const SortableTrackHeader: React.FC<SortableTrackProps> = ({
	layer,
	isSelected,
	onSelect,
}) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: layer.id });
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		height: TRACK_HEIGHT,
		minHeight: `${TRACK_HEIGHT}px`,
		zIndex: isDragging ? 999 : "auto",
	};

	const handles = useAppSelector(handleSelectors.selectEntities);
	const handle = layer.inputHandleId ? handles[layer.inputHandleId] : undefined;
	const name = useMemo(() => resolveLayerLabel(handle, layer), [handle, layer]);
	const colorConfig = dataTypeColors[layer.type];

	return (
		<button
			ref={setNodeRef}
			style={style}
			type="button"
			className={`w-full text-left p-0 m-0 bg-transparent border-0 border-b border-white/5 flex items-center pl-3 pr-2 text-xs gap-3 group outline-none transition-colors select-none
        ${isSelected ? "bg-white/5 text-blue-100" : "hover:bg-white/5 text-gray-400"}
        ${isDragging ? "opacity-50 bg-neutral-900" : ""}
      `}
			onClick={onSelect}
		>
			<div
				{...attributes}
				{...listeners}
				className="cursor-grab active:cursor-grabbing p-1.5 text-gray-600 hover:text-gray-300 transition-colors rounded hover:bg-white/5"
			>
				<GripVertical className="h-3.5 w-3.5" />
			</div>
			<div className="flex-1 flex items-center gap-2.5 min-w-0">
				<div
					className={`w-6 h-6 rounded flex items-center justify-center ${colorConfig ? `${colorConfig.bg}/20 ${colorConfig.text}` : ""}`}
				>
					{layer.type === "Video" && <Film className="w-3.5 h-3.5" />}
					{layer.type === "Image" && <ImageIcon className="w-3.5 h-3.5" />}
					{layer.type === "Text" && <Type className="w-3.5 h-3.5" />}
					{layer.type === "Audio" && <Music className="w-3.5 h-3.5" />}
				</div>
				<span className="truncate font-medium text-[11px] leading-tight opacity-80">
					{name}
				</span>
			</div>
			{layer.animations && layer.animations.length > 0 && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger>
							<div className="p-1 rounded bg-amber-500/10">
								<Zap className="w-3 h-3 text-amber-400" />
							</div>
						</TooltipTrigger>
						<TooltipContent>Animations applied</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}
		</button>
	);
};

const TimelinePanel: React.FC = () => {
	const {
		layers,
		updateLayers,
		durationInFrames,
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
	} = useEditor();
	const playheadRef = useRef<HTMLDivElement>(null);
	const [isPanningTimeline, setIsPanningTimeline] = useState(false);
	const [dragStartX, setDragStartX] = useState(0);
	const [initialScroll, setInitialScroll] = useState(0);
	const [pixelsPerFrame, setPixelsPerFrame] = useState(10);
	const [isResizingTimeline, setIsResizingTimeline] = useState(false);
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0)),
		[layers],
	);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const oldIndex = sortedLayers.findIndex((l) => l.id === active.id);
			const newIndex = sortedLayers.findIndex((l) => l.id === over.id);
			const newSorted = arrayMove(sortedLayers, oldIndex, newIndex);
			const updatedLayers = newSorted.map((l, idx) => ({
				...l,
				zIndex: newSorted.length - idx,
			}));
			updateLayers((prev) => {
				const updateMap = new Map(updatedLayers.map((l) => [l.id, l]));
				return prev.map((l) => updateMap.get(l.id) || l);
			});
		}
	};

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
					if (x > scroll + width - 150) {
						scrollContainerRef.current.scrollLeft = x - 150;
					}
				}
			}
			rafId = requestAnimationFrame(loop);
		};
		if (isPlaying) {
			loop();
		} else if (playheadRef.current) {
			playheadRef.current.style.transform = `translateX(${currentFrame * pixelsPerFrame}px)`;
		}
		return () => {
			if (rafId) cancelAnimationFrame(rafId);
		};
	}, [isPlaying, currentFrame, pixelsPerFrame, playerRef]);

	const handleTimelineClick = (e: React.MouseEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const frame = Math.max(0, Math.floor(clickX / pixelsPerFrame));
		if (playerRef.current) playerRef.current.seekTo(frame);
		setCurrentFrame(frame);
	};

	useEffect(() => {
		const el = scrollContainerRef.current;
		if (!el) return;
		const handleWheel = (e: WheelEvent) => {
			if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
				e.preventDefault();
				el.scrollLeft += e.deltaX || e.deltaY;
			}
		};
		el.addEventListener("wheel", handleWheel, { passive: false });
		return () => el.removeEventListener("wheel", handleWheel);
	}, [scrollContainerRef]);

	const handleClipManipulation = (
		e: React.MouseEvent,
		layerId: string,
		type: "move" | "trim",
	) => {
		e.stopPropagation();
		const startX = e.clientX;
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;
		const initialStart = layer.startFrame ?? 0;
		const initialDuration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
		const onMove = (moveEv: MouseEvent) => {
			const diffPx = moveEv.clientX - startX;
			const diffFrames = Math.round(diffPx / pixelsPerFrame);
			if (type === "move") {
				const newStart = Math.max(0, initialStart + diffFrames);
				updateLayers((prev) =>
					prev.map((l) =>
						l.id === layerId ? { ...l, startFrame: newStart } : l,
					),
				);
			} else {
				let newDuration = Math.max(1, initialDuration + diffFrames);
				if (layer.maxDurationInFrames) {
					newDuration = Math.min(newDuration, layer.maxDurationInFrames);
				}
				updateLayers((prev) =>
					prev.map((l) =>
						l.id === layerId ? { ...l, durationInFrames: newDuration } : l,
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

	const handleTimelineResize = (e: React.MouseEvent) => {
		e.preventDefault();
		const startY = e.clientY;
		const startHeight = timelineHeight;
		setIsResizingTimeline(true);

		const onMove = (moveEv: MouseEvent) => {
			const delta = startY - moveEv.clientY;
			const newHeight = Math.min(
				MAX_TIMELINE_HEIGHT,
				Math.max(MIN_TIMELINE_HEIGHT, startHeight + delta),
			);
			setTimelineHeight(newHeight);
		};

		const onUp = () => {
			setIsResizingTimeline(false);
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	return (
		<div
			className="flex flex-col border-t border-white/10 bg-[#0f0f0f] shrink-0 select-none z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]"
			style={{ height: timelineHeight }}
		>
			<div
				className={`h-1.5 flex items-center justify-center cursor-ns-resize hover:bg-white/10 transition-colors group ${isResizingTimeline ? "bg-blue-500/20" : ""}`}
				onMouseDown={handleTimelineResize}
			>
				<GripHorizontal className="w-6 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" />
			</div>
			<div className="h-8 border-b border-white/5 flex items-center justify-between px-3 bg-neutral-900 shrink-0 z-40">
				<div className="text-[10px] font-bold text-neutral-400 tracking-wider flex items-center gap-1.5">
					<Layers className="w-3.5 h-3.5" /> TIMELINE
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 rounded hover:bg-white/10 text-gray-400"
						onClick={() => setPixelsPerFrame((p) => Math.max(1, p - 2))}
					>
						<Minus className="h-3 w-3" />
					</Button>
					<Slider
						value={[pixelsPerFrame]}
						min={1}
						max={60}
						step={1}
						onValueChange={([v]) => setPixelsPerFrame(v)}
						className="w-24"
					/>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 rounded hover:bg-white/10 text-gray-400"
						onClick={() => setPixelsPerFrame((p) => Math.min(100, p + 2))}
					>
						<Plus className="h-3 w-3" />
					</Button>
				</div>
			</div>
			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-auto bg-[#0a0a0a] timeline-scroll-area custom-scrollbar"
				style={{
					cursor: isPanningTimeline ? "grabbing" : "default",
					scrollbarWidth: "thin",
					scrollbarColor: "#333 #0a0a0a",
				}}
				onMouseDown={(e) => {
					if (
						e.button === 0 &&
						(e.target as HTMLElement).classList.contains("timeline-bg")
					) {
						setIsPanningTimeline(true);
						setDragStartX(e.clientX);
						setInitialScroll(scrollContainerRef.current?.scrollLeft || 0);
					}
				}}
				onMouseMove={(e) => {
					if (isPanningTimeline && scrollContainerRef.current) {
						const dx = e.clientX - dragStartX;
						scrollContainerRef.current.scrollLeft = initialScroll - dx;
					}
				}}
				onMouseUp={() => setIsPanningTimeline(false)}
				onMouseLeave={() => setIsPanningTimeline(false)}
				role="button"
				tabIndex={0}
				onKeyDown={() => {}}
			>
				<div
					className="relative flex flex-col min-h-full"
					style={{
						width: Math.max(
							scrollContainerRef.current?.clientWidth || 0,
							HEADER_WIDTH + durationInFrames * pixelsPerFrame + 800,
						),
					}}
				>
					<div
						className="sticky top-0 z-50 flex shrink-0"
						style={{ height: RULER_HEIGHT }}
					>
						<div
							className="sticky left-0 z-50 border-r border-b border-white/5 bg-neutral-900 shrink-0 shadow-lg"
							style={{ width: HEADER_WIDTH }}
						/>
						<div
							className="flex-1 bg-neutral-900/90 backdrop-blur-sm border-b border-white/5 relative cursor-pointer"
							onClick={handleTimelineClick}
						>
							<svg
								role="img"
								aria-label="tick"
								className="absolute inset-0 w-full h-full pointer-events-none opacity-50"
							>
								<defs>
									<pattern
										id="ruler-ticks"
										x="0"
										y="0"
										width={fps * pixelsPerFrame}
										height={RULER_HEIGHT}
										patternUnits="userSpaceOnUse"
									>
										<line
											x1="0.5"
											y1={RULER_HEIGHT}
											x2="0.5"
											y2={RULER_HEIGHT - 12}
											stroke="#666"
											strokeWidth="1"
										/>
										{[0.25, 0.5, 0.75].map((t) => (
											<line
												key={t}
												x1={t * fps * pixelsPerFrame + 0.5}
												y1={RULER_HEIGHT}
												x2={t * fps * pixelsPerFrame + 0.5}
												y2={RULER_HEIGHT - 6}
												stroke="#333"
											/>
										))}
									</pattern>
								</defs>
								<rect width="100%" height="100%" fill="url(#ruler-ticks)" />
							</svg>
							{Array.from({
								length: Math.ceil(durationInFrames / fps) + 5,
							}).map((_, sec) => (
								<span
									key={`${sec}_label_time`}
									className="absolute top-1.5 text-[10px] font-mono text-gray-500 select-none pointer-events-none font-medium"
									style={{ left: sec * fps * pixelsPerFrame + 4 }}
								>
									{sec}s
								</span>
							))}
							<div
								ref={playheadRef}
								className="absolute top-0 bottom-0 z-60 pointer-events-none h-screen will-change-transform"
							>
								<div className="absolute -translate-x-1/2 top-0 w-3 h-3 text-blue-500 fill-current filter drop-shadow-md">
									<svg viewBox="0 0 12 12" className="w-full h-full">
										<title>Playhead</title>
										<path d="M0,0 L12,0 L12,8 L6,12 L0,8 Z" />
									</svg>
								</div>
								<div className="w-px h-full bg-blue-500 absolute left-0 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />
							</div>
						</div>
					</div>
					<div className="flex relative flex-1">
						<div
							className="sticky left-0 z-30 bg-[#0f0f0f] border-r border-white/5 shrink-0"
							style={{ width: HEADER_WIDTH }}
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
									{sortedLayers.map((layer) => (
										<SortableTrackHeader
											key={layer.id}
											layer={layer}
											isSelected={layer.id === selectedId}
											onSelect={() => setSelectedId(layer.id)}
										/>
									))}
								</SortableContext>
							</DndContext>
						</div>
						<div className="flex-1 relative timeline-bg min-h-full bg-[#0a0a0a]">
							<div
								className="absolute inset-0 pointer-events-none opacity-[0.03]"
								style={{
									backgroundImage:
										"linear-gradient(90deg, #fff 1px, transparent 1px)",
									backgroundSize: `${fps * pixelsPerFrame}px 100%`,
								}}
							/>
							{sortedLayers.map((layer) => {
								const duration =
									layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
								const width = Math.max(10, duration * pixelsPerFrame);
								const isSelected = layer.id === selectedId;
								return (
									<div
										key={layer.id}
										style={{ height: TRACK_HEIGHT }}
										className={`border-b border-white/5 relative group/track ${
											isSelected ? "bg-white/2" : ""
										}`}
									>
										<button
											type="button"
											onKeyDown={(e) => {
												if (e.key === "Enter") setSelectedId(layer.id);
											}}
											className={`
                          absolute top-1 bottom-1 rounded-md text-left p-0 m-0 border-0 bg-transparent
                          flex items-center overflow-hidden cursor-move outline-none
                          ${isSelected ? "z-20" : "z-10"}
                      `}
											style={{
												left: (layer.startFrame ?? 0) * pixelsPerFrame,
												width,
												minWidth: "10px",
											}}
											onMouseDown={(e) =>
												handleClipManipulation(e, layer.id, "move")
											}
											onClick={(e) => {
												e.stopPropagation();
												setSelectedId(layer.id);
											}}
										>
											<UnifiedClip layer={layer} isSelected={isSelected} />
											<div
												className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize z-30 group/handle"
												onMouseDown={(e) =>
													handleClipManipulation(e, layer.id, "trim")
												}
											>
												<div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-1 h-4 bg-black/20 rounded-full group-hover/handle:bg-white/50 transition-colors" />
											</div>
										</button>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

// --- Inspector ---
const InspectorPanel: React.FC = () => {
	const {
		selectedId,
		layers,
		updateLayers,
		viewportWidth,
		viewportHeight,
		updateViewportWidth,
		updateViewportHeight,
		initialLayersData,
	} = useEditor();
	const selectedLayer = layers.find((f) => f.id === selectedId);
	const [addAnimOpen, setAddAnimOpen] = useState(false);
	const { data: fontList } = useGetFontListQuery({});

	const handles = useAppSelector(handleSelectors.selectEntities);

	const animationCategories = useMemo(
		() => [
			{
				label: "Entrance",
				color: "text-green-400",
				animations: [
					{
						type: "fade-in" as AnimationType,
						label: "Fade In",
						icon: Sparkles,
					},
					{
						type: "slide-in-left" as AnimationType,
						label: "Slide Left",
						icon: ArrowRight,
					},
					{
						type: "slide-in-right" as AnimationType,
						label: "Slide Right",
						icon: ArrowLeft,
					},
					{
						type: "slide-in-top" as AnimationType,
						label: "Slide Down",
						icon: ArrowDown,
					},
					{
						type: "slide-in-bottom" as AnimationType,
						label: "Slide Up",
						icon: ArrowUp,
					},
					{ type: "zoom-in" as AnimationType, label: "Zoom In", icon: ZoomIn },
				],
			},
			{
				label: "Exit",
				color: "text-red-400",
				animations: [
					{
						type: "fade-out" as AnimationType,
						label: "Fade Out",
						icon: EyeOff,
					},
					{
						type: "zoom-out" as AnimationType,
						label: "Zoom Out",
						icon: ZoomOut,
					},
				],
			},
			{
				label: "Emphasis",
				color: "text-yellow-400",
				animations: [
					{
						type: "rotate-cw" as AnimationType,
						label: "Rotate CW",
						icon: RotateCw,
					},
					{
						type: "rotate-ccw" as AnimationType,
						label: "Rotate CCW",
						icon: RotateCcw,
					},
					{ type: "bounce" as AnimationType, label: "Bounce", icon: ArrowUp },
					{ type: "shake" as AnimationType, label: "Shake", icon: Move },
				],
			},
		],
		[],
	);

	const addAnimation = (type: AnimationType) => {
		if (!selectedLayer) return;
		const newAnimation: VideoAnimation = {
			id: generateId(),
			type,
			value: 1,
		};
		updateLayers((prev) =>
			prev.map((l) =>
				l.id === selectedId
					? { ...l, animations: [...(l.animations || []), newAnimation] }
					: l,
			),
		);
		setAddAnimOpen(false);
	};

	const update = (patch: Partial<EditorLayer>) => {
		updateLayers((prev) =>
			prev.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)),
		);
	};

	if (!selectedLayer) {
		return (
			<div className="w-80 h-full border-l border-white/5 bg-[#0f0f0f] flex flex-col z-20 shadow-xl shrink-0 overflow-hidden">
				<div className="p-4 bg-neutral-900 border-b border-white/5">
					<div className="flex items-center gap-2 text-xs font-bold text-gray-200 uppercase tracking-wide">
						<Settings2 className="w-3.5 h-3.5 text-blue-400" />
						Project Settings
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

	const handle = selectedLayer.inputHandleId
		? handles[selectedLayer.inputHandleId]
		: undefined;
	const displayName = resolveLayerLabel(handle, selectedLayer);

	// Whether the crop source dimensions are available for this layer
	const hasCropDimensions =
		selectedLayer.type === "Video" &&
		selectedLayer.videoNaturalWidth != null &&
		selectedLayer.videoNaturalHeight != null;

	return (
		<div className="w-80 h-full border-l border-white/5 bg-[#0f0f0f] z-20 shadow-xl flex flex-col shrink-0 overflow-hidden">
			<div className="flex items-center justify-between p-4 border-b border-white/5 bg-neutral-900/50">
				<div className="flex flex-col min-w-0">
					<span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider mb-0.5">
						Properties
					</span>
					<h2 className="text-sm font-semibold text-white truncate max-w-[200px]">
						{displayName}
					</h2>
				</div>
				<span className="text-[9px] bg-white/10 px-2 py-1 rounded text-gray-300 font-medium uppercase border border-white/5 tracking-wider">
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
								{(selectedLayer.type === "Image" ||
									selectedLayer.type === "Video") && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
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
													onClick={() => {
														if (selectedLayer.autoDimensions) {
															update({ autoDimensions: false });
														} else {
															let newW = selectedLayer.width;
															let newH = selectedLayer.height;
															const initialItem = initialLayersData.get(
																selectedLayer.id,
															);
															if (initialItem) {
																if (initialItem.type === "Video") {
																	const vvData =
																		initialItem.data as VirtualVideoData;
																	// Use active (post-operations) metadata for correct crop dimensions
																	const meta = getActiveVideoMetadata(vvData);
																	if (meta?.width) newW = meta.width;
																	if (meta?.height) newH = meta.height;
																} else if (initialItem.type === "Image") {
																	const meta = (initialItem.data as FileData)
																		.processData;
																	if (meta?.width) newW = meta.width;
																	if (meta?.height) newH = meta.height;
																}
															}
															update({
																autoDimensions: true,
																width: newW,
																height: newH,
															});
														}
													}}
												>
													<Sparkles className="w-3 h-3 mr-1" />
													Auto W/H
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												{hasCropDimensions
													? "Sync dimensions with cropped source media"
													: "Sync dimensions with source media"}
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
							</div>

							<div className="grid grid-cols-2 gap-2">
								<DraggableNumberInput
									label="X"
									value={Math.round(selectedLayer.x)}
									onChange={(v) => update({ x: v })}
								/>
								<DraggableNumberInput
									label="Y"
									value={Math.round(selectedLayer.y)}
									onChange={(v) => update({ y: v })}
								/>
							</div>

							{selectedLayer.type !== "Text" && (
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
													title={
														selectedLayer.lockAspect
															? "Unlock aspect ratio"
															: "Lock aspect ratio"
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
									value={Math.round(selectedLayer.rotation)}
									onChange={(v) => update({ rotation: v })}
								/>
								<DraggableNumberInput
									label="Scale"
									value={Number((selectedLayer.scale ?? 1).toFixed(2))}
									step={0.1}
									onChange={(v) => update({ scale: v })}
								/>
							</div>
						</div>
					)}

					{(selectedLayer.type === "Video" ||
						selectedLayer.type === "Audio") && (
						<CollapsibleSection title="Audio" icon={Music}>
							<div className="flex items-center gap-2">
								<span className="text-[9px] text-gray-500 w-8">Volume</span>
								<Slider
									className="flex-1"
									value={[(selectedLayer.volume ?? 1) * 100]}
									min={0}
									max={100}
									step={1}
									onValueChange={([v]) => update({ volume: v / 100 })}
								/>
								<span className="text-[9px] text-gray-400 w-6 text-right">
									{Math.round((selectedLayer.volume ?? 1) * 100)}%
								</span>
							</div>
						</CollapsibleSection>
					)}

					{selectedLayer.type === "Text" && (
						<TypographyControls
							fontFamily={selectedLayer.fontFamily ?? "Inter"}
							fontSize={selectedLayer.fontSize ?? 40}
							fill={selectedLayer.fill ?? "#fff"}
							fontStyle={selectedLayer.fontStyle ?? "normal"}
							textDecoration={selectedLayer.textDecoration ?? ""}
							fontWeight={selectedLayer.fontWeight?.toString()}
							align={selectedLayer.align as any}
							letterSpacing={selectedLayer.letterSpacing}
							lineHeight={selectedLayer.lineHeight}
							fontList={fontList as string[]}
							onChange={update}
						/>
					)}

					<StyleControls
						backgroundColor={selectedLayer.backgroundColor}
						stroke={
							selectedLayer.type === "Text"
								? selectedLayer.stroke
								: selectedLayer.borderColor
						}
						strokeWidth={
							selectedLayer.type === "Text"
								? selectedLayer.strokeWidth
								: selectedLayer.borderWidth
						}
						cornerRadius={selectedLayer.borderRadius}
						padding={selectedLayer.padding}
						opacity={selectedLayer.opacity}
						showBackground={
							selectedLayer.type === "Image" || selectedLayer.type === "Video"
						}
						showStroke={selectedLayer.type !== "Audio"}
						showCornerRadius={
							selectedLayer.type !== "Text" && selectedLayer.type !== "Audio"
						}
						showPadding={selectedLayer.type === "Text"}
						showOpacity={selectedLayer.type !== "Audio"}
						onChange={(updates) => {
							const mappedUpdates: any = { ...updates };
							if (updates.cornerRadius !== undefined) {
								mappedUpdates.borderRadius = updates.cornerRadius;
								delete mappedUpdates.cornerRadius;
							}
							if (selectedLayer.type !== "Text") {
								if (updates.stroke !== undefined)
									mappedUpdates.borderColor = updates.stroke;
								if (updates.strokeWidth !== undefined)
									mappedUpdates.borderWidth = updates.strokeWidth;
							}
							update(mappedUpdates);
						}}
					/>

					{selectedLayer.type !== "Audio" && (
						<div className="border-b border-white/5 p-4">
							<div className="flex items-center justify-between mb-3">
								<div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
									<Zap className="w-3.5 h-3.5" /> Animations
								</div>
							</div>
							<div className="space-y-3">
								{selectedLayer.animations?.map((anim) => (
									<div
										key={anim.id}
										className="bg-neutral-900 rounded-md p-3 border border-white/5 shadow-sm group hover:border-blue-500/30 transition-colors"
									>
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
												<span className="text-[11px] font-medium text-gray-200 capitalize">
													{anim.type.replace(/-/g, " ")}
												</span>
											</div>
											<Button
												variant="ghost"
												size="icon"
												className="h-5 w-5 hover:bg-red-500/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
												onClick={() => {
													updateLayers((prev) =>
														prev.map((l) =>
															l.id === selectedId
																? {
																		...l,
																		animations: l.animations?.filter(
																			(a) => a.id !== anim.id,
																		),
																	}
																: l,
														),
													);
												}}
											>
												<Trash2 className="w-3 h-3" />
											</Button>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-[9px] text-gray-500 w-8">
												Speed
											</span>
											<Slider
												className="flex-1"
												value={[anim.value]}
												min={0.1}
												max={3}
												step={0.1}
												onValueChange={([v]) => {
													updateLayers((prev) =>
														prev.map((l) =>
															l.id === selectedId
																? {
																		...l,
																		animations: l.animations?.map((a) =>
																			a.id === anim.id ? { ...a, value: v } : a,
																		),
																	}
																: l,
														),
													);
												}}
											/>
											<span className="text-[9px] text-gray-400 w-6 text-right">
												{anim.value.toFixed(1)}x
											</span>
										</div>
									</div>
								))}
								<Popover open={addAnimOpen} onOpenChange={setAddAnimOpen}>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="w-full h-9 text-xs border-dashed border-white/20 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white"
										>
											<Plus className="w-3.5 h-3.5 mr-1.5" /> Add Animation
										</Button>
									</PopoverTrigger>
									<PopoverContent
										side="left"
										align="start"
										className="bg-[#1a1a1a] border-white/10 w-80 p-3"
									>
										<div className="space-y-4">
											{animationCategories.map((category, idx) => (
												<div key={category.label}>
													{idx > 0 && <div className="h-px bg-white/5 mb-3" />}
													<div className="flex items-center gap-1.5 mb-2">
														<div
															className={`w-1.5 h-1.5 rounded-full ${category.color.replace("text-", "bg-")}`}
														/>
														<span
															className={`text-[9px] font-bold uppercase tracking-wider ${category.color}`}
														>
															{category.label}
														</span>
													</div>
													<div className="grid grid-cols-3 gap-1">
														{category.animations.map((anim) => {
															const AnimIcon = anim.icon;
															return (
																<button
																	key={anim.type}
																	type="button"
																	className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/10 transition-colors group"
																	onClick={() => addAnimation(anim.type)}
																>
																	<div className="w-8 h-8 rounded-md bg-neutral-800 border border-white/5 flex items-center justify-center group-hover:border-white/20 transition-colors">
																		<AnimIcon className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
																	</div>
																	<span className="text-[9px] text-gray-400 group-hover:text-white font-medium transition-colors">
																		{anim.label}
																	</span>
																</button>
															);
														})}
													</div>
												</div>
											))}
										</div>
									</PopoverContent>
								</Popover>
							</div>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
};

// --- Main Editor ---
interface VideoDesignerEditorProps {
	initialLayers: Map<string, OutputItem<"Text" | "Image" | "Video" | "Audio">>;
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
	const nodeConfig = node.config as unknown as VideoCompositorNodeConfig;

	const handles = useAppSelector(handleSelectors.selectEntities);
	const [layers, setLayers] = useState<EditorLayer[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isDirty, setIsDirty] = useState(false);

	const roundToEven = useCallback(
		(num?: number) => Math.round((num ?? 0) / 2) * 2,
		[],
	);
	const [viewportWidth, setViewportWidth] = useState(
		roundToEven(nodeConfig.width ?? 1280),
	);
	const [viewportHeight, setViewportHeight] = useState(
		roundToEven(nodeConfig.height) || 720,
	);
	const [zoom, setZoom] = useState(0.5);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [mode, setMode] = useState<"select" | "pan">("select");
	const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_HEIGHT);

	const [currentFrame, setCurrentFrame] = useState(0);
	const [isPlaying, setIsPlayingState] = useState(false);
	const playerRef = useRef<PlayerRef>(null);

	const containerRef = useRef<HTMLDivElement>(null);
	const timeRef = useRef<HTMLDivElement>(null);
	const lastModeRef = useRef<"select" | "pan">("select");
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
	const [sizeKnown, setSizeKnown] = useState(false);

	const updateViewportWidth = useCallback(
		(w: number) => {
			setViewportWidth(roundToEven(Math.max(2, w)));
			setIsDirty(true);
		},
		[roundToEven],
	);

	const updateViewportHeight = useCallback(
		(h: number) => {
			setViewportHeight(roundToEven(Math.max(2, h)));
			setIsDirty(true);
		},
		[roundToEven],
	);

	const getTextData = useCallback(
		(id: string) => {
			const item = initialLayers.get(id);
			if (item?.type === "Text") {
				return (item as OutputItem<"Text">).data || "Text";
			}
			return "";
		},
		[initialLayers],
	);

	const getAssetUrl = useCallback(
		(id: string) => {
			const item = initialLayers.get(id);
			if (!item) return undefined;
			if (item.type === "Video") {
				return resolveVideoSourceUrl(item.data as VirtualVideoData);
			}
			const fileData = item.data as FileData;
			if (fileData.entity?.id) {
				return GetAssetEndpoint(fileData.entity);
			}
			return fileData?.processData?.dataUrl;
		},
		[initialLayers],
	);

	const getMediaDuration = useCallback(
		(id: string | undefined | null) => {
			if (!id) return undefined;
			const item = initialLayers.get(id);
			if (!item) return undefined;
			if (item.type === "Video") {
				const vv = item.data as VirtualVideoData;
				return vv.sourceMeta?.durationMs;
			}
			const fileData = item.data as FileData;
			return fileData.entity?.duration ?? fileData?.processData?.duration;
		},
		[initialLayers],
	);

	const updateLayersHandler = useCallback(
		(updater: SetStateAction<EditorLayer[]>, isUserChange: boolean = true) => {
			setLayers(updater);
			if (isUserChange) setIsDirty(true);
		},
		[],
	);

	const deleteLayer = useCallback(
		(id: string) => {
			setLayers((prev) => prev.filter((l) => l.id !== id));
			if (selectedId === id) setSelectedId(null);
			setIsDirty(true);
		},
		[selectedId],
	);

	const timelineScrollRef = useRef<HTMLDivElement>(null);

	const setIsPlaying = useCallback((p: boolean) => {
		setIsPlayingState(p);
		if (p) playerRef.current?.play();
		else {
			playerRef.current?.pause();
			if (playerRef.current) {
				setCurrentFrame(playerRef.current.getCurrentFrame());
			}
		}
	}, []);

	const handlePlaybackEnded = useCallback(() => {
		setIsPlayingState(false);
		setCurrentFrame(0);
		playerRef.current?.seekTo(0);
		if (timelineScrollRef.current) {
			timelineScrollRef.current.scrollLeft = 0;
		}
	}, []);

	const setCurrentFrameHandler = useCallback((frame: number) => {
		setCurrentFrame(frame);
		playerRef.current?.seekTo(frame);
	}, []);

	// -----------------------------------------------------------------------
	// Layer initialisation
	// -----------------------------------------------------------------------
	useEffect(() => {
		const loadInitialLayers = async () => {
			const layerUpdates = { ...nodeConfig.layerUpdates };
			const loaded: EditorLayer[] = [];
			const fontPromises: Promise<void>[] = [];
			let maxZ = Math.max(
				0,
				...Object.values(layerUpdates).map((l) => l.zIndex ?? 0),
			);

			initialLayers.forEach((item, id) => {
				const saved = layerUpdates[id] as EditorLayer | undefined;
				const isAutoDimensions = saved?.autoDimensions ?? true;

				let durationMs = 0;
				let text: string | undefined;
				let src: string | undefined;
				let virtualVideo: VirtualVideoData | undefined;
				let layerWidth = saved?.width;
				let layerHeight = saved?.height;

				// Crop rendering props — populated only for Video layers with crop ops
				let cropRenderProps: ReturnType<typeof computeVideoCropRenderProps> =
					null;

				if (item.type === "Text") {
					text = getTextData(id);
				} else if (item.type === "Video") {
					virtualVideo = item.data as VirtualVideoData;
					const metadata = getActiveVideoMetadata(virtualVideo);
					durationMs = metadata.durationMs ?? 0;
					src = resolveVideoSourceUrl(virtualVideo);

					// Compute crop rendering parameters from the operation stack
					cropRenderProps = computeVideoCropRenderProps(virtualVideo);

					if (isAutoDimensions) {
						// Use post-operations (possibly cropped) metadata dimensions
						layerWidth = metadata.width;
						layerHeight = metadata.height;
					} else {
						layerWidth = layerWidth ?? metadata.width;
						layerHeight = layerHeight ?? metadata.height;
					}
				} else if (item.type === "Image" || item.type === "Audio") {
					const fileData = item.data as FileData;
					durationMs =
						fileData.entity?.duration ?? fileData.processData?.duration ?? 0;
					src = getAssetUrl(id);

					if (isAutoDimensions && fileData.processData) {
						layerWidth = fileData.processData.width;
						layerHeight = fileData.processData.height;
					} else {
						layerWidth = layerWidth ?? fileData.processData?.width;
						layerHeight = layerHeight ?? fileData.processData?.height;
					}
				}

				const calculatedDurationFrames =
					(item.type === "Video" || item.type === "Audio") && durationMs > 0
						? Math.ceil((durationMs / 1000) * FPS)
						: DEFAULT_DURATION_FRAMES;
				const handle = handles[id];
				const name = handle?.label ?? handle?.dataTypes?.[0] ?? id;

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
					durationInFrames: saved?.durationInFrames ?? calculatedDurationFrames,
					volume: 1,
					animations: saved?.animations ?? [],
					...saved,
					src,
					text,
					name,
					virtualVideo,
					autoDimensions: isAutoDimensions,
					// Spread crop render props if present (undefined otherwise)
					...(cropRenderProps ?? {}),
				};

				if (item.type === "Text") {
					const fontFamily = saved?.fontFamily ?? "Inter";
					loaded.push({
						...base,
						type: "Text",
						fontSize: saved?.fontSize ?? 60,
						fontFamily,
						fontStyle: saved?.fontStyle ?? "normal",
						textDecoration: saved?.textDecoration ?? "",
						fill: saved?.fill ?? "#ffffff",
						width: layerWidth,
						height: layerHeight,
						lockAspect: true,
						autoDimensions: false, // Text dimensions are measured dynamically
					} as EditorLayer);
					const fontUrl = GetFontAssetUrl(fontFamily);
					if (fontUrl) {
						fontPromises.push(fontManager.loadFont(fontFamily, fontUrl));
					}
				} else if (item.type === "Image" || item.type === "Video") {
					loaded.push({
						...base,
						type: item.type as "Image" | "Video",
						width: layerWidth,
						height: layerHeight,
						maxDurationInFrames:
							item.type === "Video" && durationMs > 0
								? calculatedDurationFrames
								: undefined,
						lockAspect: true,
					} as EditorLayer);
				} else if (item.type === "Audio") {
					loaded.push({
						...base,
						type: "Audio",
						height: 0,
						width: 0,
						maxDurationInFrames:
							durationMs > 0 ? calculatedDurationFrames : undefined,
						lockAspect: true,
					} as EditorLayer);
				}
			});

			await Promise.all(fontPromises);
			setLayers(loaded);
		};

		loadInitialLayers();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialLayers, nodeConfig]);

	// -----------------------------------------------------------------------
	// Measurement effect — derives pixel dimensions for layers that need it.
	//
	// Key invariants:
	//   1. Video layers with virtualVideo → use getActiveVideoMetadata (already
	//      reflects crop), never touch the DOM video element.
	//   2. Image layers with autoDimensions → decode the image element.
	//   3. Text layers → always re-measure because the rendered size depends on
	//      font metrics that may change.
	//   4. We compare old vs new values before calling setLayers to avoid
	//      spurious re-renders / infinite loops.
	//
	// The effect depends on a stable "signature" key derived from each layer's
	// measurement-relevant properties so it only re-runs when something that
	// actually affects dimensions changes.
	// -----------------------------------------------------------------------

	// Stable signature: only re-run measurement when these properties change
	const measurementSignature = useMemo(() => {
		return layers
			.filter((l) => l.type !== "Audio" && !l.isPlaceholder)
			.map((l) => {
				if (l.type === "Text") {
					// Re-measure when text content or typography changes
					return `${l.id}:text:${l.fontFamily}:${l.fontSize}:${l.fontStyle}:${l.textDecoration}:${l.lineHeight}`;
				}
				if (l.type === "Video" && l.virtualVideo) {
					// Operations are stable after load; re-measure if autoDimensions flips
					return `${l.id}:video:${l.autoDimensions}:${l.virtualVideo.operation.op}`;
				}
				// Image: re-measure if autoDimensions is on or dims are missing
				return `${l.id}:${l.type}:${l.autoDimensions}:${l.width ?? "null"}:${l.height ?? "null"}`;
			})
			.join("|");
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		// Deliberately not including the full `layers` array — we only want to
		// recompute the signature when specific measurement-relevant fields change.
		// Using a derived string keeps the dep stable across unrelated layer updates.
		layers
			.map(
				(l) =>
					`${l.id}:${l.type}:${l.autoDimensions}:${l.width}:${l.height}:${l.fontFamily}:${l.fontSize}:${l.fontStyle}:${l.textDecoration}:${l.lineHeight}:${(l as any).virtualVideo?.operation?.op ?? "none"}`,
			)
			.join("|"),
	]);

	useEffect(() => {
		const layersToMeasure = layers.filter(
			(l) =>
				l.type !== "Audio" &&
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
						if (layer.type === "Video" && layer.virtualVideo) {
							// Virtual video: always derive dimensions from the operation
							// metadata so crop dimensions are respected correctly.
							const metadata = getActiveVideoMetadata(layer.virtualVideo);
							const newW = metadata.width;
							const newH = metadata.height;

							if (
								newW != null &&
								newH != null &&
								(layer.width !== newW || layer.height !== newH)
							) {
								updates.set(layer.id, { width: newW, height: newH });
							}
							return;
						}

						const url = getAssetUrl(layer.inputHandleId);

						if (layer.type === "Image" && url) {
							const img = new Image();
							img.src = url;
							await img.decode();
							if (
								layer.width !== img.naturalWidth ||
								layer.height !== img.naturalHeight
							) {
								updates.set(layer.id, {
									width: img.naturalWidth,
									height: img.naturalHeight,
								});
							}
						} else if (layer.type === "Video" && url) {
							// Plain (non-virtual) video — measure from DOM element
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
							const textContent = getTextData(layer.inputHandleId);
							const d = document.createElement("div");
							d.style.fontFamily = layer.fontFamily || "Inter";
							d.style.fontSize = `${layer.fontSize || 40}px`;
							d.style.fontStyle = layer.fontStyle || "normal";
							d.style.textDecoration = layer.textDecoration || "";
							d.style.lineHeight = `${layer.lineHeight ?? 1.2}`;
							d.style.position = "absolute";
							d.style.visibility = "hidden";
							d.style.whiteSpace = "pre";
							d.textContent = textContent;
							document.body.appendChild(d);
							const newW = d.offsetWidth;
							const newH = d.offsetHeight;
							document.body.removeChild(d);

							if (
								Math.abs((layer.width ?? 0) - newW) > 1 ||
								Math.abs((layer.height ?? 0) - newH) > 1
							) {
								updates.set(layer.id, { width: newW, height: newH });
							}
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

			if (mounted && updates.size > 0) {
				setLayers((prev) =>
					prev.map((l) =>
						updates.has(l.id) ? { ...l, ...updates.get(l.id) } : l,
					),
				);
			}
		};

		measure();
		return () => {
			mounted = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [measurementSignature, getAssetUrl, getTextData]);

	const zoomIn = useCallback(() => setZoom((z) => Math.min(3, z + 0.1)), []);
	const zoomOut = useCallback(() => setZoom((z) => Math.max(0.1, z - 0.1)), []);
	const zoomTo = useCallback((val: number) => setZoom(val), []);

	const fitView = useCallback(() => {
		if (containerSize.width === 0 || containerSize.height === 0) return;
		const scale =
			Math.min(
				containerSize.width / viewportWidth,
				containerSize.height / viewportHeight,
			) * 0.9;
		setZoom(scale);
		const x = (containerSize.width - viewportWidth * scale) / 2;
		const y = (containerSize.height - viewportHeight * scale) / 2;
		setPan({ x, y });
	}, [containerSize, viewportWidth, viewportHeight]);

	useEffect(() => {
		fitView();
	}, [viewportWidth, viewportHeight, fitView]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver((entries) => {
			const { width, height } = entries[0].contentRect;
			setContainerSize({ width, height });
		});
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
				const zoomSensitivity = 0.003;
				const delta = -e.deltaY * zoomSensitivity;
				const newZoom = Math.min(Math.max(zoom * Math.exp(delta), 0.1), 5);
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

			if (e.shiftKey) {
				if (dy !== 0 && dx === 0) {
					dx = dy;
					dy = 0;
				}
			}

			setPan((p) => ({
				...p,
				x: p.x - dx,
				y: p.y - dy,
			}));
		};
		el.addEventListener("wheel", handleWheel, { passive: false });
		return () => el.removeEventListener("wheel", handleWheel);
	}, [zoom, pan, mode]);

	useHotkeys("v", () => setMode("select"));
	useHotkeys("h", () => setMode("pan"));
	useHotkeys("=", () => zoomIn());
	useHotkeys("+", () => zoomIn());
	useHotkeys("-", () => zoomOut());
	useHotkeys("0", () => fitView());
	useHotkeys("1", () => zoomTo(1));
	useHotkeys("escape", () => setSelectedId(null));
	useHotkeys("delete, backspace", () => {
		if (selectedId) deleteLayer(selectedId);
	});
	useHotkeys(
		"space",
		(e) => {
			const isInput =
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA";
			if (isInput) return;
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
		(e) => {
			const isInput =
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA";
			if (isInput) return;
			e.preventDefault();
			setMode(lastModeRef.current);
		},
		{ keyup: true },
	);
	useHotkeys(
		"meta+s, ctrl+s",
		(e) => {
			e.preventDefault();
			if (isDirty) {
				const layerUpdates = layers.reduce<
					Record<
						string,
						Omit<
							EditorLayer,
							"src" | "text" | "isPlaceholder" | "maxDurationInFrames"
						>
					>
				>((acc, layer) => {
					const {
						src,
						text,
						isPlaceholder,
						maxDurationInFrames,
						...savedLayer
					} = layer;
					acc[layer.id] = savedLayer;
					return acc;
				}, {});
				onSave({
					layerUpdates: layerUpdates as any,
					width: viewportWidth,
					FPS: FPS,
					height: viewportHeight,
				});
				setIsDirty(false);
			}
		},
		{ enableOnFormTags: true },
	);

	const durationInFrames = useMemo(() => {
		if (layers.length === 0) return DEFAULT_DURATION_FRAMES;
		return Math.max(
			DEFAULT_DURATION_FRAMES,
			...layers.map(
				(l) =>
					(l.startFrame ?? 0) + (l.durationInFrames ?? DEFAULT_DURATION_FRAMES),
			),
		);
	}, [layers]);

	const contextValue = useMemo(
		() => ({
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
			fps: FPS,
			durationInFrames,
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
		}),
		[
			layers,
			selectedId,
			viewportWidth,
			viewportHeight,
			updateViewportWidth,
			updateViewportHeight,
			currentFrame,
			isPlaying,
			zoom,
			pan,
			mode,
			isDirty,
			durationInFrames,
			updateLayersHandler,
			deleteLayer,
			getTextData,
			getAssetUrl,
			getMediaDuration,
			setCurrentFrameHandler,
			setIsPlaying,
			zoomIn,
			zoomOut,
			zoomTo,
			fitView,
			timelineHeight,
			initialLayers,
		],
	);

	useEffect(() => {
		playerRef.current?.seekTo(0);
		const player = playerRef.current;
		if (player) {
			player.addEventListener("ended", handlePlaybackEnded);
			return () => {
				player.removeEventListener("ended", handlePlaybackEnded);
			};
		}
	}, [handlePlaybackEnded]);

	return (
		<EditorContext.Provider value={contextValue}>
			<div className="flex flex-col h-screen w-full bg-[#050505] text-gray-100 overflow-hidden font-sans select-none">
				<div className="flex flex-1 min-h-0 relative overflow-hidden">
					<div
						ref={containerRef}
						className="flex-1 relative overflow-hidden"
						onMouseDown={() => setSelectedId(null)}
						style={{
							backgroundColor: "#1a1a1a",
							backgroundImage:
								"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)",
							backgroundSize: "24px 24px",
						}}
						role="button"
						tabIndex={0}
						onKeyDown={() => {}}
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
								className="shadow-[0_0_100px_rgba(0,0,0,0.9)] media-container relative bg-[#0a0a0a] ring-2 ring-white/15 rounded-sm"
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
									}}
									acknowledgeRemotionLicense
									durationInFrames={durationInFrames}
									fps={FPS}
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
						<Toolbar
							onClose={onClose}
							onSave={() => {
								const layerUpdates = layers.reduce<
									Record<
										string,
										Omit<
											EditorLayer,
											"src" | "text" | "isPlaceholder" | "maxDurationInFrames"
										>
									>
								>((acc, layer) => {
									const {
										src,
										text,
										isPlaceholder,
										maxDurationInFrames,
										...savedLayer
									} = layer;
									acc[layer.id] = savedLayer;
									return acc;
								}, {});
								onSave({
									layerUpdates,
									width: viewportWidth,
									height: viewportHeight,
								});
								setIsDirty(false);
							}}
							timeRef={timeRef}
						/>
					</div>
				</div>
				<TimelinePanel />
			</div>
		</EditorContext.Provider>
	);
};
