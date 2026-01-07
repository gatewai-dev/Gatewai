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
	Settings2,
	Trash2,
	Type,
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
	OffthreadVideo,
	Sequence,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

import { Button } from "@/components/ui/button";
import { DraggableNumberInput } from "@/components/ui/draggable-number-input";
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
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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

interface ExtendedLayer extends VideoCompositorLayer {
	animations?: VideoAnimation[];
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
	backgroundColor: string;
	setBackgroundColor: (color: string) => void;
	isTransparent: boolean;
	setIsTransparent: (isTransparent: boolean) => void;

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
const RULER_HEIGHT = 32;
const TRACK_HEIGHT = 48;
const HEADER_WIDTH = 280;

// --- Font Manager (Singleton) ---
class FontManager {
	private static instance: FontManager | null = null;
	private loadedFonts: Set<string> = new Set();

	private constructor() {}

	public static getInstance(): FontManager {
		if (!FontManager.instance) {
			FontManager.instance = new FontManager();
		}
		return FontManager.instance;
	}

	public async loadFont(family: string, url: string): Promise<void> {
		if (this.loadedFonts.has(family)) return;
		if (!url) return;

		const fontId = `font-${family}`;
		if (document.getElementById(fontId)) return;

		const style = document.createElement("style");
		style.id = fontId;
		style.innerHTML = `
      @font-face {
        font-family: "${family}";
        src: url("${url}");
      }
    `;
		document.head.appendChild(style);

		try {
			await document.fonts.load(`1em "${family}"`);
			await document.fonts.ready;
			this.loadedFonts.add(family);
		} catch (e) {
			console.warn(`Font load failed for ${family}:`, e);
		}
	}
}

const fontManager = FontManager.getInstance();

// --- Components: Rendering Engine (Remotion) ---

const CompositionScene: React.FC<{
	layers: ExtendedLayer[];
}> = ({ layers }) => {
	const {
		getTextData,
		getAssetUrl,
		viewportWidth,
		viewportHeight,
		backgroundColor,
		isTransparent,
	} = useEditor();
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Sort by zIndex
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	return (
		<AbsoluteFill
			style={{ backgroundColor: isTransparent ? undefined : backgroundColor }}
		>
			{sortedLayers.map((layer) => {
				const src = getAssetUrl(layer.inputHandleId);
				const textContent = getTextData(layer.inputHandleId);

				const relativeFrame = frame - layer.startFrame;

				// Compute animated properties
				let animX = layer.x;
				let animY = layer.y;
				let animScale = layer.scale;
				let animRotation = layer.rotation;
				let animOpacity = layer.opacity;
				const animVolume = layer.volume ?? 1;

				// Apply animations in order (stacking)
				(layer.animations ?? []).forEach((anim) => {
					const durFrames = anim.value * fps;
					const isOut = anim.type.includes("-out");
					const startAnimFrame = isOut ? layer.durationInFrames - durFrames : 0;
					const endAnimFrame = isOut ? layer.durationInFrames : durFrames;

					if (relativeFrame < startAnimFrame || relativeFrame > endAnimFrame) {
						return; // Not active
					}

					const progress = interpolate(
						relativeFrame,
						[startAnimFrame, endAnimFrame],
						[0, 1],
						{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
					);

					switch (anim.type) {
						case "fade-in":
						case "fade-out":
							animOpacity *= progress;
							if (isOut) animOpacity = layer.opacity * (1 - progress);
							break;
						case "slide-in-left":
						case "slide-in-right": {
							const dirX = anim.type === "slide-in-left" ? -1 : 1;
							animX += dirX * viewportWidth * (1 - progress);
							break;
						}
						case "slide-in-top":
						case "slide-in-bottom": {
							const dirY = anim.type === "slide-in-top" ? -1 : 1;
							animY += dirY * viewportHeight * (1 - progress);
							break;
						}
						case "zoom-in":
						case "zoom-out": {
							const fromScale = anim.type === "zoom-in" ? 0 : 1.5;
							const toScale = anim.type === "zoom-in" ? 1 : 0;
							animScale *= interpolate(progress, [0, 1], [fromScale, toScale]);
							break;
						}
						case "rotate-cw":
						case "rotate-ccw": {
							const dirRot = anim.type === "rotate-cw" ? 1 : -1;
							animRotation += dirRot * 360 * progress;
							break;
						}
						case "bounce": {
							const bounceProgress = spring({
								frame: relativeFrame - startAnimFrame,
								fps,
								config: { damping: 10, mass: 0.5, stiffness: 100 },
								durationInFrames: durFrames,
							});
							animScale *= bounceProgress;
							break;
						}
						case "shake": {
							const intensity = 20; // pixels
							const frequency = 10; // shakes
							const shakeProgress = 1 - progress; // dampen
							animX +=
								intensity *
								Math.sin(
									(relativeFrame * frequency * 2 * Math.PI) / durFrames,
								) *
								shakeProgress;
							animY +=
								intensity *
								Math.cos(
									(relativeFrame * frequency * 2 * Math.PI) / durFrames,
								) *
								shakeProgress;
							break;
						}
					}
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
					>
						{layer.type === "Video" && src && (
							<OffthreadVideo
								src={src}
								style={{ ...style, objectFit: "cover" }}
								volume={animVolume}
							/>
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
									lineHeight: 1.2,
									display: "flex",
									alignItems: "flex-start",
									whiteSpace: "pre-wrap",
									textShadow: "0 2px 4px rgba(0,0,0,0.1)",
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
	const [resizeAnchor, setResizeAnchor] = useState<
		"tl" | "tr" | "bl" | "br" | null
	>(null);
	const [isPanning, setIsPanning] = useState(false);
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
			.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)); // Render order: low z-index first
	}, [layers, currentFrame]);

	const handleMouseDown = (
		e: React.MouseEvent,
		layerId?: string,
		anchor?: "tl" | "tr" | "bl" | "br",
	) => {
		if (e.button !== 0) return;
		e.stopPropagation();

		// Handle selection/deselection
		if (!layerId && !isPanning && mode === "select") {
			setSelectedId(null);
		}

		if (mode === "pan") {
			setIsPanning(true);
			setDragStart({ x: e.clientX, y: e.clientY });
			setInitialPan({ x: pan.x, y: pan.y });
			return;
		}

		if (layerId) {
			setSelectedId(layerId);
			const layer = layers.find((l) => l.id === layerId);
			if (layer) {
				setDragStart({ x: e.clientX, y: e.clientY });
				setInitialPos({
					x: layer.x,
					y: layer.y,
					width: layer.width,
					height: layer.height,
					rotation: layer.rotation,
					scale: layer.scale,
				});

				if (anchor) {
					setIsResizing(true);
					setResizeAnchor(anchor);
				} else {
					setIsDragging(true);
				}
			}
		}
	};

	const handleRotateStart = (e: React.MouseEvent, layerId: string) => {
		e.stopPropagation();
		setSelectedId(layerId);
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;
		const centerX = layer.x + layer.width / 2;
		const centerY = layer.y + layer.height / 2;
		const screenCenterX = centerX * zoom + pan.x;
		const screenCenterY = centerY * zoom + pan.y;
		const startAngle = Math.atan2(
			e.clientY - screenCenterY,
			e.clientX - screenCenterX,
		);
		setInitialAngle(startAngle);
		setDragStart({ x: e.clientX, y: e.clientY });
		setInitialPos({
			x: layer.x,
			y: layer.y,
			width: layer.width,
			height: layer.height,
			rotation: layer.rotation,
			scale: layer.scale,
		});
		setIsRotating(true);
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDragging && selectedId) {
			const dx = (e.clientX - dragStart.x) / zoom;
			const dy = (e.clientY - dragStart.y) / zoom;
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
		} else if (isResizing && selectedId && resizeAnchor) {
			const dx = (e.clientX - dragStart.x) / zoom;
			const dy = (e.clientY - dragStart.y) / zoom;
			const theta = initialPos.rotation * (Math.PI / 180);
			const cos = Math.cos(theta);
			const sin = Math.sin(theta);

			// Rotate vector to align with object local space
			let local_dx = cos * dx + sin * dy;
			let local_dy = -sin * dx + cos * dy;
			local_dx /= initialPos.scale;
			local_dy /= initialPos.scale;

			const layer = layers.find((l) => l.id === selectedId);
			if (!layer) return;
			const ratio = initialPos.height / initialPos.width || 1;
			const isLocked =
				layer.type !== "Text" && layer.type !== "Audio" && layer.lockAspect;

			let signW = 1,
				signH = 1,
				isLeft = false,
				isTop = false;

			if (resizeAnchor.includes("l")) {
				signW = -1;
				isLeft = true;
			}
			if (resizeAnchor.includes("t")) {
				signH = -1;
				isTop = true;
			}

			let changeW = signW * local_dx;
			let changeH = signH * local_dy;

			if (isLocked) {
				if (Math.abs(changeW) * ratio > Math.abs(changeH)) {
					changeH = changeW * ratio;
				} else {
					changeW = changeH / ratio;
				}
			}

			local_dx = signW * changeW;
			local_dy = signH * changeH;

			const newWidth = Math.max(1, initialPos.width + changeW);
			const newHeight = Math.max(1, initialPos.height + changeH);

			// Back to world space
			const world_dx = cos * local_dx - sin * local_dy;
			const world_dy = sin * local_dx + cos * local_dy;

			const newX = isLeft ? initialPos.x + world_dx : initialPos.x;
			const newY = isTop ? initialPos.y + world_dy : initialPos.y;

			updateLayers((prev) =>
				prev.map((l) =>
					l.id === selectedId
						? {
								...l,
								width: Math.round(newWidth),
								height: Math.round(newHeight),
								x: isLeft ? Math.round(newX) : l.x,
								y: isTop ? Math.round(newY) : l.y,
							}
						: l,
				),
			);
		} else if (isRotating && selectedId) {
			const layer = layers.find((l) => l.id === selectedId);
			if (!layer) return;
			const centerX = layer.x + layer.width / 2;
			const centerY = layer.y + layer.height / 2;
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
		} else if (isPanning) {
			const dx = e.clientX - dragStart.x;
			const dy = e.clientY - dragStart.y;
			setPan({ x: initialPan.x + dx, y: initialPan.y + dy });
		}
	};

	const handleMouseUp = () => {
		setIsDragging(false);
		setIsResizing(false);
		setResizeAnchor(null);
		setIsRotating(false);
		setIsPanning(false);
	};

	const cursorStyle =
		mode === "pan" ? (isPanning ? "grabbing" : "grab") : "default";

	return (
		<div
			className="absolute inset-0 z-10 overflow-hidden outline-none"
			style={{ cursor: cursorStyle }}
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
						{/* Selection Border - Glassy Look */}
						<div
							className={`absolute inset-0 pointer-events-none border-2 transition-all duration-200 ${
								selectedId === layer.id
									? "border-blue-500/80 shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-blue-500/5"
									: "border-transparent group-hover:border-blue-400/30"
							}`}
						/>

						{/* Resize Handles - Only for selected */}
						{selectedId === layer.id && (
							<>
								{["tl", "tr", "bl", "br"].map((pos) => (
									<div
										key={pos}
										className={`absolute w-3 h-3 bg-white border border-blue-500 rounded-full shadow-sm z-50 transition-transform duration-200 hover:scale-125
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
								{/* Rotation Handle (Top Center) */}
								<div
									className="absolute -top-6 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-blue-500"
									style={{
										transform: `scale(${1 / zoom})`,
									}}
								/>
								<div
									className="absolute -top-8 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-blue-500 rounded-full shadow-sm cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
									title="Rotate"
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

// --- Components: Toolbar ---

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
	const zoomPercentage = `${Math.round(zoom * 100)}%`;

	return (
		<Menubar className="border border-white/10 bg-black/60 backdrop-blur-md shadow-2xl rounded-full px-2 py-1 h-12 flex items-center gap-1 select-none z-50">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="rounded-full w-9 h-9 hover:bg-white/10 text-white"
							onClick={() => {
								if (playerRef.current) {
									if (isPlaying) playerRef.current.pause();
									else playerRef.current.play();
									setIsPlaying(!isPlaying);
								}
							}}
						>
							{isPlaying ? (
								<Pause className="w-4 h-4 fill-current" />
							) : (
								<Play className="w-4 h-4 fill-current ml-0.5" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>{isPlaying ? "Pause" : "Play"}</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<div
				ref={timeRef}
				className="text-xs font-mono bg-white/5 border border-white/5 rounded px-2 py-1 min-w-20 text-center text-blue-200"
			>
				{Math.floor(currentFrame / fps)}s :{" "}
				{(currentFrame % fps).toString().padStart(2, "0")}f
			</div>

			<div className="w-px h-5 bg-white/10 mx-1" />

			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={mode === "select" ? "secondary" : "ghost"}
							size="icon"
							className={`rounded-full w-9 h-9 ${mode === "select" ? "bg-white/20 text-white" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
							onClick={() => setMode("select")}
						>
							<MousePointer className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Select Tool (V)</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={mode === "pan" ? "secondary" : "ghost"}
							size="icon"
							className={`rounded-full w-9 h-9 ${mode === "pan" ? "bg-white/20 text-white" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
							onClick={() => setMode("pan")}
						>
							<Hand className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Pan Tool (Space)</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<div className="w-px h-5 bg-white/10 mx-1" />

			<MenubarMenu>
				<MenubarTrigger asChild>
					<Button
						variant="ghost"
						className="h-9 px-3 text-xs font-mono rounded-full text-gray-300 hover:text-white hover:bg-white/10"
					>
						{zoomPercentage} <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
					</Button>
				</MenubarTrigger>
				<MenubarContent
					align="center"
					className="min-w-[140px] bg-neutral-900/90 backdrop-blur-xl border-white/10 text-gray-200"
				>
					<MenubarItem onClick={zoomIn}>Zoom In</MenubarItem>
					<MenubarItem onClick={zoomOut}>Zoom Out</MenubarItem>
					<MenubarItem onClick={() => zoomTo(1)}>
						Actual Size (100%)
					</MenubarItem>
					<MenubarItem onClick={() => zoomTo(0.5)}>50%</MenubarItem>
					<Separator className="my-1 bg-white/10" />
					<MenubarItem onClick={fitView}>Fit to Screen</MenubarItem>
				</MenubarContent>
			</MenubarMenu>

			<Separator orientation="vertical" className="mx-1 h-5 bg-white/10" />

			<Button
				size="sm"
				className="h-8 text-xs rounded-full px-4 border-0 bg-white text-black hover:bg-gray-200 font-semibold"
				onClick={onSave}
				disabled={!isDirty}
			>
				Save
			</Button>
			<Button
				size="sm"
				variant="ghost"
				className="h-8 text-xs rounded-full px-3 ml-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
				onClick={onClose}
			>
				Close
			</Button>
		</Menubar>
	);
});

// --- Components: Timeline Tracks ---

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

	const hasAnimations = layer.animations && layer.animations.length > 0;

	return (
		<div
			ref={setNodeRef}
			style={style}
			role="button"
			tabIndex={0}
			className={`
				border-b border-white/5 flex items-center pl-3 pr-2 text-xs gap-3 group outline-none
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
				<span className="truncate font-medium">{layer.name || layer.id}</span>
			</div>
			<div className="flex gap-1">
				{hasAnimations && (
					<Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
				)}
			</div>
		</div>
	);
};

// --- Components: Timeline ---

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
	const [pixelsPerFrame, setPixelsPerFrame] = useState(5);

	const zoomTimelineIn = () => setPixelsPerFrame((p) => Math.min(20, p + 1));
	const zoomTimelineOut = () => setPixelsPerFrame((p) => Math.max(1, p - 1));

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
			if (oldIndex !== -1 && newIndex !== -1) {
				const newSorted = arrayMove(sortedLayers, oldIndex, newIndex);
				const updatedLayers = newSorted.map((l, idx) => ({
					...l,
					zIndex: newSorted.length - idx,
				}));
				updateLayers((prev) => {
					const map = new Map(updatedLayers.map((l) => [l.id, l]));
					return prev.map((l) => (map.has(l.id) ? map.get(l.id)! : l));
				});
			}
		}
	};

	useEffect(() => {
		let rafId: number | null = null;
		const loop = () => {
			if (playerRef.current) {
				const frame = playerRef.current.getCurrentFrame();
				// Smoothly interpolate playhead
				if (playheadRef.current) {
					playheadRef.current.style.transform = `translateX(${frame * pixelsPerFrame}px)`;
				}
				// Auto-scroll timeline if playing and playhead is near edge
				if (isPlaying && scrollContainerRef.current) {
					const x = frame * pixelsPerFrame;
					const width = scrollContainerRef.current.clientWidth - HEADER_WIDTH;
					const scroll = scrollContainerRef.current.scrollLeft;
					if (x > scroll + width - 100) {
						scrollContainerRef.current.scrollLeft = x - 100;
					}
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
	}, [isPlaying, currentFrame, pixelsPerFrame, playerRef.current]);

	const handleTimelineClick = (e: React.MouseEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const frame = Math.max(0, Math.floor(clickX / pixelsPerFrame));
		if (playerRef.current) playerRef.current.seekTo(frame);
		setCurrentFrame(frame);
	};

	const handleClipDrag = (e: React.MouseEvent, layerId: string) => {
		e.stopPropagation();
		const startX = e.clientX;
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;
		const initialStart = layer.startFrame;

		const onMove = (moveEv: MouseEvent) => {
			const diffPx = moveEv.clientX - startX;
			const diffFrames = Math.round(diffPx / pixelsPerFrame);
			const newStart = Math.max(0, initialStart + diffFrames);
			updateLayers(
				(prev) =>
					prev.map((l) =>
						l.id === layerId ? { ...l, startFrame: newStart } : l,
					),
				true,
			);
		};
		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	const handleTrim = (e: React.MouseEvent, layerId: string) => {
		e.stopPropagation();
		const startX = e.clientX;
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;
		const initialDuration = layer.durationInFrames;

		const onMove = (moveEv: MouseEvent) => {
			const diffPx = moveEv.clientX - startX;
			const diffFrames = Math.round(diffPx / pixelsPerFrame);
			const newDuration = Math.max(1, initialDuration + diffFrames);
			updateLayers(
				(prev) =>
					prev.map((l) =>
						l.id === layerId ? { ...l, durationInFrames: newDuration } : l,
					),
				true,
			);
		};
		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	return (
		<div className="h-64 flex flex-col border-t border-white/10 bg-neutral-900/95 backdrop-blur-md shrink-0 select-none z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
			{/* Fixed Toolbar */}
			<div className="h-10 border-b border-white/5 flex items-center justify-between px-4 bg-white/5 shrink-0 z-40">
				<div className="text-xs font-semibold text-gray-400 tracking-wider uppercase flex items-center gap-2">
					<Layers className="w-4 h-4" /> Timeline
				</div>
				<div className="flex gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 rounded-full hover:bg-white/10"
						onClick={zoomTimelineOut}
					>
						<Minus className="h-3 w-3" />
					</Button>
					<div className="w-16 flex items-center justify-center text-[10px] font-mono text-gray-500">
						{pixelsPerFrame}px/f
					</div>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 rounded-full hover:bg-white/10"
						onClick={zoomTimelineIn}
					>
						<Plus className="h-3 w-3" />
					</Button>
				</div>
			</div>

			{/* Unified Scroll Area */}
			<div
				ref={scrollContainerRef}
				className="flex-1 overflow-auto bg-neutral-950/50"
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
				{/* Content Wrapper */}
				<div
					className="relative flex flex-col min-h-full"
					style={{
						width: HEADER_WIDTH + durationInFrames * pixelsPerFrame + 1000,
					}}
				>
					{/* Header/Ruler Row */}
					<div
						className="sticky top-0 z-50 flex shrink-0"
						style={{ height: RULER_HEIGHT }}
					>
						<div
							className="sticky left-0 z-50 border-r border-b border-white/10 bg-neutral-900 shrink-0"
							style={{ width: HEADER_WIDTH }}
						/>
						<div
							className="flex-1 bg-neutral-900/90 backdrop-blur-sm border-b border-white/10 relative"
							onClick={handleTimelineClick}
						>
							{/* Ticks */}
							{Array.from({
								length: Math.ceil(durationInFrames / FPS) + 5,
							}).map((_, sec) => (
								<div
									key={sec}
									className="absolute top-0 bottom-0 pointer-events-none"
									style={{ left: sec * FPS * pixelsPerFrame }}
								>
									<div className="h-2 w-px bg-gray-600" />
									<span className="text-[9px] text-gray-500 ml-1 block mt-2">
										{sec}s
									</span>
								</div>
							))}

							{/* Playhead */}
							<div
								ref={playheadRef}
								className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none h-[100vh] will-change-transform"
							>
								<div className="w-3 h-3 -ml-[5.5px] bg-red-500 rotate-45 -mt-1 shadow-sm border border-red-400" />
								<div className="w-px h-full bg-red-500/50" />
							</div>
						</div>
					</div>

					{/* Tracks Body */}
					<div className="flex relative flex-1">
						{/* Track Headers (Sticky Left) */}
						<div
							className="sticky left-0 z-30 bg-neutral-900/80 backdrop-blur-md border-r border-white/10 shrink-0"
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

						{/* Clips Column */}
						<div className="flex-1 relative timeline-bg min-h-full">
							{/* Horizontal Grid Lines */}
							<div
								className="absolute inset-0 pointer-events-none"
								style={{
									backgroundImage:
										"linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
									backgroundSize: `${FPS * pixelsPerFrame}px 100%`,
								}}
							/>

							{sortedLayers.map((layer) => (
								<div
									key={layer.id}
									style={{ height: TRACK_HEIGHT }}
									className={`border-b border-white/5 relative group/track ${
										layer.id === selectedId ? "bg-white/[0.02]" : ""
									}`}
								>
									<div
										role="button"
										tabIndex={0}
										className={`
											absolute top-1.5 bottom-1.5 rounded-md border backdrop-blur-sm
											flex items-center overflow-hidden cursor-move outline-none transition-opacity duration-200
											${layer.id === selectedId ? "ring-1 ring-blue-400 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-10" : "hover:brightness-110 opacity-80 hover:opacity-100"}
										`}
										style={{
											left: layer.startFrame * pixelsPerFrame,
											width: Math.max(
												10,
												layer.durationInFrames * pixelsPerFrame,
											),
											backgroundColor:
												layer.type === "Video"
													? "rgba(29, 78, 216, 0.4)"
													: layer.type === "Image"
														? "rgba(126, 34, 206, 0.4)"
														: layer.type === "Text"
															? "rgba(21, 128, 61, 0.4)"
															: "rgba(194, 65, 12, 0.4)",
											borderColor:
												layer.type === "Video"
													? "rgba(29, 78, 216, 0.8)"
													: layer.type === "Image"
														? "rgba(126, 34, 206, 0.8)"
														: layer.type === "Text"
															? "rgba(21, 128, 61, 0.8)"
															: "rgba(194, 65, 12, 0.8)",
										}}
										onMouseDown={(e) => handleClipDrag(e, layer.id)}
										onClick={(e) => {
											e.stopPropagation();
											setSelectedId(layer.id);
										}}
									>
										<div className="flex flex-col px-2 w-full overflow-hidden">
											<span className="text-[10px] truncate text-white/90 font-medium drop-shadow-md select-none">
												{layer.name || layer.id}
											</span>
										</div>
										{/* Resize Handle */}
										<div
											className="absolute right-0 top-0 bottom-0 w-2.5 cursor-e-resize hover:bg-white/30 z-20"
											onMouseDown={(e) => handleTrim(e, layer.id)}
										/>
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

const InspectorPanel: React.FC = () => {
	const {
		selectedId,
		setSelectedId,
		layers,
		updateLayers,
		deleteLayer,
		getTextData,
		viewportWidth,
		viewportHeight,
		updateViewportWidth,
		updateViewportHeight,
		backgroundColor,
		setBackgroundColor,
		isTransparent,
		setIsTransparent,
	} = useEditor();

	const selectedLayer = layers.find((f) => f.id === selectedId);

	const [addAnimOpen, setAddAnimOpen] = useState(false);
	const { data: fontList } = useGetFontListQuery({});
	const fontNames = useMemo(() => {
		if (Array.isArray(fontList) && (fontList as string[])?.length > 0) {
			return fontList as string[];
		}
		return ["Geist", "Inter", "Arial"];
	}, [fontList]);

	const aspectRatios = useMemo(
		() => [
			{ label: "IG Square (1:1)", width: 1080, height: 1080 },
			{ label: "IG Portrait (4:5)", width: 1080, height: 1350 },
			{ label: "Story (9:16)", width: 1080, height: 1920 },
			{ label: "Landscape (16:9)", width: 1920, height: 1080 },
		],
		[],
	);

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
		const currentAnimations = selectedLayer.animations || [];
		updateLayers((prev) =>
			prev.map((l) =>
				l.id === selectedId
					? { ...l, animations: [...currentAnimations, newAnimation] }
					: l,
			),
		);
		setAddAnimOpen(false);
	};

	const removeAnimation = (animId: string) => {
		if (!selectedLayer) return;
		updateLayers((prev) =>
			prev.map((l) =>
				l.id === selectedId
					? {
							...l,
							animations: l.animations?.filter((a) => a.id !== animId),
						}
					: l,
			),
		);
	};

	const updateAnimation = (animId: string, value: number) => {
		if (!selectedLayer) return;
		updateLayers((prev) =>
			prev.map((l) =>
				l.id === selectedId
					? {
							...l,
							animations: l.animations?.map((a) =>
								a.id === animId ? { ...a, value } : a,
							),
						}
					: l,
			),
		);
	};

	const formatAnimationName = (type: AnimationType) =>
		type
			.split("-")
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");

	const getPreviewAnimationClass = (type: AnimationType) => {
		return `animate-${type}`;
	};

	if (!selectedLayer) {
		return (
			<div className="w-80 border-l border-white/10 bg-neutral-900/95 backdrop-blur-xl flex flex-col overflow-y-auto z-20 shadow-xl">
				<div className="p-4 space-y-6">
					<section>
						<h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
							<Settings2 className="w-3 h-3" /> Canvas Settings
						</h3>
						<div className="grid grid-cols-2 gap-3 mb-3">
							<DraggableNumberInput
								label="W"
								icon={MoveHorizontal}
								value={Math.round(viewportWidth)}
								onChange={(v) => updateViewportWidth(Math.max(1, v))}
							/>
							<DraggableNumberInput
								label="H"
								icon={MoveVertical}
								value={Math.round(viewportHeight)}
								onChange={(v) => updateViewportHeight(Math.max(1, v))}
							/>
						</div>
						<Select
							onValueChange={(val) => {
								const preset = aspectRatios.find((r) => r.label === val);
								if (preset) {
									updateViewportWidth(preset.width);
									updateViewportHeight(preset.height);
								}
							}}
						>
							<SelectTrigger className="h-8 text-xs bg-neutral-800 border-white/10">
								<SelectValue placeholder="Presets" />
							</SelectTrigger>
							<SelectContent className="bg-neutral-800 border-white/10 text-white">
								{aspectRatios.map((r) => (
									<SelectItem key={r.label} value={r.label}>
										{r.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<div className="mt-6 pt-6 border-t border-white/10">
							<div className="flex items-center justify-between mb-3">
								<label className="text-[10px] text-gray-400 uppercase">
									Background
								</label>
								<div className="flex items-center space-x-2">
									<span className="text-[10px] text-gray-500">Transparent</span>
									<Switch
										checked={isTransparent}
										onCheckedChange={setIsTransparent}
										className="data-[state=checked]:bg-blue-600 h-4 w-8"
									/>
								</div>
							</div>
							{!isTransparent && (
								<ColorInput
									value={backgroundColor}
									onChange={setBackgroundColor}
								/>
							)}
						</div>
					</section>

					<div className="flex flex-col items-center justify-center py-12 text-center rounded-lg bg-white/5 border border-dashed border-white/10">
						<MousePointer className="w-10 h-10 text-gray-600 mb-3 opacity-50" />
						<p className="text-sm font-medium text-gray-400">
							No layer selected
						</p>
						<p className="text-xs text-gray-500 mt-1">Select a layer to edit</p>
					</div>
				</div>
			</div>
		);
	}

	const update = (patch: Partial<ExtendedLayer>) => {
		updateLayers((prev) =>
			prev.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)),
		);
	};

	return (
		<ScrollArea className="w-80 border-l border-white/10 bg-neutral-900/95 backdrop-blur-xl z-20 shadow-xl">
			{/* Animation Styles Injection */}
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
				@keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-20px); } 60% { transform: translateY(-10px); } }
				@keyframes shake { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); } 20%, 40%, 60%, 80% { transform: translateX(5px); } }
				.animate-fade-in { animation: fade-in 1s ease-in-out infinite alternate; }
				.animate-fade-out { animation: fade-out 1s ease-in-out infinite alternate; }
				.animate-slide-in-left { animation: slide-in-left 1s ease-in-out infinite alternate; }
				.animate-slide-in-right { animation: slide-in-right 1s ease-in-out infinite alternate; }
				.animate-slide-in-top { animation: slide-in-top 1s ease-in-out infinite alternate; }
				.animate-slide-in-bottom { animation: slide-in-bottom 1s ease-in-out infinite alternate; }
				.animate-zoom-in { animation: zoom-in 1s ease-in-out infinite alternate; }
				.animate-zoom-out { animation: zoom-out 1s ease-in-out infinite alternate; }
				.animate-rotate-cw { animation: rotate-cw 1s linear infinite; }
				.animate-rotate-ccw { animation: rotate-ccw 1s linear infinite; }
				.animate-bounce { animation: bounce 1s ease-in-out infinite; }
				.animate-shake { animation: shake 1s ease-in-out infinite; }
			`}</style>

			<div className="p-4 space-y-6">
				{/* Properties Header */}
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-white truncate max-w-[150px]">
						{selectedLayer.name || selectedLayer.id}
					</h2>
					<div className="flex items-center gap-2">
						<span className="text-[10px] bg-blue-600 px-1.5 py-0.5 rounded text-white font-mono uppercase">
							{selectedLayer.type}
						</span>
						<Button
							size="icon"
							variant="ghost"
							className="h-6 w-6 text-gray-500 hover:text-white"
							onClick={() => setSelectedId(null)}
						>
							<Minus className="w-4 h-4" />
						</Button>
					</div>
				</div>

				<Separator className="bg-white/10" />

				{/* Transform Section */}
				<section>
					<h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
						Transform
					</h3>
					<div className="grid grid-cols-2 gap-3">
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
						<DraggableNumberInput
							label="W"
							icon={MoveHorizontal}
							value={Math.round(selectedLayer.width)}
							onChange={(v) => update({ width: Math.max(1, v) })}
						/>
						<DraggableNumberInput
							label="H"
							icon={MoveVertical}
							value={Math.round(selectedLayer.height)}
							onChange={(v) => update({ height: Math.max(1, v) })}
						/>
						<DraggableNumberInput
							label="Scale"
							icon={Move}
							value={selectedLayer.scale}
							step={0.1}
							onChange={(v) => update({ scale: v })}
							allowDecimal
						/>
						<DraggableNumberInput
							label="Rotate"
							icon={RotateCw}
							value={Math.round(selectedLayer.rotation)}
							onChange={(v) => update({ rotation: v })}
						/>
					</div>
				</section>

				{/* Aspect Lock */}
				{(selectedLayer.type === "Image" || selectedLayer.type === "Video") && (
					<div className="flex items-center space-x-2">
						<Switch
							id="lockAspect"
							checked={selectedLayer.lockAspect ?? true}
							onCheckedChange={(checked) => update({ lockAspect: checked })}
							className="data-[state=checked]:bg-blue-600 h-4 w-8"
						/>
						<label
							htmlFor="lockAspect"
							className="text-[10px] text-gray-400 uppercase cursor-pointer"
						>
							Lock Aspect Ratio
						</label>
					</div>
				)}

				<Separator className="bg-white/10" />

				{/* Animations Section */}
				<section>
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
							<Zap className="w-3 h-3" /> Animations
						</h3>
						<Popover open={addAnimOpen} onOpenChange={setAddAnimOpen}>
							<PopoverTrigger asChild>
								<Button
									variant="ghost"
									className="h-6 text-[10px] w-auto bg-white/5 border border-white/10 px-3 text-gray-300 hover:text-white hover:bg-white/10 rounded-full"
								>
									<Plus className="w-3 h-3 mr-1" /> Add
								</Button>
							</PopoverTrigger>
							<PopoverContent className="bg-neutral-800 border-white/10 text-white w-80 p-3 shadow-xl">
								<div className="grid grid-cols-3 gap-2">
									{animationTypes.map((type) => (
										<Button
											key={type}
											variant="ghost"
											className="flex flex-col items-center p-2 h-auto hover:bg-white/5"
											onClick={() => addAnimation(type)}
										>
											<div
												className={`w-8 h-8 bg-blue-500/20 rounded mb-2 border border-blue-500/50 ${getPreviewAnimationClass(type)}`}
											/>
											<span className="text-[10px] text-center leading-tight">
												{formatAnimationName(type)}
											</span>
										</Button>
									))}
								</div>
							</PopoverContent>
						</Popover>
					</div>

					<div className="space-y-3">
						{!selectedLayer.animations?.length && (
							<div className="text-xs text-gray-600 italic text-center py-4 border border-dashed border-white/5 rounded">
								No animations applied
							</div>
						)}
						{selectedLayer.animations?.map((anim) => (
							<div
								key={anim.id}
								className="bg-black/20 rounded-md p-2.5 border border-white/5 group"
							>
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-medium text-gray-300 capitalize">
										{formatAnimationName(anim.type)}
									</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-5 w-5 opacity-50 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400"
										onClick={() => removeAnimation(anim.id)}
									>
										<Trash2 className="w-3 h-3" />
									</Button>
								</div>
								<div className="flex items-center gap-3">
									<Slider
										value={[anim.value]}
										min={0.1}
										max={5}
										step={0.1}
										onValueChange={([v]) => updateAnimation(anim.id, v)}
										className="flex-1"
									/>
									<span className="text-[10px] font-mono w-8 text-right text-gray-400">
										{Math.round(anim.value * 10) / 10}s
									</span>
								</div>
							</div>
						))}
					</div>
				</section>

				<Separator className="bg-white/10" />

				{/* Timing Section */}
				<section>
					<h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
						Timing
					</h3>
					<div className="grid grid-cols-2 gap-3">
						<DraggableNumberInput
							label="Start"
							value={selectedLayer.startFrame}
							onChange={(v) => update({ startFrame: Math.max(0, v) })}
						/>
						<DraggableNumberInput
							label="Duration"
							value={selectedLayer.durationInFrames}
							onChange={(v) => update({ durationInFrames: Math.max(1, v) })}
						/>
					</div>
				</section>

				<Separator className="bg-white/10" />

				{/* Audio/Typography Section */}
				{(selectedLayer.type === "Video" || selectedLayer.type === "Audio") && (
					<section>
						<h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
							Audio
						</h3>
						<div className="space-y-2">
							<div className="flex items-center justify-between text-xs text-gray-400">
								<span>Volume</span>
								<span className="font-mono">
									{Math.round((selectedLayer.volume ?? 1) * 100)}%
								</span>
							</div>
							<Slider
								value={[selectedLayer.volume ?? 1]}
								max={1}
								step={0.01}
								onValueChange={([v]) => update({ volume: v })}
							/>
						</div>
					</section>
				)}

				{selectedLayer.type === "Text" && (
					<section>
						<h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
							Typography
						</h3>
						<div className="space-y-4">
							<div className="text-xs text-gray-300 italic border border-white/10 p-3 rounded bg-black/20 break-words min-h-[3rem]">
								"{getTextData(selectedLayer.id)}"
							</div>
							<div className="space-y-1.5">
								<label className="text-[10px] text-gray-400 uppercase">
									Font Family
								</label>
								<Select
									value={selectedLayer.fontFamily ?? "Inter"}
									onValueChange={(val) => update({ fontFamily: val })}
								>
									<SelectTrigger className="h-8 text-xs bg-neutral-800 border-white/10">
										<SelectValue placeholder="Select font" />
									</SelectTrigger>
									<SelectContent className="bg-neutral-800 border-white/10 text-white">
										{fontNames.map((f) => (
											<SelectItem key={f} value={f}>
												{f}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<DraggableNumberInput
									label="Size"
									icon={Type}
									value={selectedLayer.fontSize ?? 40}
									onChange={(v) => update({ fontSize: v })}
								/>
								<div className="space-y-1.5">
									<label className="text-[10px] text-gray-400 uppercase">
										Color
									</label>
									<ColorInput
										value={selectedLayer.fill ?? "#fff"}
										onChange={(c) => update({ fill: c })}
									/>
								</div>
							</div>
						</div>
					</section>
				)}

				<Separator className="bg-white/10" />

				<Button
					variant="ghost"
					className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 text-xs"
					onClick={() => deleteLayer(selectedLayer.id)}
				>
					<Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Layer
				</Button>
			</div>
		</ScrollArea>
	);
};

// --- Main Editor Wrapper ---

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

	// State
	const [layers, setLayers] = useState<ExtendedLayer[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [viewportWidth, setViewportWidth] = useState(nodeConfig.width ?? 1920);
	const [viewportHeight, setViewportHeight] = useState(
		nodeConfig.height ?? 1080,
	);
	const [backgroundColor, setBackgroundColorState] = useState(
		nodeConfig.backgroundColor ?? "#000000",
	);
	const [isTransparent, setIsTransparentState] = useState(
		nodeConfig.isTransparent ?? false,
	);
	const [isDirty, setIsDirty] = useState(false);

	// Wrappers for dirty state
	const updateViewportWidth = (w: number) => {
		setViewportWidth(w);
		setIsDirty(true);
	};
	const updateViewportHeight = (h: number) => {
		setViewportHeight(h);
		setIsDirty(true);
	};
	const setBackgroundColor = (color: string) => {
		setBackgroundColorState(color);
		setIsDirty(true);
	};
	const setIsTransparent = (val: boolean) => {
		setIsTransparentState(val);
		setIsDirty(true);
	};

	// Playback & View
	const [currentFrame, setCurrentFrame] = useState(0);
	const [isPlaying, setIsPlayingState] = useState(false);
	const playerRef = useRef<PlayerRef>(null);
	const [zoom, setZoom] = useState(0.5);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
	const [sizeKnown, setSizeKnown] = useState(false);
	const [mode, setMode] = useState<"select" | "pan">("select");
	const lastModeRef = useRef<"select" | "pan">("select");

	// Refs
	const containerRef = useRef<HTMLDivElement>(null);
	const timeRef = useRef<HTMLDivElement>(null);

	// Data Getters
	const getTextData = useCallback(
		(id: string) => {
			const item = initialLayers?.get(id);
			if (item?.type === "Text") {
				return (item as OutputItem<"Text">).data || "Text";
			}
			return "";
		},
		[initialLayers],
	);

	const getAssetUrl = useCallback(
		(id: string) => {
			const item = initialLayers?.get(id);
			if (!item) return undefined;
			const processData = item.data as FileData;
			if (processData?.entity?.id) {
				return GetAssetEndpoint(processData.entity);
			}
			return processData?.processData?.dataUrl;
		},
		[initialLayers],
	);

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
	}, [containerSize, viewportWidth, viewportHeight]);

	// Auto-center Pan
	const centerPan = useCallback(() => {
		if (containerSize.width === 0 || containerSize.height === 0) return;
		const scaledWidth = viewportWidth * zoom;
		const scaledHeight = viewportHeight * zoom;
		const x = (containerSize.width - scaledWidth) / 2;
		const y = (containerSize.height - scaledHeight) / 2;
		setPan({ x, y });
		if (!sizeKnown) setSizeKnown(true);
	}, [containerSize, viewportWidth, viewportHeight, zoom, sizeKnown]);

	useEffect(centerPan, [centerPan]);

	// Resize Observer
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

	// Wheel Zoom
	const handleWheel = useCallback(
		(e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey || mode === "pan") {
				e.preventDefault();

				const el = containerRef.current;
				if (!el) return;

				const rect = el.getBoundingClientRect();
				const pointerX = e.clientX - rect.left;
				const pointerY = e.clientY - rect.top;

				const oldZoom = zoom;
				const zoomSensitivity = 0.0015;
				const delta = -e.deltaY * zoomSensitivity;
				const newZoom = Math.min(Math.max(oldZoom * Math.exp(delta), 0.1), 5);

				if (newZoom !== oldZoom) {
					const mousePointTo = {
						x: (pointerX - pan.x) / oldZoom,
						y: (pointerY - pan.y) / oldZoom,
					};

					const newPan = {
						x: pointerX - mousePointTo.x * newZoom,
						y: pointerY - mousePointTo.y * newZoom,
					};

					setZoom(newZoom);
					setPan(newPan);
				}
			} else {
				setPan((p) => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }));
			}
		},
		[zoom, pan, mode],
	);

	useEffect(() => {
		const el = containerRef.current;
		if (el) {
			el.addEventListener("wheel", handleWheel, { passive: false });
			return () => el.removeEventListener("wheel", handleWheel);
		}
	}, [handleWheel]);

	// Keyboard Shortcuts & Mode
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Space for Pan
			if (e.code === "Space" && !e.repeat) {
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
			}

			// Delete / Backspace
			if (e.key === "Delete" || e.key === "Backspace") {
				if (
					document.activeElement?.tagName === "INPUT" ||
					document.activeElement?.tagName === "TEXTAREA"
				)
					return;
				if (selectedId) {
					deleteLayer(selectedId);
				}
			}

			// Escape to deselect
			if (e.key === "Escape") {
				setSelectedId(null);
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				if (
					document.activeElement?.tagName === "INPUT" ||
					document.activeElement?.tagName === "TEXTAREA"
				)
					return;
				e.preventDefault();
				setMode(lastModeRef.current);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [mode, selectedId]);

	// Initialization
	useEffect(() => {
		const layerUpdates = { ...nodeConfig.layerUpdates };
		const loaded: ExtendedLayer[] = [];
		let maxZ = Math.max(
			0,
			...Object.values(layerUpdates).map((l) => l.zIndex ?? 0),
		);

		if (initialLayers) {
			initialLayers.forEach((item, id) => {
				const saved = layerUpdates[id] as ExtendedLayer | undefined;

				const base = {
					id,
					inputHandleId: id,
					x: 0,
					y: 0,
					width: 400,
					height: 400,
					rotation: 0,
					scale: 1,
					opacity: 1,
					zIndex: saved?.zIndex ?? ++maxZ,
					startFrame: 0,
					durationInFrames: 30 * 5,
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
						width: saved?.width ?? 600,
						height: saved?.height ?? 200,
						lockAspect: false,
						text: "",
					});
				} else if (item.type === "Image" || item.type === "Video") {
					const pData = item.data?.processData;
					loaded.push({
						...base,
						type: item.type as "Image" | "Video",
						src: "",
						width: saved?.width ?? pData?.width ?? 1280,
						height: saved?.height ?? pData?.height ?? 720,
						lockAspect: saved?.lockAspect ?? true,
					});
				} else if (item.type === "Audio") {
					loaded.push({
						...base,
						type: "Audio",
						src: "",
						height: 0,
						width: 0,
						lockAspect: false,
					});
				}
			});
		}

		setLayers(loaded);
	}, [initialLayers, nodeConfig]);

	// Font Loading
	useEffect(() => {
		const loadFonts = async () => {
			const fontPromises: Promise<void>[] = [];
			layers.forEach((layer) => {
				if (layer.type === "Text" && layer.fontFamily) {
					const fontUrl = GetFontAssetUrl(layer.fontFamily);
					fontPromises.push(fontManager.loadFont(layer.fontFamily, fontUrl));
				}
			});
			await Promise.all(fontPromises);
		};
		loadFonts();
	}, [layers]);

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

	const setIsPlaying = (p: boolean) => {
		setIsPlayingState(p);
		if (p) {
			playerRef.current?.play();
		} else {
			playerRef.current?.pause();
			if (playerRef.current) {
				setCurrentFrame(playerRef.current.getCurrentFrame());
			}
		}
	};

	const setCurrentFrameHandler = (frame: number) => {
		setCurrentFrame(frame);
		playerRef.current?.seekTo(frame);
	};

	const durationInFrames = useMemo(() => {
		return Math.max(
			30 * 5,
			...layers.map((l) => l.startFrame + l.durationInFrames),
		);
	}, [layers]);

	const handleSave = () => {
		const layerUpdates = layers.reduce<Record<string, ExtendedLayer>>(
			(acc, layer) => {
				acc[layer.id] = layer;
				return acc;
			},
			{},
		);
		onSave({
			layerUpdates,
			width: viewportWidth,
			height: viewportHeight,
			backgroundColor,
			isTransparent,
		});
		setIsDirty(false);
	};

	useEffect(() => {
		let rafId: number | null = null;
		if (isPlaying) {
			const updateTimeUI = () => {
				if (playerRef.current && timeRef.current) {
					const frame = playerRef.current.getCurrentFrame();
					timeRef.current.textContent = `${Math.floor(frame / FPS)}s : ${(frame % FPS).toString().padStart(2, "0")}f`;
				}
				rafId = requestAnimationFrame(updateTimeUI);
			};
			rafId = requestAnimationFrame(updateTimeUI);
		}
		return () => {
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	}, [isPlaying]);

	return (
		<EditorContext.Provider
			value={{
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
				backgroundColor,
				setBackgroundColor,
				isTransparent,
				setIsTransparent,
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
			}}
		>
			<div className="flex flex-col h-screen w-full bg-black text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30">
				<div className="flex flex-1 min-h-0 relative">
					{/* Viewport Area */}
					<div
						ref={containerRef}
						className="flex-1 relative overflow-hidden bg-[#0a0a0a]"
						style={
							{
								"--checker-color": "rgba(255, 255, 255, 0.07)",
								"--checker-size": "40px",
							} as React.CSSProperties
						}
						onMouseDown={() => setSelectedId(null)}
					>
						{/* Subtle Grid Pattern */}
						<div
							className="absolute inset-0 pointer-events-none opacity-[0.03]"
							style={{
								backgroundImage:
									"linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
								backgroundSize: "40px 40px",
							}}
						/>

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
								className="shadow-2xl media-container relative ring-1 ring-white/10"
								style={{
									width: viewportWidth,
									height: viewportHeight,
									// Show checkerboard if transparent
									backgroundImage: isTransparent
										? `
                      linear-gradient(45deg, #1a1a1a 25%, transparent 25%), 
                      linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), 
                      linear-gradient(45deg, transparent 75%, #1a1a1a 75%), 
                      linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)
                    `
										: undefined,
									backgroundColor: isTransparent ? "#0f0f0f" : "#000",
									backgroundSize: isTransparent ? "20px 20px" : undefined,
									backgroundPosition: isTransparent
										? "0 0, 0 10px, 10px -10px, -10px 0px"
										: undefined,
								}}
							>
								<Player
									ref={playerRef}
									component={CompositionScene}
									inputProps={{ layers }}
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

					{/* Floating Toolbar */}
					<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300">
						<Toolbar onClose={onClose} onSave={handleSave} timeRef={timeRef} />
					</div>
				</div>

				<TimelinePanel />
			</div>
		</EditorContext.Provider>
	);
};
