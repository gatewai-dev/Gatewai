import type {
	FileData,
	OutputItem,
	VideoCompositorNodeConfig,
} from "@gatewai/types";
import { Player, type PlayerRef } from "@remotion/player";
import {
	Film,
	Image as ImageIcon,
	Music,
	Pause,
	Play,
	Type,
	Volume2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import React, {
	createContext,
	type Dispatch,
	type SetStateAction,
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
	OffthreadVideo,
	Sequence,
} from "remotion";
import { Button } from "@/components/ui/button";
import { DraggableNumberInput } from "@/components/ui/draggable-number-input";
import { Input } from "@/components/ui/input";
import { Menubar } from "@/components/ui/menubar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ColorInput } from "@/components/util/color-input";
import type { NodeEntityType } from "@/store/nodes";

type LayerType = "Text" | "Image" | "Video" | "Audio";

interface VideoLayer {
	id: string;
	type: LayerType;
	inputHandleId: string;
	// Spatial
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	scale: number;
	opacity: number;
	zIndex: number;
	// Temporal

	startFrame: number;
	durationInFrames: number;
	// Media Specific

	src?: string;
	volume?: number; // 0-1

	// Text Specific
	text?: string;
	fontFamily?: string;
	fontSize?: number;
	fill?: string;
	align?: "left" | "center" | "right";
	// Metadata
	lockAspect?: boolean;
}

interface EditorContextType {
	layers: VideoLayer[];
	updateLayers: (
		updater: SetStateAction<VideoLayer[]>,
		isUserChange?: boolean,
	) => void;
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;
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
	// UI State
	zoom: number;
	setZoom: Dispatch<SetStateAction<number>>;
	pan: { x: number; y: number };
	setPan: Dispatch<SetStateAction<{ x: number; y: number }>>;
	// Helpers
	getAssetUrl: (handleId: string) => string | undefined;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);
const useEditor = () => {
	const ctx = useContext(EditorContext);
	if (!ctx) throw new Error("useEditor must be used within EditorProvider");
	return ctx;
};

// --- Utils ---

// Use gemini's default FPS
const FPS = 24;

/**
 * The actual Remotion Scene that gets rendered inside the Player.
 * It maps the state layers to Remotion primitives.
 */
const CompositionScene: React.FC<{
	layers: VideoLayer[];
}> = ({ layers }) => {
	// Sort by zIndex
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => a.zIndex - b.zIndex),
		[layers],
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{sortedLayers.map((layer) => {
				const style: React.CSSProperties = {
					position: "absolute",
					left: layer.x,
					top: layer.y,
					width: layer.width,
					height: layer.height,
					transform: `rotate(${layer.rotation}deg) scale(${layer.scale})`,
					opacity: layer.opacity,
					textAlign: layer.align,
				};

				return (
					<Sequence
						key={layer.id}
						from={layer.startFrame}
						durationInFrames={layer.durationInFrames}
					>
						{layer.type === "Video" && layer.src && (
							<OffthreadVideo
								src={layer.src}
								style={{ ...style, objectFit: "cover" }}
								volume={layer.volume ?? 1}
							/>
						)}
						{layer.type === "Image" && layer.src && (
							<Img src={layer.src} style={{ ...style, objectFit: "cover" }} />
						)}
						{layer.type === "Audio" && layer.src && (
							<Html5Audio src={layer.src} volume={layer.volume ?? 1} />
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
								}}
							>
								{layer.text}
							</div>
						)}
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

// --- Components: Interaction Overlay ---

/**
 * A transparent overlay that sits ON TOP of the Remotion Player.
 * It handles mouse clicks, dragging, and resizing for the selected element.
 * We do this because the Player usually consumes events or is non-interactive.
 */
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
	} = useEditor();

	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

	// Filter layers visible at current frame
	const visibleLayers = useMemo(() => {
		return layers
			.filter(
				(l) =>
					l.type !== "Audio" && // Audio isn't visual
					currentFrame >= l.startFrame &&
					currentFrame < l.startFrame + l.durationInFrames,
			)
			.sort((a, b) => b.zIndex - a.zIndex); // Hit test top-most first
	}, [layers, currentFrame]);

	const selectedLayer = layers.find((l) => l.id === selectedId);

	const handleMouseDown = (e: React.MouseEvent, layerId?: string) => {
		if (e.button !== 0) return; // Only left click
		e.stopPropagation();

		if (layerId) {
			setSelectedId(layerId);
			const layer = layers.find((l) => l.id === layerId);
			if (layer) {
				setIsDragging(true);
				setDragStart({ x: e.clientX, y: e.clientY });
				setInitialPos({ x: layer.x, y: layer.y });
			}
		} else {
			// Clicked empty space
			setSelectedId(null);
		}
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
		}
	};

	const handleMouseUp = () => {
		setIsDragging(false);
	};

	return (
		<div
			className="absolute inset-0 z-10 overflow-hidden"
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseUp}
			onMouseDown={(e) => handleMouseDown(e, undefined)}
		>
			<div
				className="absolute origin-top-left"
				style={{
					width: viewportWidth,
					height: viewportHeight,
					transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
				}}
			>
				{/* Render Bounding Boxes for Hit Testing */}
				{visibleLayers.map((layer) => (
					<div
						key={layer.id}
						onMouseDown={(e) => handleMouseDown(e, layer.id)}
						className={`absolute cursor-move group border hover:border-blue-400 ${
							selectedId === layer.id ? "border-blue-500" : "border-transparent"
						}`}
						style={{
							left: layer.x,
							top: layer.y,
							width: layer.width,
							height: layer.height,
							transform: `rotate(${layer.rotation}deg) scale(${layer.scale})`,
						}}
					>
						{/* Simple Resize Handle (Bottom Right) if selected */}
						{selectedId === layer.id && (
							<div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white rounded-full cursor-nwse-resize" />
						)}
					</div>
				))}
			</div>
		</div>
	);
};

