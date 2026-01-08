import {
	closestCenter,
	DndContext,
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
	CompositorLayer,
	CompositorNodeConfig,
	FileData,
	OutputItem,
} from "@gatewai/types";
import type Konva from "konva";
import {
	AlignCenterHorizontal,
	AlignCenterVertical,
	ArrowLeftRight,
	ArrowUpDown,
	Bold,
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	Hand,
	ImageIcon,
	Italic,
	Layers,
	Lock,
	Maximize,
	Minimize,
	MousePointer,
	Move,
	MoveHorizontal,
	MoveVertical,
	RotateCw,
	Settings2,
	Trash2,
	Type,
	Underline,
	Unlock,
} from "lucide-react";
import React, {
	createContext,
	type Dispatch,
	type RefObject,
	type SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Group,
	Image as KonvaImage,
	Layer as KonvaLayer,
	Text as KonvaText,
	Line,
	Rect,
	Stage,
	Transformer,
} from "react-konva";
import useImage from "use-image";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DraggableNumberInput } from "@/components/ui/draggable-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "@/components/ui/menubar";
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
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint, GetFontAssetUrl } from "@/utils/file";

// Mocking BLEND_MODES
const BLEND_MODES = [
	"source-over",
	"source-in",
	"source-out",
	"source-atop",
	"destination-over",
	"destination-in",
	"destination-out",
	"destination-atop",
	"lighter",
	"copy",
	"xor",
	"multiply",
	"screen",
	"overlay",
	"darken",
	"lighten",
	"color-dodge",
	"color-burn",
	"hard-light",
	"soft-light",
	"difference",
	"exclusion",
	"hue",
	"saturation",
	"color",
	"luminosity",
] as const;

// --- Font Manager ---
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
		if (this.loadedFonts.has(family) || !url) return;

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
			this.loadedFonts.add(family);
		} catch (e) {
			console.warn(`Font load failed for ${family}:`, e);
		}
	}
}

const fontManager = FontManager.getInstance();

// --- Editor Context ---
interface EditorContextType {
	layers: CompositorLayer[];
	updateLayers: (
		updater: SetStateAction<CompositorLayer[]>,
		isUserChange?: boolean,
	) => void;
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;
	viewportWidth: number;
	viewportHeight: number;
	updateViewportWidth: (w: number) => void;
	updateViewportHeight: (h: number) => void;
	screenWidth: number;
	screenHeight: number;
	guides: Guide[];
	setGuides: Dispatch<SetStateAction<Guide[]>>;
	isEditingText: boolean;
	setIsEditingText: (editing: boolean) => void;
	editingLayerId: string | null;
	setEditingLayerId: (id: string | null) => void;
	stageRef: RefObject<Konva.Stage | null>;
	mode: "select" | "pan";
	setMode: Dispatch<SetStateAction<"select" | "pan">>;
	scale: number;
	setScale: Dispatch<SetStateAction<number>>;
	stagePos: { x: number; y: number };
	setStagePos: Dispatch<SetStateAction<{ x: number; y: number }>>;
	zoomIn: () => void;
	zoomOut: () => void;
	zoomTo: (value: number) => void;
	fitView: () => void;
	zoomPercentage: string;
	getTextData: (handleId: HandleEntityType["id"]) => string;
	getImageData: (handleId: HandleEntityType["id"]) => FileData;
	getImageUrl: (handleId: HandleEntityType["id"]) => string | undefined;
	isDirty: boolean;
	setIsDirty: Dispatch<SetStateAction<boolean>>;
}

