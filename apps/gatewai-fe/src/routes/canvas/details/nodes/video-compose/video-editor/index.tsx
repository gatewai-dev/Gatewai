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
import type {
	CompositorNodeConfig,
	FileData,
	OutputItem,
	VideoCompositorLayer,
} from "@gatewai/types";
import { Video } from "@remotion/media";
import { Player, type PlayerRef } from "@remotion/player";
import {
	ChevronDown,
	Film,
	GripVertical,
	Hand,
	Image as ImageIcon,
	Layers,
	Minus,
	MousePointer,
	Move,
	MoveHorizontal,
	MoveVertical,
	Music,
	Pause,
	Play,
	Plus,
	RotateCw,
	Trash2,
	Type,
	XIcon,
	Zap,
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
import {
	AbsoluteFill,
	Html5Audio,
	Img,
	interpolate,
	Sequence,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { Button } from "@/components/ui/button";
import { DraggableNumberInput } from "@/components/ui/draggable-number-input";
import { Label } from "@/components/ui/label";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "@/components/ui/menubar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColorInput } from "@/components/util/color-input";
import { useGetFontListQuery } from "@/store/fonts";
import { GetAssetEndpoint, GetFontAssetUrl } from "@/utils/file";

// --- Types & Schemas ---

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

// Fixed Interface: Removed conflicts and clarified optionality
interface ExtendedLayer extends Omit<VideoCompositorLayer, "width" | "height"> {
	width?: number;
	height?: number;
	animations?: VideoAnimation[];
	maxDurationInFrames?: number;
	// Helper for runtime logic
	isPlaceholder?: boolean;
}

interface EditorContextType {
	// State
	layers: ExtendedLayer[];
	updateLayers: (
		updater: SetStateAction<ExtendedLayer[]>,
		isUserChange?: boolean,
	) => void;
	deleteLayer: (id: string) => void;
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;
	// Data Getters
	getTextData: (id: string) => string;
	getAssetUrl: (id: string) => string | undefined;
	// Canvas
	viewportWidth: number;
	viewportHeight: number;
	updateViewportWidth: (w: number) => void;
	updateViewportHeight: (h: number) => void;
	// Playback
	fps: number;
	durationInFrames: number;
	currentFrame: number;
	setCurrentFrame: (frame: number) => void;
	isPlaying: boolean;
	setIsPlaying: (playing: boolean) => void;
	playerRef: React.RefObject<PlayerRef>;
	// View Transform
	zoom: number;
	setZoom: Dispatch<SetStateAction<number>>;
	pan: { x: number; y: number };
	setPan: Dispatch<SetStateAction<{ x: number; y: number }>>;
	zoomIn: () => void;
	zoomOut: () => void;
	zoomTo: (val: number) => void;
	fitView: () => void;
	// Mode
	mode: "select" | "pan";
	setMode: Dispatch<SetStateAction<"select" | "pan">>;
	// System
	isDirty: boolean;
	setIsDirty: Dispatch<SetStateAction<boolean>>;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

const useEditor = () => {
	const ctx = useContext(EditorContext);
	if (!ctx) throw new Error("useEditor must be used within EditorProvider");
	return ctx;
};

// --- Constants ---
const FPS = 24;
const DEFAULT_DURATION_SEC = 5;
const DEFAULT_DURATION_FRAMES = FPS * DEFAULT_DURATION_SEC;
const RULER_HEIGHT = 32;
const TRACK_HEIGHT = 36;
const HEADER_WIDTH = 260;

// --- Helpers ---

/**
 * Lazily injects a font face definition.
 * Does NOT block or wait for the font to load (Fixes "Do not pre-load" constraint).
 */
const injectFontFace = (family: string, url: string) => {
	if (!family || !url) return;
	const fontId = `font-${family.replace(/\s+/g, "-").toLowerCase()}`;
	if (document.getElementById(fontId)) return;

	const style = document.createElement("style");
	style.id = fontId;
	style.innerHTML = `
      @font-face {
        font-family: "${family}";
        src: url("${url}");
        font-display: swap; 
      }
    `;
	document.head.appendChild(style);
};

// Extracted animation logic for purity and performance
const calculateLayerTransform = (
	layer: ExtendedLayer,
	frame: number,
	fps: number,
	viewport: { w: number; h: number },
) => {
	const relativeFrame = frame - layer.startFrame;
	let x = layer.x;
	let y = layer.y;
	let scale = layer.scale;
	let rotation = layer.rotation;
	let opacity = layer.opacity;
	const volume = layer.volume ?? 1;

	const animations = layer.animations ?? [];
	if (animations.length === 0)
		return { x, y, scale, rotation, opacity, volume };

	animations.forEach((anim) => {
		const durFrames = anim.value * fps;
		const isOut = anim.type.includes("-out");
		const startAnimFrame = isOut ? layer.durationInFrames - durFrames : 0;
		const endAnimFrame = isOut ? layer.durationInFrames : durFrames;

		if (relativeFrame < startAnimFrame || relativeFrame > endAnimFrame) {
			// If we are past the animation, ensure final state is correct for "entry" animations
			if (!isOut && relativeFrame > endAnimFrame) {
				// Entry animations usually end at neutral state, so no op needed unless specific logic
			}
			return;
		}

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

// --- Remotion Scene ---
const CompositionScene: React.FC<{
	layers: ExtendedLayer[];
}> = ({ layers }) => {
	const { getTextData, getAssetUrl, viewportWidth, viewportHeight } =
		useEditor();
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Sort by zIndex for rendering order
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000000" }}>
			{sortedLayers.map((layer) => {
				// Optimization: Do not render if out of frame bounds
				const endFrame = layer.startFrame + layer.durationInFrames;
				if (frame < layer.startFrame || frame >= endFrame) return null;

				const src = getAssetUrl(layer.inputHandleId);
				const textContent = getTextData(layer.inputHandleId);

				const {
					x: animX,
					y: animY,
					scale: animScale,
					rotation: animRotation,
					opacity: animOpacity,
					volume: animVolume,
				} = calculateLayerTransform(layer, frame, fps, {
					w: viewportWidth,
					h: viewportHeight,
				});

				const style: React.CSSProperties = {
					position: "absolute",
					left: animX,
					top: animY,
					width: layer.width,
					height: layer.height,
					transform: `rotate(${animRotation}deg) scale(${animScale})`,
					opacity: animOpacity,
					textAlign: layer.align,
				};

				return (
					<Sequence
						key={layer.id}
						from={layer.startFrame}
						durationInFrames={layer.durationInFrames}
						layout="none" // Important for absolute positioning control
					>
						{layer.type === "Video" && src && (
							<Video src={src} style={{ ...style }} volume={animVolume} />
						)}
						{layer.type === "Image" && src && (
							<Img src={src} style={{ ...style, objectFit: "cover" }} />
						)}
						{layer.type === "Audio" && src && (
							<Html5Audio src={src} volume={animVolume} />
						)}
						{layer.type === "Text" && (
							<div
								style={{
									...style,
									color: layer.fill,
									fontSize: layer.fontSize,
									fontFamily: layer.fontFamily,
									lineHeight: layer.lineHeight ?? 1.2,
									whiteSpace: "pre",
								}}
							>
								{textContent}
							</div>
						)}
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

// --- Components: Interaction Overlay ---
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
		"tl" | "tr" | "bl" | "br" | null
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
					currentFrame >= l.startFrame &&
					currentFrame < l.startFrame + l.durationInFrames,
			)
			.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)); // Render order
	}, [layers, currentFrame]);

	const handleMouseDown = (
		e: React.MouseEvent,
		layerId?: string,
		anchor?: "tl" | "tr" | "bl" | "br",
	) => {
		// Middle mouse or Spacebar mode = Pan
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
			scale: layer.scale,
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
		}); // Snapshot
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
			const theta = initialPos.rotation * (Math.PI / 180);
			const cos = Math.cos(theta);
			const sin = Math.sin(theta);

			// Transform screen delta to local object space
			let localDx = cos * dx + sin * dy;
			let localDy = -sin * dx + cos * dy;

			localDx /= initialPos.scale;
			localDy /= initialPos.scale;

			const signW = resizeAnchor.includes("l") ? -1 : 1;
			const signH = resizeAnchor.includes("t") ? -1 : 1;

			let changeW = signW * localDx;
			let changeH = signH * localDy;

			// Aspect ratio lock for media
			const layer = layers.find((l) => l.id === selectedId);
			if (layer && (layer.type === "Image" || layer.type === "Video")) {
				const ratio = initialPos.height / initialPos.width || 1;
				if (Math.abs(changeW) * ratio > Math.abs(changeH)) {
					changeH = changeW * ratio;
				} else {
					changeW = changeH / ratio;
				}
			}

			// Recalculate based on locked changes
			localDx = signW * changeW;
			localDy = signH * changeH;

			const newWidth = Math.max(10, initialPos.width + changeW);
			const newHeight = Math.max(10, initialPos.height + changeH);

			// Adjust position to keep opposite anchor stationary
			const worldDx = cos * localDx - sin * localDy;
			const worldDy = sin * localDx + cos * localDy;

			const newX = resizeAnchor.includes("l")
				? initialPos.x + worldDx
				: initialPos.x;
			const newY = resizeAnchor.includes("t")
				? initialPos.y + worldDy
				: initialPos.y;

			updateLayers((prev) =>
				prev.map((l) =>
					l.id === selectedId
						? {
								...l,
								width: Math.round(newWidth),
								height: Math.round(newHeight),
								x: Math.round(newX),
								y: Math.round(newY),
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
			style={{ cursor: isPanning ? "grabbing" : "default" }}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onMouseDown={(e) => handleMouseDown(e)}
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
					<div
						key={layer.id}
						role="button"
						tabIndex={0}
						onMouseDown={(e) => handleMouseDown(e, layer.id)}
						className={`absolute group outline-none select-none ${
							selectedId === layer.id ? "z-50" : "z-auto"
						}`}
						style={{
							left: layer.x,
							top: layer.y,
							width: layer.width,
							height: layer.height,
							transform: `rotate(${layer.rotation}deg) scale(${layer.scale})`,
						}}
					>
						{/* Selection Border */}
						<div
							className={`absolute inset-0 pointer-events-none transition-colors duration-150 ${
								selectedId === layer.id
									? "border-[1.5px] border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]"
									: "border border-transparent group-hover:border-blue-400/50"
							}`}
						/>

						{/* Controls (Only if selected) */}
						{selectedId === layer.id && (
							<>
								{/* Resize Handles */}
								{layer.type !== "Text" && (
									<>
										{["tl", "tr", "bl", "br"].map((pos) => (
											<div
												key={pos}
												className={`absolute w-2.5 h-2.5 bg-white border border-blue-600 rounded-full shadow-sm z-50 transition-transform hover:scale-125
                      ${pos === "tl" ? "-top-1.5 -left-1.5 cursor-nwse-resize" : ""}
                      ${pos === "tr" ? "-top-1.5 -right-1.5 cursor-nesw-resize" : ""}
                      ${pos === "bl" ? "-bottom-1.5 -left-1.5 cursor-nesw-resize" : ""}
                      ${pos === "br" ? "-bottom-1.5 -right-1.5 cursor-nwse-resize" : ""}
                    `}
												onMouseDown={(e) =>
													handleMouseDown(
														e,
														layer.id,
														pos as "tl" | "tr" | "bl" | "br",
													)
												}
											/>
										))}
									</>
								)}
								{/* Rotation Handle */}
								<div
									className="absolute -top-4 left-1/2 -translate-x-1/2 h-4 w-px bg-blue-500"
									style={{ transform: `scaleX(${1 / zoom})` }}
								/>
								<div
									className="absolute -top-6 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border border-blue-600 rounded-full shadow-sm cursor-grab active:cursor-grabbing hover:scale-110"
									onMouseDown={(e) => handleRotateStart(e, layer.id)}
								/>
							</>
						)}
					</div>
				))}
			</div>
		</div>
	);
};

// --- Toolbar ---
const Toolbar = React.memo<{
	onClose: () => void;
	onSave: () => void;
	timeRef: React.RefObject<HTMLDivElement>;
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

	const handlePlayPause = useCallback(() => {
		if (playerRef.current) {
			if (isPlaying) playerRef.current.pause();
			else playerRef.current.play();
			setIsPlaying(!isPlaying);
		}
	}, [isPlaying, setIsPlaying, playerRef]);

	return (
		<div className="flex items-center gap-1.5 p-1.5 rounded-full bg-neutral-900/90 backdrop-blur-xl border border-white/10 shadow-2xl z-50">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className={`rounded-full w-8 h-8 ${isPlaying ? "bg-red-500/10 text-red-400" : "hover:bg-white/10 text-white"}`}
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
			</TooltipProvider>

			<div className="w-px h-4 bg-white/10 mx-0.5" />
			<div
				ref={timeRef}
				className="text-[10px] font-mono tabular-nums text-neutral-400 min-w-[60px] text-center select-none"
			>
				{/* Initial content to avoid layout shift */}
				{Math.floor(currentFrame / fps)}s :{" "}
				{(currentFrame % fps).toString().padStart(2, "0")}f
			</div>
			<div className="w-px h-4 bg-white/10 mx-0.5" />

			<div className="flex bg-white/5 rounded-full p-0.5">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={mode === "select" ? "default" : "ghost"}
							size="icon"
							className={`rounded-full w-7 h-7`}
							onClick={() => setMode("select")}
						>
							<MousePointer className="w-3.5 h-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Select Tool</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={mode === "pan" ? "default" : "ghost"}
							size="icon"
							className={`rounded-full w-7 h-7`}
							onClick={() => setMode("pan")}
						>
							<Hand className="w-3.5 h-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Pan Tool</TooltipContent>
				</Tooltip>
			</div>

			<Menubar className="border-none bg-transparent h-auto p-0">
				<MenubarMenu>
					<MenubarTrigger asChild>
						<Button
							variant="ghost"
							className="h-8 px-2.5 text-[10px] rounded-full text-gray-300 hover:text-white hover:bg-white/10 font-medium"
						>
							{Math.round(zoom * 100)}%{" "}
							<ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
						</Button>
					</MenubarTrigger>
					<MenubarContent
						align="center"
						className="min-w-[140px] bg-neutral-900/95 backdrop-blur-xl border-white/10 text-gray-200"
					>
						<MenubarItem onClick={zoomIn}>Zoom In</MenubarItem>
						<MenubarItem onClick={zoomOut}>Zoom Out</MenubarItem>
						<MenubarItem onClick={() => zoomTo(1)}>Actual Size</MenubarItem>
						<MenubarItem onClick={fitView}>Fit to Screen</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>

			<div className="w-px h-4 bg-white/10 mx-0.5" />
			<div className="flex items-center gap-1">
				<Button
					size="sm"
					className="h-7 text-[11px] font-medium rounded-full px-3  border-0"
					onClick={onSave}
					disabled={!isDirty}
				>
					Save
				</Button>
				<Button
					size="xs"
					variant="ghost"
					className="h-7 text-[11px] rounded-full w-7 text-gray-400 hover:text-red-400 hover:text-white hover:bg-white/10"
					onClick={onClose}
				>
					<XIcon />
				</Button>
			</div>
		</div>
	);
});

// --- Timeline Panel ---
interface SortableTrackProps {
	layer: ExtendedLayer;
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

	return (
		<div
			ref={setNodeRef}
			style={style}
			role="button"
			tabIndex={0}
			className={`
        border-b border-white/5 flex items-center pl-3 pr-2 text-xs gap-3 group outline-none transition-colors
        ${isSelected ? "bg-blue-500/10 text-blue-100" : "hover:bg-white/5 text-gray-400"}
        ${isDragging ? "opacity-50 bg-neutral-900" : ""}
      `}
			onClick={onSelect}
		>
			<div
				{...attributes}
				{...listeners}
				className="cursor-grab active:cursor-grabbing p-1 text-gray-600 hover:text-gray-300 transition-colors"
			>
				<GripVertical className="h-3 w-3" />
			</div>
			<div className="flex-1 flex items-center gap-2 min-w-0">
				{layer.type === "Video" && (
					<Film className="w-3.5 h-3.5 text-blue-400" />
				)}
				{layer.type === "Image" && (
					<ImageIcon className="w-3.5 h-3.5 text-purple-400" />
				)}
				{layer.type === "Text" && (
					<Type className="w-3.5 h-3.5 text-green-400" />
				)}
				{layer.type === "Audio" && (
					<Music className="w-3.5 h-3.5 text-orange-400" />
				)}
				<span className="truncate font-medium text-[11px]">
					{layer.name || layer.id}
				</span>
			</div>
			{layer.animations && layer.animations.length > 0 && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger>
							<Zap className="w-3 h-3 text-amber-400" />
						</TooltipTrigger>
						<TooltipContent>Has Animations</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}
		</div>
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
	} = useEditor();

	const playheadRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	const [isPanningTimeline, setIsPanningTimeline] = useState(false);
	const [dragStartX, setDragStartX] = useState(0);
	const [initialScroll, setInitialScroll] = useState(0);
	const [pixelsPerFrame, setPixelsPerFrame] = useState(6);

	// Memoize sorting for the list
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
			// Reassign zIndices based on new array order (Top of list = highest Z)
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

	// Optimize the playhead loop
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

	const handleClipManipulation = (
		e: React.MouseEvent,
		layerId: string,
		type: "move" | "trim",
	) => {
		e.stopPropagation();
		const startX = e.clientX;
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;

		const initialStart = layer.startFrame;
		const initialDuration = layer.durationInFrames;

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

	return (
		<div className="h-56 flex flex-col border-t border-white/10 bg-[#0f0f0f] shrink-0 select-none z-30">
			{/* Toolbar */}
			<div className="h-9 border-b border-white/5 flex items-center justify-between px-3 bg-neutral-900 shrink-0 z-40">
				<div className="text-[11px] font-semibold text-neutral-400 tracking-wider flex items-center gap-2">
					<Layers className="w-3.5 h-3.5" /> LAYERS
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 rounded-full hover:bg-white/10 text-gray-400"
						onClick={() => setPixelsPerFrame((p) => Math.max(2, p - 2))}
					>
						<Minus className="h-3 w-3" />
					</Button>
					<Slider
						value={[pixelsPerFrame]}
						min={1}
						max={30}
						step={1}
						onValueChange={([v]) => setPixelsPerFrame(v)}
						className="w-20"
					/>
					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6 rounded-full hover:bg-white/10 text-gray-400"
						onClick={() => setPixelsPerFrame((p) => Math.min(24, p + 2))}
					>
						<Plus className="h-3 w-3" />
					</Button>
				</div>
			</div>

			{/* Timeline Content */}
			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-auto bg-[#0a0a0a]"
				style={{ cursor: isPanningTimeline ? "grabbing" : "default" }}
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
			>
				<div
					className="relative flex flex-col min-h-full"
					style={{
						width: HEADER_WIDTH + durationInFrames * pixelsPerFrame + 800,
					}}
				>
					{/* Ruler */}
					<div
						className="sticky top-0 z-50 flex shrink-0"
						style={{ height: RULER_HEIGHT }}
					>
						<div
							className="sticky left-0 z-50 border-r border-b border-white/5 bg-neutral-900 shrink-0"
							style={{ width: HEADER_WIDTH }}
						/>
						<div
							className="flex-1 bg-neutral-900/90 backdrop-blur-sm border-b border-white/5 relative cursor-pointer"
							onClick={handleTimelineClick}
						>
							<svg className="absolute inset-0 w-full h-full pointer-events-none">
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
											stroke="#555"
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
								<rect
									width="100%"
									height="100%"
									fill="url(#ruler-ticks)"
									opacity={0.8}
								/>
							</svg>

							{/* Time Labels */}
							{Array.from({
								length: Math.ceil(durationInFrames / fps) + 2,
							}).map((_, sec) => (
								<span
									key={sec}
									className="absolute top-1 text-[9px] font-mono text-gray-500 select-none pointer-events-none"
									style={{ left: sec * fps * pixelsPerFrame + 4 }}
								>
									{sec}s
								</span>
							))}

							{/* Playhead */}
							<div
								ref={playheadRef}
								className="absolute top-0 bottom-0 z-50 pointer-events-none h-[100vh] will-change-transform"
							>
								<div className="absolute -translate-x-1/2 -top-0 w-3 h-3 text-red-500 fill-current">
									<svg viewBox="0 0 12 12" className="w-full h-full">
										<path d="M0,0 L12,0 L12,8 L6,12 L0,8 Z" />
									</svg>
								</div>
								<div className="w-px h-full bg-red-500 absolute left-0" />
							</div>
						</div>
					</div>

					{/* Tracks Body */}
					<div className="flex relative flex-1">
						{/* Sidebar / Headers */}
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

						{/* Clips Area */}
						<div className="flex-1 relative timeline-bg min-h-full bg-[#0a0a0a]">
							{/* Grid */}
							<div
								className="absolute inset-0 pointer-events-none opacity-20"
								style={{
									backgroundImage:
										"linear-gradient(90deg, #333 1px, transparent 1px)",
									backgroundSize: `${fps * pixelsPerFrame}px 100%`,
								}}
							/>

							{sortedLayers.map((layer) => (
								<div
									key={layer.id}
									style={{ height: TRACK_HEIGHT }}
									className={`border-b border-white/5 relative group/track ${
										layer.id === selectedId ? "bg-white/[0.03]" : ""
									}`}
								>
									<div
										role="button"
										tabIndex={0}
										className={`
                      absolute top-1 bottom-1 rounded-xs border backdrop-blur-sm
                      flex items-center overflow-hidden cursor-move outline-none
                      ${
												layer.id === selectedId
													? "ring-1 ring-white/50 z-10 shadow-lg"
													: "opacity-80 hover:opacity-100 hover:brightness-110"
											}
                    `}
										style={{
											left: layer.startFrame * pixelsPerFrame,
											width: Math.max(
												10,
												layer.durationInFrames * pixelsPerFrame,
											),
											backgroundColor:
												layer.type === "Video"
													? "#1e3a8a"
													: layer.type === "Image"
														? "#581c87"
														: layer.type === "Text"
															? "#14532d"
															: "#7c2d12",
											borderColor: "rgba(255,255,255,0.1)",
										}}
										onMouseDown={(e) =>
											handleClipManipulation(e, layer.id, "move")
										}
										onClick={(e) => {
											e.stopPropagation();
											setSelectedId(layer.id);
										}}
									>
										<div className="flex flex-col px-2 w-full overflow-hidden">
											<span className="text-[10px] truncate text-white/90 font-medium drop-shadow-md">
												{layer.name || layer.id}
											</span>
										</div>
										{/* Resize Handle */}
										<div
											className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-white/20 z-20 flex items-center justify-center group/handle"
											onMouseDown={(e) =>
												handleClipManipulation(e, layer.id, "trim")
											}
										>
											<div className="w-0.5 h-3 bg-white/30 group-hover/handle:bg-white/70 rounded-full" />
										</div>
									</div>
								</div>
							))}
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
		getTextData,
		viewportWidth,
		viewportHeight,
		updateViewportWidth,
		updateViewportHeight,
	} = useEditor();

	const selectedLayer = layers.find((f) => f.id === selectedId);
	const [addAnimOpen, setAddAnimOpen] = useState(false);
	const { data: fontList } = useGetFontListQuery({});

	const fontNames = useMemo(() => {
		if (Array.isArray(fontList) && (fontList as string[])?.length > 0) {
			return fontList as string[];
		}
		return ["Geist", "Inter", "Arial", "Courier New", "Times New Roman"];
	}, [fontList]);

	const animationTypes: AnimationType[] = [
		"fade-in",
		"fade-out",
		"slide-in-left",
		"slide-in-right",
		"slide-in-top",
		"slide-in-bottom",
		"zoom-in",
		"zoom-out",
		"rotate-cw",
		"rotate-ccw",
		"bounce",
		"shake",
	];

	const addAnimation = (type: AnimationType) => {
		if (!selectedLayer) return;
		const newAnimation: VideoAnimation = {
			id: crypto.randomUUID(),
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

	const update = (patch: Partial<ExtendedLayer>) => {
		updateLayers((prev) =>
			prev.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)),
		);
	};

	if (!selectedLayer) {
		return (
			<div className="w-72 border-l border-white/5 bg-[#0f0f0f] flex flex-col z-20 shadow-xl">
				<div className="p-4 bg-neutral-900 border-b border-white/5">
					<h2 className="text-xs font-semibold text-white">Global Settings</h2>
				</div>
				<div className="p-4 space-y-4">
					<div className="space-y-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Label className="text-[10px] text-gray-500 uppercase font-bold">
										Canvas Size
									</Label>
								</TooltipTrigger>
								<TooltipContent>
									<p>
										Dimensions are automatically rounded to even numbers for
										video codec compatibility.
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
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
					<div className="flex flex-col items-center justify-center p-8 mt-10 text-center border border-dashed border-white/10 rounded-lg bg-white/5">
						<MousePointer className="w-6 h-6 text-gray-600 mb-2" />
						<p className="text-xs text-gray-500">Select a layer to edit</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<ScrollArea className="w-72 border-l border-white/5 bg-[#0f0f0f] z-20 shadow-xl">
			{/* Inject Animation Styles for Preview Only */}
			<style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slide-in-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slide-in-top { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes slide-in-bottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes zoom-in { from { transform: scale(0); } to { transform: scale(1); } }
        @keyframes zoom-out { from { transform: scale(1); } to { transform: scale(0); } }
        @keyframes rotate-cw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rotate-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-100%); }
          60% { transform: translateY(-50%); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-25%); }
          20%, 40%, 60%, 80% { transform: translateX(25%); }
        }
        .animate-fade-in { animation: fade-in 1s ease-in-out infinite alternate; }
        .animate-fade-out { animation: fade-out 1s ease-in-out infinite alternate; }
        .animate-slide-in-left { animation: slide-in-left 1s ease-in-out infinite alternate; }
        .animate-slide-in-right { animation: slide-in-right 1s ease-in-out infinite alternate; }
        .animate-slide-in-top { animation: slide-in-top 1s ease-in-out infinite alternate; }
        .animate-slide-in-bottom { animation: slide-in-bottom 1s ease-in-out infinite alternate; }
        .animate-zoom-in { animation: zoom-in 1s ease-in-out infinite alternate; }
        .animate-zoom-out { animation: zoom-out 1s ease-in-out infinite alternate; }
        .animate-rotate-cw { animation: rotate-cw 1s ease-in-out infinite alternate; }
        .animate-rotate-ccw { animation: rotate-ccw 1s ease-in-out infinite alternate; }
        .animate-bounce { animation: bounce 1s ease-in-out infinite alternate; }
        .animate-shake { animation: shake 1s ease-in-out infinite alternate; }
      `}</style>

			<div className="flex items-center justify-between p-4 border-b border-white/5 bg-neutral-900/50">
				<div className="flex flex-col min-w-0">
					<span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
						Selected
					</span>
					<h2 className="text-sm font-semibold text-white truncate max-w-[150px]">
						{selectedLayer.name || selectedLayer.id}
					</h2>
				</div>
				<span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-300 font-medium uppercase border border-white/5">
					{selectedLayer.type}
				</span>
			</div>

			<div className="pb-20">
				{/* Transform */}
				<div className="border-b border-white/5 p-3">
					<div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-gray-400 uppercase">
						<Move className="w-3.5 h-3.5" /> Transform
					</div>
					<div className="grid grid-cols-2 gap-3 mb-3">
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
						{selectedLayer.type !== "Text" && (
							<>
								<DraggableNumberInput
									label="W"
									icon={MoveHorizontal}
									value={Math.round(selectedLayer.width ?? 0)}
									onChange={(v) => update({ width: Math.max(1, v) })}
								/>
								<DraggableNumberInput
									label="H"
									icon={MoveVertical}
									value={Math.round(selectedLayer.height ?? 0)}
									onChange={(v) => update({ height: Math.max(1, v) })}
								/>
							</>
						)}
					</div>
					<div className="grid grid-cols-2 gap-3">
						<DraggableNumberInput
							label="Scale"
							icon={Move}
							value={selectedLayer.scale}
							step={0.1}
							onChange={(v) => update({ scale: v })}
							allowDecimal
						/>
						<DraggableNumberInput
							label="Rot"
							icon={RotateCw}
							value={Math.round(selectedLayer.rotation)}
							onChange={(v) => update({ rotation: v })}
						/>
					</div>
				</div>

				{/* Animations */}
				<div className="border-b border-white/5 p-3">
					<div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-gray-400 uppercase">
						<Zap className="w-3.5 h-3.5" /> Animations
					</div>
					<div className="space-y-3">
						{selectedLayer.animations?.map((anim) => (
							<div
								key={anim.id}
								className="bg-neutral-900 rounded-md p-2 border border-white/5 shadow-sm group"
							>
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
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
								<Slider
									value={[anim.value]}
									min={0.1}
									max={5}
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
							</div>
						))}

						<Popover open={addAnimOpen} onOpenChange={setAddAnimOpen}>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className="w-full h-8 text-xs border-dashed border-white/20 bg-transparent hover:bg-white/5 text-gray-400"
								>
									<Plus className="w-3.5 h-3.5 mr-1" /> Add Animation
								</Button>
							</PopoverTrigger>
							<PopoverContent
								side="left"
								align="start"
								className="bg-[#1a1a1a] border-white/10 w-64 p-2"
							>
								<div className="grid grid-cols-3 gap-1">
									{animationTypes.map((type) => (
										<button
											key={type}
											type="button"
											className="flex flex-col items-center justify-center p-2 rounded hover:bg-white/10 transition-colors"
											onClick={() => addAnimation(type)}
										>
											<div
												className={`w-8 h-8 mb-1 rounded bg-primary border border-white/5 animate-${type}`}
											></div>
											<span className="text-[9px] text-gray-400 text-center leading-tight">
												{type.replace(/-/g, " ")}
											</span>
										</button>
									))}
								</div>
							</PopoverContent>
						</Popover>
					</div>
				</div>

				{/* Typography */}
				{selectedLayer.type === "Text" && (
					<div className="border-b border-white/5 p-3">
						<div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-gray-400 uppercase">
							<Type className="w-3.5 h-3.5" /> Typography
						</div>
						<div className="space-y-3">
							<div className="space-y-1">
								<Label className="text-[10px] text-gray-500">Content</Label>
								<div className="text-xs text-gray-300 border border-white/10 p-2 rounded bg-black/20 break-words min-h-[40px]">
									{getTextData(selectedLayer.id)}
								</div>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1 col-span-2">
									<Label className="text-[10px] text-gray-500">Font</Label>
									<Select
										value={selectedLayer.fontFamily ?? "Inter"}
										onValueChange={(val) =>
											update({
												fontFamily: val,
												width: undefined,
												height: undefined,
											})
										}
									>
										<SelectTrigger className="h-8 text-xs bg-neutral-800 border-white/10">
											<SelectValue placeholder="Select font" />
										</SelectTrigger>
										<SelectContent className="bg-neutral-800 border-white/10 text-white max-h-[200px]">
											{fontNames.map((f) => (
												<SelectItem key={f} value={f} style={{ fontFamily: f }}>
													{f}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<DraggableNumberInput
									label="Size"
									icon={Type}
									value={selectedLayer.fontSize ?? 40}
									onChange={(v) =>
										update({ fontSize: v, width: undefined, height: undefined })
									}
								/>
								<div className="space-y-1">
									<Label className="text-[10px] text-gray-500 block mb-1">
										Color
									</Label>
									<ColorInput
										value={selectedLayer.fill ?? "#fff"}
										onChange={(c) => update({ fill: c })}
									/>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</ScrollArea>
	);
};

// --- Main Editor ---

interface VideoDesignerEditorProps {
	initialLayers: Map<string, OutputItem<"Text" | "Image" | "Video" | "Audio">>;
	node: { config: CompositorNodeConfig };
	onClose: () => void;
	onSave: (config: CompositorNodeConfig) => void;
}

export const VideoDesignerEditor: React.FC<VideoDesignerEditorProps> = ({
	initialLayers,
	node,
	onClose,
	onSave,
}) => {
	const nodeConfig = node.config || {};

	// --- State ---
	const [layers, setLayers] = useState<ExtendedLayer[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isDirty, setIsDirty] = useState(false);

	// Canvas State
	const roundToEven = (num: number) => Math.round(num / 2) * 2;
	const [viewportWidth, setViewportWidth] = useState(
		roundToEven(nodeConfig.width ?? 1920),
	);
	const [viewportHeight, setViewportHeight] = useState(
		roundToEven(nodeConfig.height ?? 1080),
	);
	const [zoom, setZoom] = useState(0.5);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [mode, setMode] = useState<"select" | "pan">("select");

	// Player State
	const [currentFrame, setCurrentFrame] = useState(0);
	const [isPlaying, setIsPlayingState] = useState(false);
	const playerRef = useRef<PlayerRef>(null);

	// Refs
	const containerRef = useRef<HTMLDivElement>(null);
	const timeRef = useRef<HTMLDivElement>(null);
	const lastModeRef = useRef<"select" | "pan">("select");
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
	const [sizeKnown, setSizeKnown] = useState(false);

	// --- Actions ---

	const updateViewportWidth = (w: number) => {
		setViewportWidth(roundToEven(Math.max(2, w)));
		setIsDirty(true);
	};
	const updateViewportHeight = (h: number) => {
		setViewportHeight(roundToEven(Math.max(2, h)));
		setIsDirty(true);
	};

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
			const processData = item.data as FileData;
			if (processData.entity?.id) {
				return GetAssetEndpoint(processData.entity);
			}
			return processData?.processData?.dataUrl;
		},
		[initialLayers],
	);

	const updateLayersHandler = useCallback(
		(
			updater: SetStateAction<ExtendedLayer[]>,
			isUserChange: boolean = true,
		) => {
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

	const setIsPlaying = useCallback((p: boolean) => {
		setIsPlayingState(p);
		if (p) playerRef.current?.play();
		else {
			playerRef.current?.pause();
			// Sync frame on pause
			if (playerRef.current) {
				setCurrentFrame(playerRef.current.getCurrentFrame());
			}
		}
	}, []);

	const setCurrentFrameHandler = useCallback((frame: number) => {
		setCurrentFrame(frame);
		playerRef.current?.seekTo(frame);
	}, []);

	// --- Initialization ---

	// Load Initial State
	useEffect(() => {
		const layerUpdates = { ...nodeConfig.layerUpdates };
		const loaded: ExtendedLayer[] = [];

		let maxZ = Math.max(
			0,
			...Object.values(layerUpdates).map((l) => l.zIndex ?? 0),
		);

		initialLayers.forEach((item, id) => {
			const saved = layerUpdates[id] as ExtendedLayer | undefined;
			const durationMs =
				item.data.entity?.duration ?? item.data.processData?.duration ?? 0;

			// Logic: Videos/Audio use their duration, Images/Text use default unless saved
			const calculatedDurationFrames =
				(item.type === "Video" || item.type === "Audio") && durationMs > 0
					? Math.ceil((durationMs / 1000) * FPS)
					: DEFAULT_DURATION_FRAMES;

			const base = {
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
			};

			if (item.type === "Text") {
				loaded.push({
					...base,
					type: "Text",
					fontSize: saved?.fontSize ?? 60,
					fontFamily: saved?.fontFamily ?? "Inter",
					fill: saved?.fill ?? "#ffffff",
					width: saved?.width,
					height: saved?.height,
					text: "",
				});
			} else if (item.type === "Image" || item.type === "Video") {
				const pData = item.data?.processData;
				loaded.push({
					...base,
					type: item.type as "Image" | "Video",
					src: "",
					width: saved?.width ?? pData?.width,
					height: saved?.height ?? pData?.height,
					maxDurationInFrames:
						item.type === "Video" && durationMs > 0
							? calculatedDurationFrames
							: undefined,
				});
			} else if (item.type === "Audio") {
				loaded.push({
					...base,
					type: "Audio",
					src: "",
					height: 0,
					width: 0,
					maxDurationInFrames:
						durationMs > 0 ? calculatedDurationFrames : undefined,
				});
			}
		});
		setLayers(loaded);
	}, [initialLayers, nodeConfig]); // Run once on mount when props change

	// Calculate Dimensions (Lazy, no infinite loop)
	useEffect(() => {
		const layersToMeasure = layers.filter(
			(l) =>
				l.type !== "Audio" &&
				(l.width == null || l.height == null) &&
				!l.isPlaceholder, // Flag to prevent re-checking failed ones
		);

		if (layersToMeasure.length === 0) return;

		let mounted = true;

		const measure = async () => {
			const updates = new Map<string, Partial<ExtendedLayer>>();

			await Promise.all(
				layersToMeasure.map(async (layer) => {
					const url = getAssetUrl(layer.inputHandleId);
					if (!url && layer.type !== "Text") return;

					try {
						if (layer.type === "Image") {
							const img = new Image();
							img.src = url!;
							await img.decode();
							updates.set(layer.id, {
								width: img.naturalWidth,
								height: img.naturalHeight,
							});
						} else if (layer.type === "Video") {
							const video = document.createElement("video");
							video.src = url!;
							// Load metadata only
							await new Promise((res) => {
								video.onloadedmetadata = res;
								video.onerror = res;
							});
							updates.set(layer.id, {
								width: video.videoWidth,
								height: video.videoHeight,
							});
						} else if (layer.type === "Text") {
							// Simple text measurement approximation or off-screen render
							const text = getTextData(layer.inputHandleId);
							const d = document.createElement("div");
							d.style.fontFamily = layer.fontFamily || "Inter";
							d.style.fontSize = `${layer.fontSize || 40}px`;
							d.style.lineHeight = `${layer.lineHeight ?? 1.2}`;
							d.style.position = "absolute";
							d.style.visibility = "hidden";
							d.style.whiteSpace = "pre";
							d.textContent = text;
							document.body.appendChild(d);
							updates.set(layer.id, {
								width: d.offsetWidth,
								height: d.offsetHeight,
							});
							document.body.removeChild(d);
						}
					} catch (e) {
						// Mark as handled even if failed to stop loop
						updates.set(layer.id, {
							isPlaceholder: true,
							width: 100,
							height: 100,
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
	}, [layers, getAssetUrl, getTextData]); // Run once on deps change

	// Lazy Font Injection (Does not pre-load)
	useEffect(() => {
		layers.forEach((layer) => {
			if (layer.type === "Text" && layer.fontFamily) {
				const fontUrl = GetFontAssetUrl(layer.fontFamily);
				if (fontUrl) injectFontFace(layer.fontFamily, fontUrl);
			}
		});
	}, [layers]);

	// --- Viewport Logic ---

	// Zoom Helpers
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

	// Initialize View
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

	// Auto-center on load
	useEffect(() => {
		if (!sizeKnown && containerSize.width > 0) {
			fitView();
			setSizeKnown(true);
		}
	}, [containerSize, fitView, sizeKnown]);

	// Wheel Interaction
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const handleWheel = (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey || mode === "pan") {
				e.preventDefault();
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
			} else {
				setPan((p) => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }));
			}
		};

		el.addEventListener("wheel", handleWheel, { passive: false });
		return () => el.removeEventListener("wheel", handleWheel);
	}, [zoom, pan, mode]);

	// Keyboard Shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isInput =
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA";

			if (e.code === "Space" && !e.repeat && !isInput) {
				e.preventDefault();
				if (mode !== "pan") {
					lastModeRef.current = mode;
					setMode("pan");
				}
			}

			if ((e.key === "Delete" || e.key === "Backspace") && !isInput) {
				if (selectedId) deleteLayer(selectedId);
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				const isInput =
					document.activeElement?.tagName === "INPUT" ||
					document.activeElement?.tagName === "TEXTAREA";
				if (!isInput) {
					e.preventDefault();
					setMode(lastModeRef.current);
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [mode, selectedId, deleteLayer]);

	const durationInFrames = useMemo(() => {
		if (layers.length === 0) return DEFAULT_DURATION_FRAMES;
		return Math.max(
			DEFAULT_DURATION_FRAMES,
			...layers.map((l) => l.startFrame + l.durationInFrames),
		);
	}, [layers]);

	// Memoized Context Value to prevent render cascading
	const contextValue = useMemo(
		() => ({
			layers,
			updateLayers: updateLayersHandler,
			deleteLayer,
			selectedId,
			setSelectedId,
			getTextData,
			getAssetUrl,
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
		}),
		[
			layers,
			selectedId,
			viewportWidth,
			viewportHeight,
			currentFrame,
			isPlaying,
			zoom,
			pan,
			mode,
			isDirty,
			durationInFrames,
			// Stable functions:
			updateLayersHandler,
			deleteLayer,
			getTextData,
			getAssetUrl,
			setCurrentFrameHandler,
			setIsPlaying,
			zoomIn,
			zoomOut,
			zoomTo,
			fitView,
		],
	);

	return (
		<EditorContext.Provider value={contextValue}>
			<div className="flex flex-col h-screen w-full bg-[#050505] text-gray-100 overflow-hidden font-sans select-none">
				<div className="flex flex-1 min-h-0 relative">
					{/* Canvas Area */}
					<div
						ref={containerRef}
						className="flex-1 relative overflow-hidden"
						onMouseDown={() => setSelectedId(null)}
						style={{
							backgroundColor: "#0F0F0F",
							backgroundImage:
								"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)",
							backgroundSize: "24px 24px",
						}}
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
								className="shadow-[0_0_50px_rgba(0,0,0,0.5)] media-container relative bg-black ring-1 ring-white/10"
								style={{ width: viewportWidth, height: viewportHeight }}
							>
								<Player
									ref={playerRef}
									component={CompositionScene}
									inputProps={{ layers }}
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

					{/* Floating Controls */}
					<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300">
						<Toolbar
							onClose={onClose}
							onSave={() => {
								const layerUpdates = layers.reduce<
									Record<string, ExtendedLayer>
								>((acc, layer) => {
									acc[layer.id] = layer;
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