// --- Components: Timeline ---

const RULER_HEIGHT = 24;
const TRACK_HEIGHT = 32;
const PIXELS_PER_FRAME = 5; // Zoom level of timeline

const TimelinePanel: React.FC = () => {
	const {
		layers,
		updateLayers,
		durationInFrames,
		currentFrame,
		setCurrentFrame,
		playerRef,
		isPlaying,
		setIsPlaying,
		selectedId,
		setSelectedId,
	} = useEditor();

	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// Sync playhead scrolling
	useEffect(() => {
		if (isPlaying && scrollContainerRef.current) {
			const x = currentFrame * PIXELS_PER_FRAME;
			const center = scrollContainerRef.current.clientWidth / 2;
			if (x > center) {
				scrollContainerRef.current.scrollLeft = x - center;
			}
		}
	}, [currentFrame, isPlaying]);

	const handleTimelineClick = (e: React.MouseEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const clickX =
			e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
		const frame = Math.max(0, Math.floor(clickX / PIXELS_PER_FRAME));

		if (playerRef.current) {
			playerRef.current.seekTo(frame);
		}
		setCurrentFrame(frame);
	};

	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => b.zIndex - a.zIndex),
		[layers],
	);

	// Dragging clips on timeline
	const handleClipDrag = (e: React.MouseEvent, layerId: string) => {
		e.stopPropagation();
		const startX = e.clientX;
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;
		const initialStart = layer.startFrame;

		const onMove = (moveEv: MouseEvent) => {
			const diffPx = moveEv.clientX - startX;
			const diffFrames = Math.round(diffPx / PIXELS_PER_FRAME);
			const newStart = Math.max(0, initialStart + diffFrames);

			updateLayers(
				(prev) =>
					prev.map((l) =>
						l.id === layerId ? { ...l, startFrame: newStart } : l,
					),
				false,
			);
		};

		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	// Trim handle
	const handleTrim = (e: React.MouseEvent, layerId: string, side: "right") => {
		e.stopPropagation();
		const startX = e.clientX;
		const layer = layers.find((l) => l.id === layerId);
		if (!layer) return;
		const initialDuration = layer.durationInFrames;

		const onMove = (moveEv: MouseEvent) => {
			const diffPx = moveEv.clientX - startX;
			const diffFrames = Math.round(diffPx / PIXELS_PER_FRAME);
			const newDuration = Math.max(1, initialDuration + diffFrames); // Min 1 frame

			updateLayers(
				(prev) =>
					prev.map((l) =>
						l.id === layerId ? { ...l, durationInFrames: newDuration } : l,
					),
				false,
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
		<div className="h-64 flex flex-col border-t bg-background shrink-0 select-none">
			{/* Timeline Toolbar */}
			<div className="h-10 border-b flex items-center px-4 justify-between bg-muted/30">
				<div className="flex items-center gap-2">
					<span className="text-xs font-mono text-muted-foreground">
						{Math.floor(currentFrame / FPS)}s : {currentFrame % FPS}f
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => {
							if (playerRef.current) {
								if (isPlaying) playerRef.current.pause();
								else playerRef.current.play();
								setIsPlaying(!isPlaying);
							}
						}}
					>
						{isPlaying ? (
							<Pause className="h-4 w-4" />
						) : (
							<Play className="h-4 w-4" />
						)}
					</Button>
				</div>
				<div className="w-20" /> {/* Spacer */}
			</div>

			<div className="flex flex-1 overflow-hidden">
				{/* Track Headers (Left) */}
				<div className="w-48 border-r bg-card shrink-0 z-20 shadow-sm overflow-y-hidden">
					<div
						style={{ height: RULER_HEIGHT }}
						className="border-b bg-muted/50"
					/>
					<div className="flex flex-col">
						{sortedLayers.map((layer) => (
							<div
								key={layer.id}
								style={{ height: TRACK_HEIGHT }}
								className={`
                                    border-b flex items-center px-2 text-xs gap-2 cursor-pointer
                                    ${layer.id === selectedId ? "bg-blue-500/10" : "hover:bg-accent"}
                                `}
								onClick={() => setSelectedId(layer.id)}
							>
								{layer.type === "Video" && (
									<Film className="w-3 h-3 text-blue-400" />
								)}
								{layer.type === "Image" && (
									<ImageIcon className="w-3 h-3 text-purple-400" />
								)}
								{layer.type === "Text" && (
									<Type className="w-3 h-3 text-green-400" />
								)}
								{layer.type === "Audio" && (
									<Music className="w-3 h-3 text-orange-400" />
								)}
								<span className="truncate">{layer.id}</span>
							</div>
						))}
					</div>
				</div>

				{/* Timeline Tracks (Right) */}
				<ScrollArea className="flex-1 relative" ref={scrollContainerRef}>
					<div
						className="relative min-w-full"
						style={{ width: durationInFrames * PIXELS_PER_FRAME }}
					>
						{/* Ruler */}
						<div
							className="sticky top-0 z-10 bg-background/95 border-b cursor-pointer"
							style={{ height: RULER_HEIGHT }}
							onClick={handleTimelineClick}
						>
							{Array.from({ length: Math.ceil(durationInFrames / FPS) }).map(
								(_, sec) => (
									<div
										key={`${sec}_ruler_seconds`}
										className="absolute top-0 bottom-0 border-l border-border/50 text-[10px] pl-1 text-muted-foreground"
										style={{ left: sec * FPS * PIXELS_PER_FRAME }}
									>
										{sec}s
									</div>
								),
							)}
							{/* Playhead */}
							<div
								className="absolute top-0 h-screen w-px bg-red-500 z-50 pointer-events-none"
								style={{ left: currentFrame * PIXELS_PER_FRAME }}
							>
								<div className="w-3 h-3 -ml-1.5 bg-red-500 transform rotate-45 -mt-1.5" />
							</div>
						</div>

						{/* Tracks Area */}
						<div className="relative">
							{/* Background Grid */}
							<div
								className="absolute inset-0 pointer-events-none"
								style={{
									backgroundImage:
										"linear-gradient(90deg, var(--border) 1px, transparent 1px)",
									backgroundSize: `${FPS * PIXELS_PER_FRAME}px 100%`,
									opacity: 0.1,
								}}
							/>

							{sortedLayers.map((layer) => (
								<div
									key={layer.id}
									style={{ height: TRACK_HEIGHT }}
									className="border-b relative"
								>
									{/** biome-ignore lint/a11y/noStaticElementInteractions: TODO */}
									{/** biome-ignore lint/a11y/useKeyWithClickEvents: TODO */}
									<div
										className={`
                                            absolute top-1 bottom-1 rounded-sm border opacity-90
                                            flex items-center overflow-hidden
                                            ${layer.id === selectedId ? "ring-2 ring-white" : ""}
                                        `}
										style={{
											left: layer.startFrame * PIXELS_PER_FRAME,
											width: layer.durationInFrames * PIXELS_PER_FRAME,
											backgroundColor:
												layer.type === "Video"
													? "#1e3a8a"
													: layer.type === "Image"
														? "#581c87"
														: layer.type === "Text"
															? "#14532d"
															: "#7c2d12",
											borderColor: "rgba(255,255,255,0.2)",
										}}
										onMouseDown={(e) => handleClipDrag(e, layer.id)}
										onClick={(e) => {
											e.stopPropagation();
											setSelectedId(layer.id);
										}}
									>
										{/* Clip Label */}
										<span className="text-[10px] px-2 truncate text-white/90 drop-shadow-md select-none">
											{layer.id}
										</span>

										{/* Resize Handle Right */}
										<div
											className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/20"
											onMouseDown={(e) => handleTrim(e, layer.id, "right")}
										/>
									</div>
								</div>
							))}
						</div>
					</div>
					<ScrollBar orientation="horizontal" />
				</ScrollArea>
			</div>
		</div>
	);
};

// --- Components: Panels (Layers & Inspector) ---

const LayersPanel: React.FC = () => {
	// Reusing DndContext logic from previous file would go here for vertical reordering
	// Simplified for brevity to just a list for this example
	const { layers, selectedId, setSelectedId } = useEditor();
	const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);

	return (
		<div className="w-60 bg-card border-r flex flex-col z-20">
			<div className="p-3 border-b text-xs font-semibold uppercase text-muted-foreground">
				Layers
			</div>
			<div className="flex-1 overflow-y-auto p-2 space-y-1">
				{sortedLayers.map((l) => (
					<Button
						key={l.id}
						variant={selectedId === l.id ? "secondary" : "ghost"}
						className="w-full justify-start h-8 text-xs"
						onClick={() => setSelectedId(l.id)}
					>
						{l.type === "Video" ? (
							<Film className="mr-2 h-3 w-3" />
						) : l.type === "Image" ? (
							<ImageIcon className="mr-2 h-3 w-3" />
						) : l.type === "Text" ? (
							<Type className="mr-2 h-3 w-3" />
						) : (
							<Music className="mr-2 h-3 w-3" />
						)}
						{l.id}
					</Button>
				))}
			</div>
		</div>
	);
};