interface Guide {
	type: "horizontal" | "vertical";
	position: number;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

const useEditor = () => {
	const context = useContext(EditorContext);
	if (!context) {
		throw new Error("useEditor must be used within EditorProvider");
	}
	return context;
};

// --- Snapping Hook ---
const useSnap = () => {
	const { layers, updateLayers, viewportWidth, viewportHeight, setGuides } =
		useEditor();
	const SNAP_THRESHOLD = 5;

	const getSnapPositions = useCallback(
		(excludeId: string) => {
			const hSnaps: number[] = [
				0,
				Math.round(viewportHeight / 2),
				viewportHeight,
			];
			const vSnaps: number[] = [
				0,
				Math.round(viewportWidth / 2),
				viewportWidth,
			];

			layers.forEach((layer) => {
				if (
					layer.id !== excludeId &&
					layer.width &&
					(layer.height ?? layer.computedHeight)
				) {
					const effectiveHeight = layer.height ?? layer.computedHeight ?? 0;
					const centerX = Math.round(layer.x + layer.width / 2);
					const centerY = Math.round(layer.y + effectiveHeight / 2);
					vSnaps.push(
						Math.round(layer.x),
						centerX,
						Math.round(layer.x + layer.width),
					);
					hSnaps.push(
						Math.round(layer.y),
						centerY,
						Math.round(layer.y + effectiveHeight),
					);
				}
			});
			return { hSnaps, vSnaps };
		},
		[layers, viewportHeight, viewportWidth],
	);

	const handleDragMove = useCallback(
		(e: Konva.KonvaEventObject<DragEvent>) => {
			const node = e.target;
			const id = node.id();
			const { hSnaps, vSnaps } = getSnapPositions(id);
			let newX = node.x();
			let newY = node.y();

			const centerX = newX + node.width() / 2;
			const centerY = newY + node.height() / 2;
			const right = newX + node.width();
			const bottom = newY + node.height();

			// Vertical snaps
			const vGuides: Guide[] = [];
			for (const snap of vSnaps) {
				if (Math.abs(newX - snap) < SNAP_THRESHOLD) {
					newX = snap;
					vGuides.push({ type: "vertical", position: snap });
				} else if (Math.abs(centerX - snap) < SNAP_THRESHOLD) {
					newX = snap - node.width() / 2;
					vGuides.push({ type: "vertical", position: snap });
				} else if (Math.abs(right - snap) < SNAP_THRESHOLD) {
					newX = snap - node.width();
					vGuides.push({ type: "vertical", position: snap });
				}
			}

			// Horizontal snaps
			const hGuides: Guide[] = [];
			for (const snap of hSnaps) {
				if (Math.abs(newY - snap) < SNAP_THRESHOLD) {
					newY = snap;
					hGuides.push({ type: "horizontal", position: snap });
				} else if (Math.abs(centerY - snap) < SNAP_THRESHOLD) {
					newY = snap - node.height() / 2;
					hGuides.push({ type: "horizontal", position: snap });
				} else if (Math.abs(bottom - snap) < SNAP_THRESHOLD) {
					newY = snap - node.height();
					hGuides.push({ type: "horizontal", position: snap });
				}
			}

			node.position({ x: newX, y: newY });

			// Deduplicate guides
			const guideMap = new Map<string, Guide>();
			[...vGuides, ...hGuides].forEach((g) => {
				const key = `${g.type}-${g.position}`;
				if (!guideMap.has(key)) guideMap.set(key, g);
			});
			setGuides(Array.from(guideMap.values()));
		},
		[getSnapPositions, setGuides],
	);

	const handleDragEnd = useCallback(
		(e: Konva.KonvaEventObject<DragEvent>) => {
			const node = e.target;
			const id = node.id();
			updateLayers((prev) =>
				prev.map((l) =>
					l.id === id
						? { ...l, x: Math.round(node.x()), y: Math.round(node.y()) }
						: l,
				),
			);
			setGuides([]);
		},
		[updateLayers, setGuides],
	);

	const handleTransformEnd = useCallback(
		(e: Konva.KonvaEventObject<Event>) => {
			const node = e.target;
			const id = node.id();
			updateLayers((prev) =>
				prev.map((l) =>
					l.id === id
						? {
								...l,
								x: Math.round(node.x()),
								y: Math.round(node.y()),
								rotation: Math.round(node.rotation()),
								width: Math.round(node.width()),
								height:
									l.type === "Text" ? undefined : Math.round(node.height()),
							}
						: l,
				),
			);
		},
		[updateLayers],
	);

	return { handleDragMove, handleDragEnd, handleTransformEnd };
};

// --- Common Components ---

const CollapsibleSection: React.FC<{
	title: string;
	icon: React.ElementType;
	children: React.ReactNode;
	defaultOpen?: boolean;
}> = ({ title, icon: Icon, children, defaultOpen = true }) => {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	return (
		<div className="border-b border-white/5">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors group"
			>
				<div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-gray-200">
					<Icon className="w-3.5 h-3.5" /> {title}
				</div>
				<ChevronDown
					className={`w-3 h-3 text-gray-500 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
				/>
			</button>
			{isOpen && (
				<div className="p-3 pt-0 animate-in slide-in-from-top-1 duration-200">
					{children}
				</div>
			)}
		</div>
	);
};

// --- Layer Components ---
interface LayerProps {
	layer: CompositorLayer;
	onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
	onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
	onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
	onTransformStart: (e: Konva.KonvaEventObject<Event>) => void;
	onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
}

const ImageLayer: React.FC<LayerProps> = ({
	layer,
	onDragStart,
	onDragMove,
	onDragEnd,
	onTransformStart,
	onTransformEnd,
}) => {
	const { setSelectedId, updateLayers, getImageUrl, mode, selectedId } =
		useEditor();
	const url = getImageUrl(layer.inputHandleId);
	const [image] = useImage(url ?? "", "anonymous");

	useEffect(() => {
		if (image && (!layer.width || !layer.height)) {
			updateLayers(
				(prev) =>
					prev.map((l) =>
						l.id === layer.id
							? {
									...l,
									width: Math.round(image.width),
									height: Math.round(image.height),
								}
							: l,
					),
				false,
			);
		}
	}, [image, layer.id, layer.width, layer.height, updateLayers]);

	const handleSelect = () => {
		setSelectedId(layer.id);
	};

	const handleTransform = useCallback((e: Konva.KonvaEventObject<Event>) => {
		const node = e.target as Konva.Image;
		node.setAttrs({
			width: Math.max(20, node.width() * node.scaleX()),
			height: Math.max(20, node.height() * node.scaleY()),
			scaleX: 1,
			scaleY: 1,
		});
	}, []);

	const isListening =
		mode === "select" && (selectedId === null || selectedId === layer.id);

	return (
		<KonvaImage
			id={layer.id}
			x={layer.x}
			y={layer.y}
			width={layer.width}
			height={layer.height}
			rotation={layer.rotation}
			image={image}
			draggable={mode === "select"}
			onClick={handleSelect}
			onTap={handleSelect}
			onDragStart={onDragStart}
			onDragMove={onDragMove}
			onDragEnd={onDragEnd}
			onTransformStart={onTransformStart}
			onTransform={handleTransform}
			onTransformEnd={onTransformEnd}
			globalCompositeOperation={layer.blendMode as GlobalCompositeOperation}
			opacity={layer.opacity ?? 1}
			listening={isListening}
		/>
	);
};

const TextLayer: React.FC<
	LayerProps & { layer: CompositorLayer & { type: "Text" } }
> = ({
	layer,
	onDragStart,
	onDragMove,
	onDragEnd,
	onTransformStart,
	onTransformEnd,
}) => {
	const {
		setSelectedId,
		setIsEditingText,
		setEditingLayerId,
		getTextData,
		mode,
		updateLayers,
		stageRef,
		selectedId,
	} = useEditor();
	const text = getTextData(layer.inputHandleId);

	const handleSelect = () => {
		setSelectedId(layer.id);
	};

	const handleDoubleClick = () => {
		setSelectedId(layer.id);
		setIsEditingText(true);
		setEditingLayerId(layer.id);
	};

	const handleTransform = useCallback((e: Konva.KonvaEventObject<Event>) => {
		const node = e.target as Konva.Text;
		node.scaleY(1);
		const newWidth = Math.max(20, node.width() * node.scaleX());
		node.setAttrs({
			width: newWidth,
			scaleX: 1,
			scaleY: 1,
			height: undefined,
		});
	}, []);

	useEffect(() => {
		const node = stageRef.current?.findOne(`#${layer.id}`) as
			| Konva.Text
			| undefined;
		if (node && layer.type === "Text") {
			const newHeight = Math.round(node.height());
			if (newHeight !== layer.computedHeight) {
				updateLayers(
					(prev) =>
						prev.map((l) =>
							l.id === layer.id ? { ...l, computedHeight: newHeight } : l,
						),
					false,
				);
			}
		}
	}, [layer.id, layer.type, updateLayers, stageRef, layer.computedHeight]);

	useEffect(() => {
		if (layer.fontFamily) {
			const fontUrl = GetFontAssetUrl(layer.fontFamily);
			fontManager
				.loadFont(layer.fontFamily, fontUrl)
				.then(() => {
					stageRef.current?.batchDraw();
				})
				.catch(() => {});
		}
	}, [layer.fontFamily, stageRef]);

	const isListening =
		mode === "select" && (selectedId === null || selectedId === layer.id);

	return (
		<KonvaText
			id={layer.id}
			x={layer.x}
			y={layer.y}
			text={text as string}
			fontSize={layer.fontSize ?? 24}
			fontFamily={layer.fontFamily ?? "Geist"}
			fontStyle={layer.fontStyle ?? "normal"}
			textDecoration={layer.textDecoration ?? ""}
			fill={layer.fill ?? "#000000"}
			width={layer.width ?? 200}
			height={layer.height}
			rotation={layer.rotation}
			draggable={mode === "select"}
			onClick={handleSelect}
			onTap={handleSelect}
			onDblClick={handleDoubleClick}
			onDblTap={handleDoubleClick}
			onDragStart={onDragStart}
			onDragMove={onDragMove}
			onDragEnd={onDragEnd}
			onTransformStart={onTransformStart}
			onTransform={handleTransform}
			onTransformEnd={onTransformEnd}
			globalCompositeOperation={layer.blendMode as GlobalCompositeOperation}
			wrap="word"
			align={layer.align || "left"}
			verticalAlign={layer.verticalAlign ?? "top"}
			letterSpacing={layer.letterSpacing ?? 0}
			lineHeight={layer.lineHeight ?? 1}
			opacity={layer.opacity ?? 1}
			listening={isListening}
		/>
	);
};

// --- Stage Components ---

const TransformerComponent: React.FC = () => {
	const { selectedId, layers, stageRef, mode } = useEditor();
	const trRef = useRef<Konva.Transformer>(null);

	useEffect(() => {
		if (selectedId && trRef.current && stageRef.current && mode === "select") {
			const node = stageRef.current.findOne(`#${selectedId}`);
			if (node) {
				trRef.current.nodes([node]);
				trRef.current.getLayer()?.batchDraw();
			} else {
				trRef.current.nodes([]);
			}
		} else if (trRef.current) {
			trRef.current.nodes([]);
			trRef.current.getLayer()?.batchDraw();
		}
	}, [selectedId, stageRef, mode]);

	const selectedLayer = layers.find((l) => l.id === selectedId);

	const enabledAnchors = useMemo(() => {
		if (selectedLayer?.type === "Text") {
			return ["middle-left", "middle-right"];
		}
		if (selectedLayer?.type === "Image" && selectedLayer.lockAspect) {
			return ["top-left", "top-right", "bottom-left", "bottom-right"];
		}
		return undefined;
	}, [selectedLayer]);

	return (
		<Transformer
			ref={trRef}
			rotateEnabled
			flipEnabled={false}
			borderStroke="#3b82f6"
			anchorStroke="#3b82f6"
			anchorFill="#ffffff"
			anchorSize={10}
			anchorCornerRadius={5}
			keepRatio={selectedLayer?.type === "Image" && selectedLayer.lockAspect}
			enabledAnchors={enabledAnchors}
			boundBoxFunc={(oldBox, newBox) => {
				if (newBox.width < 5 || newBox.height < 5) {
					return oldBox;
				}
				return newBox;
			}}
		/>
	);
};

const Guides: React.FC = () => {
	const { guides, viewportWidth, viewportHeight } = useEditor();
	return (
		<>
			{guides.map((guide, index) => (
				<Line
					key={`${guide.type}-${guide.position}-${index}`}
					points={
						guide.type === "vertical"
							? [guide.position, 0, guide.position, viewportHeight]
							: [0, guide.position, viewportWidth, guide.position]
					}
					stroke="#ef4444" // red-500
					strokeWidth={1}
					dash={[4, 4]}
				/>
			))}
		</>
	);
};

const ArtboardBackground: React.FC = () => {
	const { viewportWidth, viewportHeight } = useEditor();

	// Create checkered pattern
	const patternImage = useMemo(() => {
		const size = 20;
		const half = size / 2;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "#1e1e1e";
			ctx.fillRect(0, 0, size, size);
			ctx.fillStyle = "#262626";
			ctx.fillRect(0, 0, half, half);
			ctx.fillRect(half, half, half, half);
		}
		return canvas;
	}, []);

