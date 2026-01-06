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
	Image as ImageIcon,
	Music,
	Pause,
	Play,
	Type,
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
	OffthreadVideo,
	Sequence,
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ColorInput } from "@/components/util/color-input";
import { GetAssetEndpoint } from "@/utils/file";

// --- Types & Context ---

interface EditorContextType {
	// State
	layers: VideoCompositorLayer[];
	updateLayers: (
		updater: SetStateAction<VideoCompositorLayer[]>,
		isUserChange?: boolean,
	) => void;
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;

	// Data Getters (Source of Truth)
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
const RULER_HEIGHT = 28;
const TRACK_HEIGHT = 40;
const PIXELS_PER_FRAME = 5;

// --- Components: Rendering Engine (Remotion) ---

const CompositionScene: React.FC<{
	layers: VideoCompositorLayer[];
}> = ({ layers }) => {
	const { getTextData, getAssetUrl } = useEditor();

	// Sort by zIndex ascending for rendering (lowest zIndex = background)
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			{sortedLayers.map((layer) => {
				const src = getAssetUrl(layer.inputHandleId);
				const textContent = getTextData(layer.inputHandleId);
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
						{layer.type === "Video" && src && (
							<OffthreadVideo
								src={src}
								style={{ ...style, objectFit: "cover" }}
								volume={layer.volume ?? 1}
							/>
						)}
						{layer.type === "Image" && src && (
							<Img src={src} style={{ ...style, objectFit: "cover" }} />
						)}
						{layer.type === "Audio" && src && (
							<Html5Audio src={src} volume={layer.volume ?? 1} />
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
	} = useEditor();

	const [isDragging, setIsDragging] = useState(false);
	const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
	const [initialPos, setInitialPos] = useState({ x: 0, y: 0 });

	const visibleLayers = useMemo(() => {
		return layers
			.filter(
				(l) =>
					l.type !== "Audio" &&
					currentFrame >= l.startFrame &&
					currentFrame < l.startFrame + l.durationInFrames,
			)
			.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
	}, [layers, currentFrame]);

	const handleMouseDown = (e: React.MouseEvent, layerId?: string) => {
		if (e.button !== 0) return;
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
				{visibleLayers.map((layer) => (
					<div
						key={layer.id}
						role="button"
						tabIndex={0}
						onMouseDown={(e) => handleMouseDown(e, layer.id)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") setSelectedId(layer.id);
						}}
						className={`absolute cursor-move group border-2 outline-none ${
							selectedId === layer.id
								? "border-blue-500 z-50"
								: "border-transparent hover:border-blue-400/50"
						}`}
						style={{
							left: layer.x,
							top: layer.y,
							width: layer.width,
							height: layer.height,
							transform: `rotate(${layer.rotation}deg) scale(${layer.scale})`,
						}}
					>
						{selectedId === layer.id && (
							<>
								<div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-sm" />
								<div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-sm" />
								<div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-sm" />
								<div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-sm cursor-nwse-resize" />
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
	} = useEditor();
	const zoomPercentage = `${Math.round(zoom * 100)}%`;

	return (
		<Menubar className="border border-border/50 bg-background/80 backdrop-blur-md shadow-2xl rounded-full px-2 py-1 h-12 ring-1 ring-white/5 flex items-center gap-1">
			<Button
				variant="ghost"
				size="icon"
				className="rounded-full w-9 h-9"
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
					<Play className="w-4 h-4 fill-current" />
				)}
			</Button>
			<div
				ref={timeRef}
				className="text-xs font-mono bg-background border rounded px-2 py-1 min-w-[80px] text-center"
			>
				{Math.floor(currentFrame / fps)}s :{" "}
				{(currentFrame % fps).toString().padStart(2, "0")}f
			</div>

			<div className="w-px h-5 bg-border mx-1" />

			<MenubarMenu>
				<MenubarTrigger asChild>
					<Button
						variant="ghost"
						className="h-9 px-3 text-xs font-mono rounded-full"
					>
						{zoomPercentage} <ChevronDown className="w-3 h-3 ml-2 opacity-50" />
					</Button>
				</MenubarTrigger>
				<MenubarContent align="center" className="min-w-[140px]">
					<MenubarItem onClick={zoomIn}>Zoom In</MenubarItem>
					<MenubarItem onClick={zoomOut}>Zoom Out</MenubarItem>
					<MenubarItem onClick={() => zoomTo(1)}>
						Actual Size (100%)
					</MenubarItem>
					<MenubarItem onClick={() => zoomTo(0.5)}>50%</MenubarItem>
					<Separator className="my-1" />
					<MenubarItem onClick={fitView}>Fit to Screen</MenubarItem>
				</MenubarContent>
			</MenubarMenu>

			<Separator orientation="vertical" className="mx-1 h-5" />

			<Button
				size="sm"
				className="h-8 text-xs rounded-full px-4"
				onClick={onSave}
				disabled={!isDirty}
			>
				Save
			</Button>
			<Button
				size="sm"
				variant="ghost"
				className="h-8 text-xs rounded-full px-3 ml-1 hover:bg-destructive/20 hover:text-destructive"
				onClick={onClose}
			>
				Close
			</Button>
		</Menubar>
	);
});

// --- Components: Timeline Tracks (Sortable) ---

interface SortableTrackProps {
	layer: VideoCompositorLayer;
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
		zIndex: isDragging ? 999 : "auto",
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			role="button"
			tabIndex={0}
			className={`
				border-b flex items-center pl-2 pr-3 text-xs gap-2 group bg-card outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary
				${isSelected ? "bg-accent/50 text-accent-foreground" : "hover:bg-accent/20"}
				${isDragging ? "opacity-50 ring-2 ring-primary inset-0 z-50 bg-background" : ""}
			`}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") onSelect();
			}}
		>
			<div
				{...attributes}
				{...listeners}
				className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
			>
				<GripVertical className="h-3 w-3" />
			</div>
			<div className="flex-1 flex items-center gap-2 min-w-0">
				{layer.type === "Video" && <Film className="w-3 h-3 text-blue-400" />}
				{layer.type === "Image" && (
					<ImageIcon className="w-3 h-3 text-purple-400" />
				)}
				{layer.type === "Text" && <Type className="w-3 h-3 text-green-400" />}
				{layer.type === "Audio" && (
					<Music className="w-3 h-3 text-orange-400" />
				)}
				<span className="truncate font-medium">{layer.id}</span>
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

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const playheadRef = useRef<HTMLDivElement>(null);

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
				const map = new Map(updatedLayers.map((l) => [l.id, l]));
				return prev.map((l) => (map.has(l.id) ? map.get(l.id)! : l));
			});
		}
	};