const InspectorPanel: React.FC = () => {
	const { selectedId, layers, updateLayers } = useEditor();
	const selectedLayer = layers.find((l) => l.id === selectedId);

	if (!selectedLayer)
		return (
			<div className="w-64 border-l bg-card p-4 text-xs text-muted-foreground text-center">
				No Selection
			</div>
		);

	const update = (patch: Partial<VideoLayer>) => {
		updateLayers((prev) =>
			prev.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)),
		);
	};

	return (
		<div className="w-64 bg-card border-l flex flex-col overflow-y-auto z-20">
			<div className="p-4 space-y-6">
				<section>
					<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
						Transform
					</h3>
					<div className="grid grid-cols-2 gap-2">
						<DraggableNumberInput
							label="X"
							value={selectedLayer.x}
							onChange={(v) => update({ x: v })}
						/>
						<DraggableNumberInput
							label="Y"
							value={selectedLayer.y}
							onChange={(v) => update({ y: v })}
						/>
						<DraggableNumberInput
							label="Scale"
							value={selectedLayer.scale}
							step={0.1}
							onChange={(v) => update({ scale: v })}
						/>
						<DraggableNumberInput
							label="Rotate"
							value={selectedLayer.rotation}
							onChange={(v) => update({ rotation: v })}
						/>
					</div>
				</section>

				<Separator />

				<section>
					<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
						Timing
					</h3>
					<div className="grid grid-cols-2 gap-2">
						<DraggableNumberInput
							label="Start"
							value={selectedLayer.startFrame}
							onChange={(v) => update({ startFrame: Math.max(0, v) })}
						/>
						<DraggableNumberInput
							label="Dur"
							value={selectedLayer.durationInFrames}
							onChange={(v) => update({ durationInFrames: Math.max(1, v) })}
						/>
					</div>
				</section>

				<Separator />

				{(selectedLayer.type === "Video" || selectedLayer.type === "Audio") && (
					<section>
						<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
							Audio
						</h3>
						<div className="flex items-center gap-2">
							<Volume2 className="h-4 w-4 text-muted-foreground" />
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
						<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
							Typography
						</h3>
						<Input
							value={selectedLayer.text}
							onChange={(e) => update({ text: e.target.value })}
							className="mb-2 h-8 text-xs"
						/>
						<div className="grid grid-cols-2 gap-2">
							<DraggableNumberInput
								label="Size"
								value={selectedLayer.fontSize ?? 40}
								onChange={(v) => update({ fontSize: v })}
							/>
							<ColorInput
								value={selectedLayer.fill ?? "#fff"}
								onChange={(c) => update({ fill: c })}
							/>
						</div>
					</section>
				)}
			</div>
		</div>
	);
};