	return (
		<Group>
			{/* Shadow for elevation */}
			<Rect
				x={0}
				y={0}
				width={viewportWidth}
				height={viewportHeight}
				fill="#000"
				shadowColor="black"
				shadowBlur={60}
				shadowOpacity={0.6}
				shadowOffset={{ x: 0, y: 10 }}
				listening={false}
			/>
			{/* The main artboard area */}
			<Rect
				x={0}
				y={0}
				width={viewportWidth}
				height={viewportHeight}
				fillPatternImage={patternImage}
				fillPatternRepeat="repeat"
				listening={false}
			/>
		</Group>
	);
};

const Canvas: React.FC = () => {
	const {
		layers,
		screenWidth,
		screenHeight,
		setSelectedId,
		stageRef,
		mode,
		setMode,
		scale,
		stagePos,
		setScale,
		setStagePos,
	} = useEditor();
	const { handleDragMove, handleDragEnd, handleTransformEnd } = useSnap();
	const lastModeRef = useRef<"select" | "pan">("select");

	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	const handleStageClick = useCallback(
		(e: Konva.KonvaEventObject<TouchEvent | MouseEvent>) => {
			if (e.target === stageRef.current || e.target.name() === "artboard-bg") {
				setSelectedId(null);
			}
		},
		[stageRef, setSelectedId],
	);

	const handleStageMouseDown = useCallback(
		(e: Konva.KonvaEventObject<MouseEvent>) => {
			if (e.evt.button === 1) {
				e.evt.preventDefault();
				const stage = e.currentTarget;
				lastModeRef.current = mode;
				setMode("pan");
				stage.draggable(true);
				stage.startDrag();
				const reset = () => {
					setMode(lastModeRef.current);
					stage.draggable(false);
					window.removeEventListener("mouseup", reset);
				};
				window.addEventListener("mouseup", reset);
			}
		},
		[mode, setMode],
	);

	const handleWheel = useCallback(
		(e: Konva.KonvaEventObject<WheelEvent>) => {
			e.evt.preventDefault();
			const stage = stageRef.current;
			if (!stage) return;
			const oldScale = stage.scaleX();
			const pointer = stage.getPointerPosition();
			if (!pointer) return;

			const mousePointTo = {
				x: (pointer.x - stage.x()) / oldScale,
				y: (pointer.y - stage.y()) / oldScale,
			};

			// Match Zoom behavior of Video Editor
			const zoomSensitivity = 0.001; // Slower zoom on scroll
			const direction = e.evt.deltaY > 0 ? -1 : 1;
			// Using exp like video editor for smooth zoom
			// const newScale = Math.min(Math.max(oldScale * Math.exp(-e.evt.deltaY * 0.001), 0.1), 5);
			// Sticking to original logic but clamped
			const scaleBy = 1.05;
			const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

			if (newScale < 0.1 || newScale > 10) return;

			const newPos = {
				x: Math.round(pointer.x - mousePointTo.x * newScale),
				y: Math.round(pointer.y - mousePointTo.y * newScale),
			};

			setScale(newScale);
			setStagePos(newPos);
		},
		[stageRef, setScale, setStagePos],
	);

	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		stage.scale({ x: scale, y: scale });
		stage.position(stagePos);
		stage.batchDraw();
	}, [scale, stagePos, stageRef]);

	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		const handleDragEndStage = () => {
			setStagePos(stage.position());
		};
		stage.on("dragend", handleDragEndStage);
		return () => {
			stage.off("dragend", handleDragEndStage);
		};
	}, [stageRef, setStagePos]);

	const cursorStyle = mode === "pan" ? "grab" : "default";

	return (
		<Stage
			ref={stageRef}
			width={screenWidth}
			height={screenHeight}
			style={{ background: "transparent", cursor: cursorStyle }}
			onClick={handleStageClick}
			onTap={handleStageClick}
			onWheel={handleWheel}
			onMouseDown={handleStageMouseDown}
			draggable={mode === "pan"}
		>
			<KonvaLayer name="artboard-bg">
				<ArtboardBackground />
			</KonvaLayer>
			<KonvaLayer>
				{sortedLayers.map((layer) => {
					const props = {
						key: layer.id,
						layer,
						onDragStart: () => setSelectedId(layer.id),
						onDragMove: handleDragMove,
						onDragEnd: handleDragEnd,
						onTransformStart: () => setSelectedId(layer.id),
						onTransformEnd: handleTransformEnd,
					};
					if (layer.type === "Image") {
						return <ImageLayer {...props} />;
					}
					if (layer.type === "Text") {
						return <TextLayer {...props} layer={layer} />;
					}
					return null;
				})}
			</KonvaLayer>
			<KonvaLayer>
				<TransformerComponent />
			</KonvaLayer>
			<KonvaLayer listening={false}>
				<Guides />
			</KonvaLayer>
		</Stage>
	);
};