	useEffect(() => {
		if (!isPlaying && playheadRef.current) {
			playheadRef.current.style.left = `${currentFrame * PIXELS_PER_FRAME}px`;
		}
	}, [currentFrame, isPlaying]);

	useEffect(() => {
		if (scrollContainerRef.current && !isPlaying) {
			const x = currentFrame * PIXELS_PER_FRAME;
			const center = scrollContainerRef.current.clientWidth / 2;
			if (x > center + scrollContainerRef.current.scrollLeft) {
				scrollContainerRef.current.scrollLeft = x - center;
			}
		}
	}, [currentFrame, isPlaying]);

	useEffect(() => {
		let rafId: number | null = null;

		if (isPlaying) {
			const updatePlaybackUI = () => {
				if (playerRef.current) {
					const frame = playerRef.current.getCurrentFrame();

					if (playheadRef.current) {
						playheadRef.current.style.left = `${frame * PIXELS_PER_FRAME}px`;
					}

					if (scrollContainerRef.current) {
						const x = frame * PIXELS_PER_FRAME;
						const center = scrollContainerRef.current.clientWidth / 2;
						if (x > center + scrollContainerRef.current.scrollLeft) {
							scrollContainerRef.current.scrollLeft = x - center;
						}
					}
				}

				rafId = requestAnimationFrame(updatePlaybackUI);
			};

			rafId = requestAnimationFrame(updatePlaybackUI);
		}

		return () => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
		};
	}, [isPlaying, playerRef, fps]);

	const handleTimelineClick = (e: React.MouseEvent) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const clickX =
			e.clientX - rect.left + (scrollContainerRef.current?.scrollLeft || 0);
		const frame = Math.max(0, Math.floor(clickX / PIXELS_PER_FRAME));
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
			const diffFrames = Math.round(diffPx / PIXELS_PER_FRAME);
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
			const diffFrames = Math.round(diffPx / PIXELS_PER_FRAME);
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
		<div className="h-72 flex flex-col border-t bg-background shrink-0 select-none z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
			<div className="flex flex-1 overflow-hidden">
				{/* Track Headers */}
				<div className="w-60 border-r bg-muted/10 shrink-0 z-20 flex flex-col">
					<div
						style={{ height: RULER_HEIGHT }}
						className="border-b bg-muted/50 flex items-center px-2 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold"
					>
						Tracks
					</div>
					<div className="flex-1 overflow-y-hidden">
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
				</div>

				{/* Timeline Tracks */}
				<ScrollArea
					className="flex-1 relative bg-neutral-900/50"
					ref={scrollContainerRef}
				>
					<div
						className="relative min-w-full"
						style={{ width: durationInFrames * PIXELS_PER_FRAME }}
					>
						{/* Ruler */}
						<div
							role="button"
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleTimelineClick(e as any);
							}}
							className="sticky top-0 z-10 bg-background/95 border-b cursor-pointer shadow-sm outline-none"
							style={{ height: RULER_HEIGHT }}
							onClick={handleTimelineClick}
						>
							{Array.from({ length: Math.ceil(durationInFrames / FPS) }).map(
								(_, sec) => (
									<div
										key={`${sec}_ruler`}
										className="absolute top-0 bottom-0 border-l border-border/50 text-[9px] pl-1 text-muted-foreground pt-1"
										style={{ left: sec * FPS * PIXELS_PER_FRAME }}
									>
										{sec}s
									</div>
								),
							)}
							{/* Playhead */}
							<div
								ref={playheadRef}
								className="absolute top-0 h-screen w-px bg-red-500 z-50 pointer-events-none"
								style={{ left: currentFrame * PIXELS_PER_FRAME }}
							>
								<div className="w-2.5 h-2.5 -ml-[4.5px] bg-red-500 transform rotate-45 -mt-1 shadow-sm" />
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
									opacity: 0.05,
								}}
							/>

							{sortedLayers.map((layer) => (
								<div
									key={layer.id}
									style={{ height: TRACK_HEIGHT }}
									className={`border-b border-white/5 relative ${layer.id === selectedId ? "bg-white/5" : ""}`}
								>
									<div
										role="button"
										tabIndex={0}
										className={`
											absolute top-1 bottom-1 rounded-sm border opacity-90
											flex items-center overflow-hidden cursor-move outline-none
											${layer.id === selectedId ? "ring-1 ring-white shadow-lg z-10" : "hover:opacity-100"}
										`}
										style={{
											left: layer.startFrame * PIXELS_PER_FRAME,
											width: layer.durationInFrames * PIXELS_PER_FRAME,
											backgroundColor:
												layer.type === "Video"
													? "#1d4ed8"
													: layer.type === "Image"
														? "#7e22ce"
														: layer.type === "Text"
															? "#15803d"
															: "#c2410c",
											borderColor: "rgba(255,255,255,0.15)",
										}}
										onMouseDown={(e) => handleClipDrag(e, layer.id)}
										onClick={(e) => {
											e.stopPropagation();
											setSelectedId(layer.id);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.stopPropagation();
												setSelectedId(layer.id);
											}
										}}
									>
										<span className="text-[10px] px-2 truncate text-white/90 font-medium drop-shadow-md select-none">
											{layer.id}
										</span>
										{/* Resize Handle */}
										<div
											role="button"
											tabIndex={0}
											aria-label="Trim clip"
											className="absolute right-0 top-0 bottom-0 w-3 cursor-e-resize hover:bg-white/20 transition-colors"
											onMouseDown={(e) => handleTrim(e, layer.id)}
											onKeyDown={() => {}} // Keyboard trim could be added here
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

// --- Components: Inspector ---

const InspectorPanel: React.FC = () => {
	const { selectedId, layers, updateLayers, getTextData } = useEditor();
	const selectedLayer = layers.find((l) => l.id === selectedId);

	if (!selectedLayer)
		return (
			<div className="w-72 border-l bg-card flex items-center justify-center p-8 text-center">
				<div className="text-muted-foreground space-y-2">
					<p className="text-xs">Select a layer to edit properties</p>
				</div>
			</div>
		);

	const update = (patch: Partial<VideoCompositorLayer>) => {
		updateLayers((prev) =>
			prev.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)),
		);
	};

	return (
		<div className="w-72 bg-card border-l flex flex-col overflow-y-auto z-20 shadow-xl">
			<div className="p-4 space-y-6">
				<section>
					<h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
						Transform
					</h3>
					<div className="grid grid-cols-2 gap-3">
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
						<DraggableNumberInput
							label="W"
							value={Math.round(selectedLayer.width)}
							onChange={(v) => update({ width: Math.max(1, v) })}
						/>
						<DraggableNumberInput
							label="H"
							value={Math.round(selectedLayer.height)}
							onChange={(v) => update({ height: Math.max(1, v) })}
						/>
						<DraggableNumberInput
							label="Scale"
							value={selectedLayer.scale}
							step={0.1}
							onChange={(v) => update({ scale: v })}
						/>
						<DraggableNumberInput
							label="Rotate"
							value={Math.round(selectedLayer.rotation)}
							onChange={(v) => update({ rotation: v })}
						/>
					</div>
				</section>

				<Separator />

				<section>
					<h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
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

				<Separator />

				{(selectedLayer.type === "Video" || selectedLayer.type === "Audio") && (
					<section>
						<h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
							Audio
						</h3>
						<div className="space-y-2">
							<div className="flex items-center justify-between text-xs">
								<span className="flex items-center gap-2">Volume</span>
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
						<h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
							Typography
						</h3>
						<div className="space-y-3">
							<div className="text-xs text-muted-foreground italic border p-2 rounded bg-muted/20">
								"{getTextData(selectedLayer.id)}"
							</div>
							<div className="grid grid-cols-2 gap-3">
								<DraggableNumberInput
									label="Size"
									value={selectedLayer.fontSize ?? 40}
									onChange={(v) => update({ fontSize: v })}
								/>
								<div className="space-y-1">
									<label className="text-[10px] text-muted-foreground uppercase">
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
			</div>
		</div>
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
	const [layers, setLayers] = useState<VideoCompositorLayer[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [viewportWidth, setViewportWidth] = useState(nodeConfig.width ?? 1920);
	const [viewportHeight, setViewportHeight] = useState(
		nodeConfig.height ?? 1080,
	);
	const [isDirty, setIsDirty] = useState(false);

	// Playback & View
	const [currentFrame, setCurrentFrame] = useState(0);
	const [isPlaying, setIsPlayingState] = useState(false);
	const playerRef = useRef<PlayerRef>(null);
	const [zoom, setZoom] = useState(0.5);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
	const [sizeKnown, setSizeKnown] = useState(false);

	// Refs
	const containerRef = useRef<HTMLDivElement>(null);
	const timeRef = useRef<HTMLDivElement>(null);

	// Data Getters
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
				return GetAssetEndpoint(processData.entity?.id);
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

	// Initialization
	useEffect(() => {
		const layerUpdates = { ...nodeConfig.layerUpdates };
		const loaded: VideoCompositorLayer[] = [];
		let maxZ = Math.max(
			0,
			...Object.values(layerUpdates).map((l) => l.zIndex ?? 0),
		);

		initialLayers.forEach((item, id) => {
			const saved = layerUpdates[id] as VideoCompositorLayer | undefined;

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
				});
			} else if (item.type === "Audio") {
				loaded.push({
					...base,
					type: "Audio",
					src: "",
					height: 0,
					width: 0,
				});
			}
		});

		setLayers(loaded);
	}, [initialLayers, nodeConfig]);

	const updateLayersHandler = useCallback(
		(
			updater: SetStateAction<VideoCompositorLayer[]>,
			isUserChange: boolean = true,
		) => {
			setLayers(updater);
			if (isUserChange) setIsDirty(true);
		},
		[],
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

	const handleSave = () => {
		const layerUpdates = layers.reduce<Record<string, VideoCompositorLayer>>(
			(acc, layer) => {
				acc[layer.id] = layer;
				return acc;
			},
			{},
		);
		onSave({ layerUpdates, width: viewportWidth, height: viewportHeight });
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
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
		};
	}, [isPlaying, playerRef]);

	return (
		<EditorContext.Provider
			value={{
				layers,
				updateLayers: updateLayersHandler,
				selectedId,
				setSelectedId,
				getTextData,
				getAssetUrl,
				viewportWidth,
				viewportHeight,
				updateViewportWidth: setViewportWidth,
				updateViewportHeight: setViewportHeight,
				fps: FPS,
				durationInFrames: 30 * 60, // 60s cap
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
				isDirty,
				setIsDirty,
			}}
		>
			<div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
				<div className="flex flex-1 min-h-0 relative">
					{/* Viewport Area */}
					<div
						ref={containerRef}
						className="flex-1 bg-neutral-900/95 relative overflow-hidden shadow-inner"
					>
						{/* Grid Bg */}
						<div
							className="absolute inset-0 pointer-events-none opacity-20"
							style={{
								backgroundImage:
									"radial-gradient(circle, #888 1px, transparent 1px)",
								backgroundSize: "24px 24px",
							}}
						/>

						<div
							className="absolute origin-top-left transition-transform duration-75 ease-out"
							style={{
								transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
								width: viewportWidth,
								height: viewportHeight,
								visibility: sizeKnown ? "visible" : "hidden",
							}}
						>
							<div
								className="shadow-2xl relative bg-black"
								style={{ width: viewportWidth, height: viewportHeight }}
							>
								<Player
									ref={playerRef}
									component={CompositionScene}
									inputProps={{ layers }}
									durationInFrames={30 * 60}
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
					<div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
						<Toolbar onClose={onClose} onSave={handleSave} timeRef={timeRef} />
					</div>
				</div>

				<TimelinePanel />
			</div>
		</EditorContext.Provider>
	);
};