// --- Main Editor Wrapper ---

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
	// --- State Initialization ---
	// Normally we'd parse node.config, but simplifying for the example
	const [layers, setLayers] = useState<VideoLayer[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [viewportWidth, setViewportWidth] = useState(1280);
	const [viewportHeight, setViewportHeight] = useState(720);

	// Playback State
	const [currentFrame, setCurrentFrame] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const playerRef = useRef<PlayerRef>(null);

	// Viewport State
	const [zoom, setZoom] = useState(0.5); // Initial zoom to fit
	const [pan, setPan] = useState({ x: 100, y: 50 }); // Initial padding

	// Load Layers
	useEffect(() => {
		const loaded: VideoLayer[] = [];
		let zIndex = 0;

		initialLayers.forEach((item, id) => {
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
				zIndex: zIndex++,
				startFrame: 0,
				durationInFrames: 30 * 5, // 5 seconds default
				volume: 1,
			};

			if (item.type === "Text") {
				loaded.push({
					...base,
					type: "Text",
					text: (item as any).data || "Hello World",
					fontSize: 60,
					fontFamily: "Inter",
					fill: "#ffffff",
					width: 600,
					height: 200,
				});
			} else if (item.type === "Image" || item.type === "Video") {
				// Mock getting URL
				const src = item.data?.processData?.dataUrl || "";
				loaded.push({
					...base,
					type: item.type as "Image" | "Video",
					src,
					width: item.data?.processData?.width || 1280,
					height: item.data?.processData?.height || 720,
				});
			} else if (item.type === "Audio") {
				loaded.push({
					...base,
					type: "Audio",
					src: item.data?.processData?.dataUrl || "",
					height: 0,
					width: 0,
				});
			}
		});
		setLayers(loaded);
	}, [initialLayers]);

	// Player Frame Sync
	useEffect(() => {
		if (!playerRef.current) return;
		const handleFrameUpdate = (e: { frame: number }) => {
			setCurrentFrame(e.frame);
		};

		// Remotion player doesn't have a direct 'onFrame' event that fires React state often for performance.
		// We use an interval when playing to update UI, or hook into Player's listener if available (simplified here).
		let interval: NodeJS.Timeout;
		if (isPlaying) {
			interval = setInterval(() => {
				if (playerRef.current) {
					setCurrentFrame(playerRef.current.getCurrentFrame());
				}
			}, 1000 / 30);
		}
		return () => clearInterval(interval);
	}, [isPlaying]);

	const contextValue: EditorContextType = {
		layers,
		updateLayers: (updater) => setLayers(updater),
		selectedId,
		setSelectedId,
		viewportWidth,
		viewportHeight,
		updateViewportWidth: setViewportWidth,
		updateViewportHeight: setViewportHeight,
		fps: FPS,
		durationInFrames: 30 * 30, // 30 sec cap for example
		currentFrame,
		setCurrentFrame: (f) => {
			setCurrentFrame(f);
			playerRef.current?.seekTo(f);
		},
		isPlaying,
		setIsPlaying: (p) => {
			setIsPlaying(p);
			if (p) playerRef.current?.play();
			else playerRef.current?.pause();
		},
		playerRef,
		zoom,
		setZoom,
		pan,
		setPan,
		getAssetUrl: () => "", // simplified
	};

	return (
		<EditorContext.Provider value={contextValue}>
			<div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
				{/* Main Workspace Row */}
				<div className="flex flex-1 min-h-0">
					<LayersPanel />

					{/* Viewport Area */}
					<div className="flex-1 bg-neutral-900 relative overflow-hidden flex flex-col">
						<div className="flex-1 relative overflow-hidden">
							<div
								className="absolute origin-top-left"
								style={{
									transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
									width: viewportWidth,
									height: viewportHeight,
								}}
							>
								<div
									className="shadow-2xl relative"
									style={{ width: viewportWidth, height: viewportHeight }}
								>
									{/* Remotion Player */}
									<Player
										ref={playerRef}
										component={CompositionScene}
										inputProps={{ layers }}
										durationInFrames={30 * 60}
										fps={FPS}
										compositionWidth={viewportWidth}
										compositionHeight={viewportHeight}
										style={{ width: "100%", height: "100%" }}
										controls={false} // Custom controls in timeline
										doubleClickToFullscreen={false}
									/>
								</div>
							</div>

							{/* Overlay for interactivity */}
							<InteractionOverlay />
						</div>

						{/* Mini Toolbar (Zoom/Pan) */}
						<div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
							<Menubar className="bg-background/80 backdrop-blur rounded-full px-2 shadow-lg">
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setZoom((z) => z - 0.1)}
								>
									<ZoomOut className="w-4 h-4" />
								</Button>
								<span className="text-xs px-2">{Math.round(zoom * 100)}%</span>
								<Button
									variant="ghost"
									size="icon"
									onClick={() => setZoom((z) => z + 0.1)}
								>
									<ZoomIn className="w-4 h-4" />
								</Button>
							</Menubar>
						</div>
					</div>

					<InspectorPanel />
				</div>

				{/* Bottom Timeline */}
				<TimelinePanel />
			</div>
		</EditorContext.Provider>
	);
};