// --- Layers Panel ---

interface LayerItemProps {
	layer: CompositorLayer;
	selectedId: string | null;
	setSelectedId: (id: string) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({
	layer,
	selectedId,
	setSelectedId,
}) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: layer.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		zIndex: isDragging ? 9999 : "auto",
		opacity: isDragging ? 0.5 : 1,
	};

	const isSelected = layer.id === selectedId;

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={`
        flex items-center gap-3 px-3 py-2 border-b border-white/5 cursor-pointer outline-none group transition-colors
        ${isSelected ? "bg-blue-500/10 text-blue-100" : "hover:bg-white/5 text-gray-400"}
        ${isDragging ? "bg-neutral-900" : ""}
      `}
			onClick={() => {
				if (!isDragging) setSelectedId(layer.id);
			}}
		>
			{layer.type === "Image" ? (
				<ImageIcon className="size-3.5 shrink-0 text-purple-400" />
			) : (
				<Type className="size-3.5 shrink-0 text-green-400" />
			)}
			<span className="truncate flex-1 text-[11px] font-medium">
				{layer.id}
			</span>
			<div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
				{/* Placeholder for Lock/Hide functionality in future */}
				<Lock className="w-3 h-3 text-gray-600 hover:text-gray-400" />
			</div>
		</div>
	);
};

const LayersPanel: React.FC = () => {
	const { layers, updateLayers, selectedId, setSelectedId } = useEditor();
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	// Invert for display so top layer is top of list
	const displayLayers = useMemo(
		() => [...sortedLayers].reverse(),
		[sortedLayers],
	);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 5 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	return (
		<div className="absolute left-0 top-0 bottom-0 w-60 bg-[#0f0f0f] border-r border-white/10 z-20 flex flex-col shadow-xl">
			<div className="flex items-center justify-between p-3 border-b border-white/5 bg-neutral-900 shrink-0 h-9">
				<span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
					<Layers className="w-3.5 h-3.5" /> Layers
				</span>
			</div>

			<ScrollArea className="flex-1 bg-[#0f0f0f]">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={(e) => {
						const { active, over } = e;
						if (over && active.id !== over.id) {
							updateLayers((currentLayers) => {
								// We displayed them reversed, but logic operates on zIndex logic
								// Higher zIndex = Top of visual stack = Top of list in this UI
								const currentSorted = [...currentLayers].sort(
									(a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
								);
								const oldIndex = currentSorted.findIndex(
									(l) => l.id === active.id,
								);
								const newIndex = currentSorted.findIndex(
									(l) => l.id === over.id,
								);

								// Move in the sorted array
								const newSorted = arrayMove(currentSorted, oldIndex, newIndex);

								// Reassign zIndexes based on new position in array
								// index 0 is top (highest zIndex)
								return currentLayers.map((l) => {
									const pos = newSorted.findIndex((s) => s.id === l.id);
									return { ...l, zIndex: newSorted.length - pos };
								});
							});
						}
					}}
				>
					<SortableContext
						items={displayLayers.map((l) => l.id)}
						strategy={verticalListSortingStrategy}
					>
						<div className="flex flex-col">
							{displayLayers.map((layer) => (
								<LayerItem
									key={layer.id}
									layer={layer}
									selectedId={selectedId}
									setSelectedId={setSelectedId}
								/>
							))}
							{displayLayers.length === 0 && (
								<div className="py-8 text-center text-xs text-muted-foreground italic">
									No layers available
								</div>
							)}
						</div>
					</SortableContext>
				</DndContext>
			</ScrollArea>
		</div>
	);
};

// --- Inspector Panel ---

const InspectorPanel: React.FC = () => {
	const { data: fontList } = useGetFontListQuery({});
	const fontNames = useMemo(() => {
		if (Array.isArray(fontList) && (fontList as string[])?.length > 0) {
			return fontList as string[];
		}
		return ["Geist", "Inter", "Arial", "Courier New", "Times New Roman"];
	}, [fontList]);

	const {
		selectedId,
		layers,
		updateLayers,
		viewportWidth,
		updateViewportWidth,
		viewportHeight,
		updateViewportHeight,
	} = useEditor();

	const selectedLayer = layers.find((l) => l.id === selectedId);

	const updateLayer = (updates: Partial<CompositorLayer>) => {
		if (!selectedId) return;
		updateLayers((prev) =>
			prev.map((l) => (l.id === selectedId ? { ...l, ...updates } : l)),
		);
	};

	const centerLayer = (axis: "x" | "y") => {
		if (!selectedLayer) return;
		if (axis === "x") {
			const w = selectedLayer.width ?? 0;
			updateLayer({ x: Math.round((viewportWidth - w) / 2) });
		} else {
			const h = selectedLayer.height ?? selectedLayer.computedHeight ?? 0;
			updateLayer({ y: Math.round((viewportHeight - h) / 2) });
		}
	};

	const aspectRatios = useMemo(
		() => [
			{ label: "1:1 Square", width: 1080, height: 1080 },
			{ label: "4:5 Portrait", width: 1080, height: 1350 },
			{ label: "9:16 Story", width: 1080, height: 1920 },
			{ label: "16:9 Landscape", width: 1920, height: 1080 },
		],
		[],
	);

	const toggleStyle = (style: "bold" | "italic") => {
		if (!selectedLayer || selectedLayer.type !== "Text") return;
		const current = selectedLayer.fontStyle || "normal";
		let next = current;
		if (next.includes(style)) {
			next = next.replace(style, "").trim();
		} else {
			next = `${style} ${next}`;
		}
		if (next.trim() === "") next = "normal";
		updateLayer({ fontStyle: next });
	};

	const toggleUnderline = () => {
		if (!selectedLayer || selectedLayer.type !== "Text") return;
		updateLayer({
			textDecoration:
				selectedLayer.textDecoration === "underline" ? "" : "underline",
		});
	};

	const isBold = selectedLayer?.fontStyle?.includes("bold") ?? false;
	const isItalic = selectedLayer?.fontStyle?.includes("italic") ?? false;
	const isUnderline = selectedLayer?.textDecoration === "underline";

	if (!selectedLayer) {
		return (
			<div className="w-64 border-l border-white/5 bg-[#0f0f0f] z-20 shadow-xl flex flex-col">
				<div className="p-4 bg-neutral-900 border-b border-white/5 shrink-0 h-9 flex items-center">
					<h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
						Global Settings
					</h2>
				</div>
				<div className="p-4 space-y-6">
					<div className="space-y-2">
						<Label className="text-[10px] text-gray-500 uppercase font-bold">
							Canvas Size
						</Label>
						<div className="grid grid-cols-2 gap-2">
							<DraggableNumberInput
								label="W"
								icon={MoveHorizontal}
								value={Math.round(viewportWidth)}
								onChange={(v) => updateViewportWidth(Math.max(1, v))}
								min={1}
							/>
							<DraggableNumberInput
								label="H"
								icon={MoveVertical}
								value={Math.round(viewportHeight)}
								onChange={(v) => updateViewportHeight(Math.max(1, v))}
								min={1}
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
							<SelectTrigger className="h-8 text-xs bg-neutral-800 border-white/10 text-gray-300">
								<SelectValue placeholder="Presets" />
							</SelectTrigger>
							<SelectContent className="bg-neutral-800 border-white/10 text-gray-300">
								{aspectRatios.map((r) => (
									<SelectItem key={r.label} value={r.label}>
										{r.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col items-center justify-center p-8 mt-4 text-center border border-dashed border-white/10 rounded-lg bg-white/5">
						<MousePointer className="w-6 h-6 text-gray-600 mb-2" />
						<p className="text-xs text-gray-500">
							Select a layer to edit properties
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<ScrollArea className="w-64 border-l border-white/5 bg-[#0f0f0f] z-20 shadow-xl">
			<div className="flex items-center justify-between p-4 border-b border-white/5 bg-neutral-900/50">
				<div className="flex flex-col min-w-0">
					<span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
						Selected
					</span>
					<h2 className="text-sm font-semibold text-white truncate max-w-[150px]">
						{selectedLayer.id}
					</h2>
				</div>
				<div className="flex items-center gap-1">
					<span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-gray-300 font-medium uppercase border border-white/5">
						{selectedLayer.type}
					</span>
				</div>
			</div>

			<div className="pb-20">
				<CollapsibleSection title="Transform" icon={Move}>
					<div className="flex gap-1 mb-3">
						<Button
							variant="outline"
							size="sm"
							className="flex-1 h-7 text-[10px] border-white/10 bg-white/5 hover:bg-white/10"
							onClick={() => centerLayer("x")}
						>
							<AlignCenterHorizontal className="w-3 h-3 mr-1" /> Center X
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="flex-1 h-7 text-[10px] border-white/10 bg-white/5 hover:bg-white/10"
							onClick={() => centerLayer("y")}
						>
							<AlignCenterVertical className="w-3 h-3 mr-1" /> Center Y
						</Button>
					</div>

					<div className="grid grid-cols-2 gap-3 mb-3">
						<DraggableNumberInput
							label="X"
							icon={MoveHorizontal}
							value={Math.round(selectedLayer.x)}
							onChange={(v) => updateLayer({ x: v })}
						/>
						<DraggableNumberInput
							label="Y"
							icon={MoveVertical}
							value={Math.round(selectedLayer.y)}
							onChange={(v) => updateLayer({ y: v })}
						/>
						<DraggableNumberInput
							label="W"
							icon={MoveHorizontal}
							value={Math.round(selectedLayer.width ?? 0)}
							onChange={(newWidth) => {
								if (
									selectedLayer.type === "Image" &&
									selectedLayer.lockAspect
								) {
									const oldW = selectedLayer.width ?? 1;
									const oldH = selectedLayer.height ?? 1;
									const ratio = oldH / oldW;
									updateLayer({
										width: newWidth,
										height: newWidth * ratio,
									});
								} else {
									updateLayer({ width: newWidth });
								}
							}}
							min={1}
						/>
						{selectedLayer.type !== "Text" ? (
							<DraggableNumberInput
								label="H"
								icon={MoveVertical}
								value={Math.round(selectedLayer.height ?? 0)}
								onChange={(newHeight) => {
									if (selectedLayer.type === "Image") {
										if (selectedLayer.lockAspect) {
											const oldW = selectedLayer.width ?? 1;
											const oldH = selectedLayer.height ?? 1;
											const ratio = oldW / oldH;
											updateLayer({
												height: newHeight,
												width: newHeight * ratio,
											});
										} else {
											updateLayer({ height: newHeight });
										}
									}
								}}
								min={1}
							/>
						) : (
							<DraggableNumberInput
								label="H"
								icon={MoveVertical}
								value={Math.round(selectedLayer.computedHeight ?? 0)}
								onChange={() => {}}
								disabled
							/>
						)}
					</div>
					<div className="grid grid-cols-2 gap-3">
						<DraggableNumberInput
							label="Rot"
							icon={RotateCw}
							value={Math.round(selectedLayer.rotation)}
							onChange={(v) => updateLayer({ rotation: v })}
						/>
						<DraggableNumberInput
							label="Op"
							icon={Layers}
							value={Math.round((selectedLayer.opacity ?? 1) * 100)}
							onChange={(v) => updateLayer({ opacity: v / 100 })}
							min={0}
							max={100}
						/>
					</div>

					{selectedLayer.type === "Image" && (
						<div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
							<Label className="text-[10px] text-gray-400">Lock Aspect</Label>
							<Switch
								checked={selectedLayer.lockAspect ?? true}
								onCheckedChange={(c) => updateLayer({ lockAspect: c })}
								className="scale-75 data-[state=checked]:bg-blue-600"
							/>
						</div>
					)}
				</CollapsibleSection>

				{selectedLayer.type === "Text" && (
					<CollapsibleSection title="Typography" icon={Type}>
						<div className="space-y-3">
							<div className="space-y-1">
								<Label className="text-[10px] text-gray-500">Font</Label>
								<Select
									value={selectedLayer.fontFamily || "Geist"}
									onValueChange={(val) => updateLayer({ fontFamily: val })}
								>
									<SelectTrigger className="h-8 text-xs bg-neutral-800 border-white/10 text-white">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="bg-neutral-800 border-white/10 text-white">
										{fontNames.map((f) => (
											<SelectItem key={f} value={f} style={{ fontFamily: f }}>
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
									value={selectedLayer.fontSize || 24}
									onChange={(v) => updateLayer({ fontSize: v })}
									min={1}
								/>
								<div className="space-y-1">
									<Label className="text-[10px] text-gray-500 block mb-1">
										Color
									</Label>
									<ColorInput
										value={selectedLayer.fill ?? "#ffffff"}
										onChange={(e) => updateLayer({ fill: e })}
										className="h-8 w-full"
									/>
								</div>
							</div>

							<div className="flex p-1 bg-white/5 rounded border border-white/5">
								<Button
									variant={isBold ? "secondary" : "ghost"}
									size="icon"
									className="h-6 flex-1 rounded-sm"
									onClick={() => toggleStyle("bold")}
								>
									<Bold className="w-3 h-3" />
								</Button>
								<Separator
									orientation="vertical"
									className="h-4 my-auto mx-1 bg-white/10"
								/>
								<Button
									variant={isItalic ? "secondary" : "ghost"}
									size="icon"
									className="h-6 flex-1 rounded-sm"
									onClick={() => toggleStyle("italic")}
								>
									<Italic className="w-3 h-3" />
								</Button>
								<Separator
									orientation="vertical"
									className="h-4 my-auto mx-1 bg-white/10"
								/>
								<Button
									variant={isUnderline ? "secondary" : "ghost"}
									size="icon"
									className="h-6 flex-1 rounded-sm"
									onClick={toggleUnderline}
								>
									<Underline className="w-3 h-3" />
								</Button>
							</div>

							<div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded border border-white/5">
								{(["left", "center", "right"] as const).map((align) => (
									<Button
										key={align}
										variant={
											selectedLayer.align === align ? "secondary" : "ghost"
										}
										size="sm"
										className="h-6 text-[10px] capitalize"
										onClick={() => updateLayer({ align })}
									>
										{align}
									</Button>
								))}
							</div>

							<div className="grid grid-cols-2 gap-3">
								<DraggableNumberInput
									label="Spacing"
									icon={ArrowLeftRight}
									value={selectedLayer.letterSpacing ?? 0}
									onChange={(v) => updateLayer({ letterSpacing: v })}
								/>
								<DraggableNumberInput
									label="Line H"
									icon={ArrowUpDown}
									value={selectedLayer.lineHeight ?? 1}
									onChange={(v) => updateLayer({ lineHeight: v })}
									allowDecimal
									step={0.1}
								/>
							</div>
						</div>
					</CollapsibleSection>
				)}

				<CollapsibleSection title="Blending" icon={Settings2}>
					<div className="space-y-2">
						<Label className="text-[10px] text-gray-500">Mode</Label>
						<Select
							value={selectedLayer.blendMode || "source-over"}
							onValueChange={(val) => updateLayer({ blendMode: val })}
						>
							<SelectTrigger className="h-8 text-xs capitalize bg-neutral-800 border-white/10 text-white">
								<SelectValue />
							</SelectTrigger>
							<SelectContent className="bg-neutral-800 border-white/10 text-white max-h-[200px]">
								{BLEND_MODES.map((m) => (
									<SelectItem key={m} value={m} className="capitalize">
										{m.replace("-", " ")}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CollapsibleSection>
			</div>
		</ScrollArea>
	);
};

// --- Toolbar ---
const Toolbar = React.memo<{
	onSave: () => void;
	onClose: () => void;
}>(({ onSave, onClose }) => {
	const {
		mode,
		setMode,
		zoomIn,
		zoomOut,
		zoomTo,
		fitView,
		zoomPercentage,
		isDirty,
	} = useEditor();

	return (
		<div className="flex items-center gap-1.5 p-1.5 rounded-full bg-neutral-900/90 backdrop-blur-xl border border-white/10 shadow-2xl z-50">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className={`rounded-full w-8 h-8 ${mode === "select" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
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
							variant="ghost"
							size="icon"
							className={`rounded-full w-8 h-8 ${mode === "pan" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
							onClick={() => setMode("pan")}
						>
							<Hand className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Pan Tool (Space)</TooltipContent>
				</Tooltip>
			</TooltipProvider>

			<div className="w-px h-4 bg-white/10 mx-1" />

			<Menubar className="border-none bg-transparent h-auto p-0">
				<MenubarMenu>
					<MenubarTrigger asChild>
						<Button
							variant="ghost"
							className="h-8 px-2.5 text-[10px] rounded-full text-gray-300 hover:text-white hover:bg-white/10 font-medium"
						>
							{zoomPercentage}{" "}
							<ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
						</Button>
					</MenubarTrigger>
					<MenubarContent
						align="center"
						sideOffset={10}
						className="min-w-[140px] bg-neutral-900/95 backdrop-blur-xl border-white/10 text-gray-200"
					>
						<MenubarItem onClick={() => zoomIn()}>Zoom In</MenubarItem>
						<MenubarItem onClick={() => zoomOut()}>Zoom Out</MenubarItem>
						<MenubarItem onClick={() => zoomTo(1)}>
							Actual Size (100%)
						</MenubarItem>
						<MenubarItem onClick={() => zoomTo(2)}>200%</MenubarItem>
						<Separator className="my-1 bg-white/10" />
						<MenubarItem onClick={() => fitView()}>Fit to Screen</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>

			<div className="w-px h-4 bg-white/10 mx-1" />

			<div className="flex items-center gap-1">
				<Button
					size="sm"
					className="h-7 text-[10px] font-medium rounded-full px-3 bg-white text-black hover:bg-gray-200 border-0"
					onClick={onSave}
					disabled={!isDirty}
				>
					Save
				</Button>
				<Button
					size="sm"
					variant="ghost"
					className="h-7 text-[10px] rounded-full px-2.5 text-gray-400 hover:text-white hover:bg-white/10"
					onClick={onClose}
				>
					Close
				</Button>
			</div>
		</div>
	);
});

// --- Main Designer Component ---

interface ImageDesignerEditorProps {
	initialLayers: Map<
		HandleEntityType["id"],
		OutputItem<"Text"> | OutputItem<"Image">
	>;
	node: NodeEntityType;
	onClose: () => void;
	onSave: (config: CompositorNodeConfig) => void;
}

export const ImageDesignerEditor: React.FC<ImageDesignerEditorProps> = ({
	initialLayers,
	node,
	onClose,
	onSave: propOnSave,
}) => {
	const nodeConfig = node.config as CompositorNodeConfig;
	const [layers, setLayers] = useState<CompositorLayer[]>([]);
	const updateLayers = useCallback(
		(
			updater: SetStateAction<CompositorLayer[]>,
			isUserChange: boolean = true,
		) => {
			setLayers(updater);
			if (isUserChange) {
				setIsDirty(true);
			}
		},
		[],
	);

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [viewportWidth, setViewportWidth] = useState(nodeConfig.width ?? 1024);
	const updateViewportWidth = useCallback((w: number) => {
		setViewportWidth(w);
		setIsDirty(true);
	}, []);
	const [viewportHeight, setViewportHeight] = useState(
		nodeConfig.height ?? 1024,
	);
	const updateViewportHeight = useCallback((h: number) => {
		setViewportHeight(h);
		setIsDirty(true);
	}, []);

	const [guides, setGuides] = useState<Guide[]>([]);
	const [isEditingText, setIsEditingText] = useState(false);
	const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
	const stageRef = useRef<Konva.Stage | null>(null);
	const [isDirty, setIsDirty] = useState(false);
	const [showCloseAlert, setShowCloseAlert] = useState(false);

	const [mode, setMode] = useState<"select" | "pan">("select");
	const lastModeRef = useRef<"select" | "pan">("select");

	const [scale, setScale] = useState(1);
	const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);
	const [screenWidth, setScreenWidth] = useState(100);
	const [screenHeight, setScreenHeight] = useState(100);

	const zoomPercentage = `${Math.round(scale * 100)}%`;

	// Resize observer for dynamic screen sizing
	useEffect(() => {
		const updateSize = () => {
			if (containerRef.current) {
				setScreenWidth(containerRef.current.offsetWidth);
				setScreenHeight(containerRef.current.offsetHeight);
			}
		};
		updateSize();
		window.addEventListener("resize", updateSize);
		return () => window.removeEventListener("resize", updateSize);
	}, []);

	// Fit View logic
	const fitView = useCallback(() => {
		const padding = 60;
		const availableW = screenWidth - padding * 2;
		const availableH = screenHeight - padding * 2;
		const scaleW = availableW / viewportWidth;
		const scaleH = availableH / viewportHeight;
		const newScale = Math.min(scaleW, scaleH);
		const newPos = {
			x: Math.round((screenWidth - viewportWidth * newScale) / 2),
			y: Math.round((screenHeight - viewportHeight * newScale) / 2),
		};
		setScale(newScale);
		setStagePos(newPos);
	}, [viewportWidth, viewportHeight, screenWidth, screenHeight]);

	// Initial centering on mount
	useEffect(() => {
		if (
			screenWidth > 100 &&
			screenHeight > 100 &&
			scale === 1 &&
			stagePos.x === 0
		) {
			fitView();
		}
	}, [screenWidth, screenHeight, fitView, scale, stagePos.x]);

	// Zoom helpers
	const zoomIn = useCallback(() => {
		const newScale = scale * 1.2;
		setScale(newScale);
	}, [scale]);

	const zoomOut = useCallback(() => {
		const newScale = scale / 1.2;
		setScale(newScale);
	}, [scale]);

	const zoomTo = useCallback((value: number) => {
		setScale(value);
	}, []);

	// Data getters for layer content
	const getTextData = useCallback(
		(handleId: string) => {
			const layerData = initialLayers.get(handleId) as OutputItem<"Text">;
			return layerData?.data || "";
		},
		[initialLayers],
	);

	const getImageData = useCallback(
		(handleId: string) => {
			const layerData = initialLayers.get(handleId) as OutputItem<"Image">;
			return layerData?.data ?? {};
		},
		[initialLayers],
	);

	const getImageUrl = useCallback(
		(handleId: string) => {
			const layerData = initialLayers.get(handleId) as OutputItem<"Image">;
			if (layerData?.data.entity) {
				return GetAssetEndpoint(layerData.data.entity);
			}
			return layerData?.data?.processData?.dataUrl;
		},
		[initialLayers],
	);

	// Initialize layers from initial data
	useEffect(() => {
		const loadInitialLayers = async () => {
			const existingConfig = (node.config as CompositorNodeConfig) ?? {
				layerUpdates: {},
			};
			const layerUpdates = { ...existingConfig.layerUpdates };
			let maxZ = Math.max(
				...Object.values(layerUpdates).map((l) => l.zIndex ?? 0),
				0,
			);
			const fontPromises: Promise<void>[] = [];

			initialLayers.forEach((output, handleId) => {
				if (!layerUpdates[handleId]) {
					const newLayer: CompositorLayer = {
						type: output.type,
						width: undefined,
						height: undefined,
						x: 0,
						y: 0,
						id: handleId,
						inputHandleId: handleId,
						rotation: 0,
						lockAspect: true,
						blendMode: "source-over",
						zIndex: ++maxZ,
						opacity: 1,
					};

					if (newLayer.type === "Text") {
						newLayer.width = 300;
						newLayer.fontSize = 40;
						newLayer.fontFamily = "Geist";
						newLayer.fontStyle = "normal";
						newLayer.textDecoration = "";
						newLayer.fill = "#ffffff";
						newLayer.letterSpacing = 0;
						newLayer.lineHeight = 1.2;
						newLayer.height = undefined; // Text auto-height
						newLayer.align = "left";
						newLayer.verticalAlign = "top";
					}

					if (newLayer.type === "Image") {
						const fData = getImageData(handleId);
						if (fData.entity) {
							newLayer.width = Math.round(fData.entity.width ?? 300);
							newLayer.height = Math.round(fData.entity.height ?? 300);
						} else if (fData.processData) {
							newLayer.width = Math.round(fData.processData.width ?? 300);
							newLayer.height = Math.round(fData.processData.height ?? 300);
						} else {
							newLayer.width = 300;
							newLayer.height = 300;
						}
					}
					layerUpdates[handleId] = newLayer;
				}

				const layer = layerUpdates[handleId];
				if (layer.type === "Text" && layer.fontFamily) {
					const fontUrl = GetFontAssetUrl(layer.fontFamily);
					fontPromises.push(fontManager.loadFont(layer.fontFamily, fontUrl));
				}
			});

			await Promise.all(fontPromises);
			updateLayers(Object.values(layerUpdates), false);
		};
		loadInitialLayers();
	}, [initialLayers, node.config, getImageData, updateLayers]);

	// Deselect on pan mode
	useEffect(() => {
		if (mode === "pan" && selectedId) {
			setSelectedId(null);
		}
	}, [mode, selectedId]);

	// Global keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isInput =
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA";
			if (isInput) return;

			// Spacebar for pan
			if (e.code === "Space" && !e.repeat) {
				e.preventDefault();
				if (mode !== "pan") {
					lastModeRef.current = mode;
					setMode("pan");
				}
			}

			// Arrow keys for nudge
			if (
				selectedId &&
				["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
			) {
				e.preventDefault();
				const shift = e.shiftKey ? 10 : 1;
				updateLayers((prev) =>
					prev.map((l) => {
						if (l.id !== selectedId) return l;
						const u = { ...l };
						if (e.key === "ArrowUp") u.y -= shift;
						if (e.key === "ArrowDown") u.y += shift;
						if (e.key === "ArrowLeft") u.x -= shift;
						if (e.key === "ArrowRight") u.x += shift;
						return u;
					}),
				);
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === "Space") {
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
	}, [mode, selectedId, updateLayers]);

	const handleSave = useCallback(() => {
		const layerUpdates = layers.reduce<Record<string, CompositorLayer>>(
			(acc, layer) => {
				acc[layer.inputHandleId] = layer;
				return acc;
			},
			{},
		);
		propOnSave({ layerUpdates, width: viewportWidth, height: viewportHeight });
		setIsDirty(false);
	}, [layers, propOnSave, viewportHeight, viewportWidth]);

	const handleCloseRequest = () => {
		if (isDirty) {
			setShowCloseAlert(true);
		} else {
			onClose();
		}
	};

	return (
		<EditorContext.Provider
			value={{
				layers,
				updateLayers,
				selectedId,
				setSelectedId,
				viewportWidth,
				updateViewportWidth,
				viewportHeight,
				updateViewportHeight,
				screenWidth,
				screenHeight,
				guides,
				setGuides,
				isEditingText,
				setIsEditingText,
				editingLayerId,
				setEditingLayerId,
				stageRef,
				mode,
				setMode,
				scale,
				setScale,
				stagePos,
				setStagePos,
				zoomIn,
				zoomOut,
				zoomTo,
				fitView,
				zoomPercentage,
				getTextData,
				getImageData,
				getImageUrl,
				isDirty,
				setIsDirty,
			}}
		>
			<div className="flex h-screen w-screen bg-[#050505] overflow-hidden relative text-foreground font-sans">
				<div className="relative shrink-0 z-20">
					<LayersPanel />
				</div>

				<div className="flex-1 flex flex-col relative min-w-0 z-0">
					<div
						ref={containerRef}
						className="flex-1 relative overflow-hidden bg-[#050505]"
					>
						{/* Grid Background */}
						<div
							className="absolute inset-0 pointer-events-none"
							style={{
								backgroundImage:
									"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)",
								backgroundSize: "24px 24px",
							}}
						/>
						<Canvas />
					</div>

					{/* Floating Toolbar */}
					<div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
						<Toolbar onSave={handleSave} onClose={handleCloseRequest} />
					</div>
				</div>

				<div className="relative shrink-0 z-20">
					<InspectorPanel />
				</div>

				{/* Close Confirmation Dialog */}
				<AlertDialog open={showCloseAlert} onOpenChange={setShowCloseAlert}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
							<AlertDialogDescription>
								You have unsaved changes. Are you sure you want to leave without
								saving?
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<AlertDialogAction
								onClick={onClose}
								className="bg-red-600 text-white hover:bg-red-700"
							>
								Discard Changes
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</EditorContext.Provider>
	);
};
