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

import type Konva from "konva";
import {
	AlignCenterHorizontal,
	AlignCenterVertical,
	ArrowLeftRight,
	ChevronDown,
	Hand,
	ImageIcon,
	Maximize,
	Minimize,
	MousePointer,
	Move,
	MoveHorizontal,
	RotateCw,
	SaveAll,
	Type,
	X,
} from "lucide-react";
import type React from "react";
import {
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

// Removed use-image import

import type {
	CompositorLayer,
	CompositorNodeConfig,
	FileData,
	OutputItem,
} from "@gatewai/types";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
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
];

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
		if (!url) return; // Skip if no URL

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

// --- Editor Context ---
interface EditorContextType {
	layers: CompositorLayer[];
	updateLayers: (
		updater: SetStateAction<CompositorLayer[]>,
		isUserChange?: boolean,
	) => void;
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;
	// Artboard Dimensions
	viewportWidth: number;
	viewportHeight: number;
	updateViewportWidth: (w: number) => void;
	updateViewportHeight: (h: number) => void;
	// Viewport/Screen Dimensions
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

// --- Custom Hooks ---

// Snap Logic
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
				if (!guideMap.has(key)) {
					guideMap.set(key, g);
				}
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
								height: Math.round(node.height()),
							}
						: l,
				),
			);
		},
		[updateLayers],
	);

	return { handleDragMove, handleDragEnd, handleTransformEnd };
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
	const { setSelectedId, updateLayers, getImageUrl, mode } = useEditor();
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

	// Correctly handle Text resizing:
	// Use width to determine wrap point.
	// Reset scale to 1 so font size doesn't change.
	// Ensure height is at least the minimum required for the text content to prevent clipping.
	const handleTransform = useCallback((e: Konva.KonvaEventObject<Event>) => {
		const node = e.target as Konva.Text;
		const newWidth = Math.max(20, node.width() * node.scaleX());
		let newHeight = Math.max(20, node.height() * node.scaleY());

		node.setAttrs({
			width: newWidth,
			scaleX: 1,
			scaleY: 1,
		});

		// Temporarily unset height to compute the minimum required height for the new width
		node.height(undefined);
		const minHeight = node.height();

		// Set height to max of proposed new height and min required to avoid clipping
		newHeight = Math.max(minHeight, newHeight);
		node.setAttrs({
			height: newHeight,
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

	return (
		<KonvaText
			id={layer.id}
			x={layer.x}
			y={layer.y}
			text={text as string}
			fontSize={layer.fontSize ?? 24}
			fontFamily={layer.fontFamily ?? "Geist"}
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

	return (
		<Transformer
			ref={trRef}
			rotateEnabled
			flipEnabled={false}
			borderStroke="#3b82f6"
			anchorStroke="#3b82f6"
			anchorFill="#ffffff"
			anchorSize={10}
			anchorCornerRadius={2}
			// For images with locked aspect, keep ratio. For Text, allow free width resizing.
			keepRatio={selectedLayer?.type === "Image" && selectedLayer.lockAspect}
			enabledAnchors={
				selectedLayer?.type === "Image" && selectedLayer.lockAspect
					? ["top-left", "top-right", "bottom-left", "bottom-right"]
					: undefined
			}
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
					stroke="#f43f5e"
					strokeWidth={1}
					dash={[4, 4]}
				/>
			))}
		</>
	);
};

const ArtboardBackground: React.FC = () => {
	const { viewportWidth, viewportHeight } = useEditor();
	const patternImage = useMemo(() => {
		const size = 20;
		const half = size / 2;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "#1e1e1e"; // Slightly lighter than bg
			ctx.fillRect(0, 0, size, size);
			ctx.fillStyle = "#262626"; // Checker
			ctx.fillRect(0, 0, half, half);
			ctx.fillRect(half, half, half, half);
		}
		return canvas;
	}, []);

	return (
		<Group>
			{/* Shadow for depth/elevation */}
			<Rect
				x={0}
				y={0}
				width={viewportWidth}
				height={viewportHeight}
				fill="#000"
				shadowColor="black"
				shadowBlur={50}
				shadowOpacity={0.5}
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
				lastModeRef.current = mode;
				setMode("pan");
				const reset = () => {
					setMode(lastModeRef.current);
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

			const direction = e.evt.deltaY > 0 ? -1 : 1;
			const scaleBy = 1.1;
			const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

			if (newScale < 0.1 || newScale > 10) return;

			const newPos = {
				x: pointer.x - mousePointTo.x * newScale,
				y: pointer.y - mousePointTo.y * newScale,
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
						return <ImageLayer {...props} key={layer.id} />;
					}
					if (layer.type === "Text") {
						return <TextLayer {...props} layer={layer} key={layer.id} />;
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
	} = useSortable({ id: layer.id });

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
			className="mb-1"
		>
			<Button
				variant="ghost"
				onClick={() => {
					if (!isDragging) setSelectedId(layer.id);
				}}
				className={`
          cursor-pointer w-full rounded-md flex items-center gap-2 px-2 py-1.5 h-auto
          transition-colors duration-200 border border-transparent
          ${
						isSelected
							? "bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50 text-blue-100"
							: "hover:bg-accent text-muted-foreground hover:text-foreground"
					}
        `}
			>
				{layer.type === "Image" ? (
					<ImageIcon className="size-3.5 shrink-0 text-blue-400" />
				) : (
					<Type className="size-3.5 shrink-0 text-green-400" />
				)}
				<span className="truncate flex-1 text-left text-xs font-medium">
					{layer.id}
				</span>
			</Button>
		</div>
	);
};

const LayersPanel: React.FC<{ onSave: () => void; onClose: () => void }> = ({
	onSave,
	onClose,
}) => {
	const { layers, updateLayers, selectedId, setSelectedId } = useEditor();
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
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
		<div className="absolute left-0 top-0 bottom-0 w-60 bg-card border-r border-border z-10 flex flex-col shadow-xl">
			<div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
				<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Layers
				</span>
				<div className="flex items-center gap-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								onClick={onSave}
								size="icon"
								variant="ghost"
								className="h-6 w-6 hover:bg-primary/20 hover:text-primary"
							>
								<SaveAll className="size-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Save Changes</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								onClick={onClose}
								size="icon"
								variant="ghost"
								className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
							>
								<X className="size-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Close</TooltipContent>
					</Tooltip>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-2">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={(e) => {
						const { active, over } = e;
						if (over && active.id !== over.id) {
							updateLayers((currentLayers) => {
								const currentSorted = [...currentLayers].sort(
									(a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
								);
								const oldIndex = currentSorted.findIndex(
									(l) => l.id === active.id,
								);
								const newIndex = currentSorted.findIndex(
									(l) => l.id === over.id,
								);
								const newSorted = arrayMove(currentSorted, oldIndex, newIndex);
								return currentLayers.map((l) => {
									const pos = newSorted.findIndex((s) => s.id === l.id);
									return { ...l, zIndex: newSorted.length - pos };
								});
							});
						}
					}}
				>
					<SortableContext
						items={sortedLayers.map((l) => l.id)}
						strategy={verticalListSortingStrategy}
					>
						<div className="flex flex-col space-y-0.5">
							{sortedLayers.map((layer) => (
								<LayerItem
									key={layer.id}
									layer={layer}
									selectedId={selectedId}
									setSelectedId={setSelectedId}
								/>
							))}
							{sortedLayers.length === 0 && (
								<div className="py-8 text-center text-xs text-muted-foreground italic">
									No layers available
								</div>
							)}
						</div>
					</SortableContext>
				</DndContext>
			</div>
		</div>
	);
};

const InspectorPanel: React.FC = () => {
	const { data: fontList } = useGetFontListQuery({});
	const fontNames = useMemo(() => {
		if (Array.isArray(fontList) && (fontList as string[])?.length > 0) {
			return fontList as string[];
		}
		return ["Geist", "Inter", "Arial"];
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
			{ label: "Instagram Square (1:1)", width: 1080, height: 1080 },
			{ label: "Instagram Portrait (4:5)", width: 1080, height: 1350 },
			{ label: "Story / 9:16", width: 1080, height: 1920 },
			{ label: "Landscape (16:9)", width: 1920, height: 1080 },
		],
		[],
	);

	return (
		<div className="absolute right-0 top-0 bottom-0 w-64 bg-card border-l border-border z-10 flex flex-col shadow-xl overflow-y-auto">
			<div className="p-4 space-y-6">
				{/* Canvas Settings */}
				<section>
					<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
						Canvas
					</h3>
					<div className="grid grid-cols-2 gap-2 mb-3">
						<DraggableNumberInput
							label="W"
							icon={MoveHorizontal}
							value={Math.round(viewportWidth)}
							onChange={(v) => updateViewportWidth(v || 800)}
							min={1}
						/>
						<DraggableNumberInput
							label="H"
							icon={Move} // Using generic move for Height
							value={Math.round(viewportHeight)}
							onChange={(v) => updateViewportHeight(v || 600)}
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
						<SelectTrigger className="h-8 text-xs">
							<SelectValue placeholder="Presets" />
						</SelectTrigger>
						<SelectContent>
							{aspectRatios.map((r) => (
								<SelectItem key={r.label} value={r.label}>
									{r.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</section>

				<Separator />

				{/* Layer Properties */}
				{selectedLayer ? (
					<>
						<section>
							<div className="flex items-center justify-between mb-3">
								<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Transform
								</h3>
								<div className="flex gap-1">
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={() => centerLayer("x")}
										title="Center Horizontally"
									>
										<AlignCenterHorizontal className="w-3 h-3" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-6 w-6"
										onClick={() => centerLayer("y")}
										title="Center Vertically"
									>
										<AlignCenterVertical className="w-3 h-3" />
									</Button>
								</div>
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
									icon={Move} // Generic move
									value={Math.round(selectedLayer.y)}
									onChange={(v) => updateLayer({ y: v })}
								/>
								<DraggableNumberInput
									label="W"
									icon={Maximize}
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
								<DraggableNumberInput
									label="H"
									icon={Minimize}
									value={Math.round(
										selectedLayer.height ?? selectedLayer.computedHeight ?? 0,
									)}
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
										} else if (selectedLayer.type === "Text") {
											updateLayer({ height: newHeight });
										}
									}}
									min={1}
								/>
							</div>
							<div className="grid grid-cols-2 gap-3">
								<DraggableNumberInput
									label="Rotation"
									icon={RotateCw}
									value={selectedLayer.rotation}
									onChange={(v) => updateLayer({ rotation: v })}
								/>
								{/* Placeholder for opacity if needed, using generic input */}
								<div className="space-y-1">
									<Label className="text-[10px] text-muted-foreground uppercase">
										Opacity
									</Label>
									<div className="relative">
										<Input
											value={100}
											disabled
											className="h-8 text-xs font-mono bg-muted/20"
										/>
										<span className="absolute right-2 top-1.5 text-xs text-muted-foreground pointer-events-none">
											%
										</span>
									</div>
								</div>
							</div>
						</section>

						{selectedLayer.type === "Image" && (
							<section>
								<div className="flex items-center space-x-2 mt-2">
									<Switch
										id="lockAspect"
										checked={selectedLayer.lockAspect ?? true}
										onCheckedChange={(checked) =>
											updateLayer({ lockAspect: checked })
										}
									/>
									<Label htmlFor="lockAspect" className="text-xs">
										Lock Aspect Ratio
									</Label>
								</div>
							</section>
						)}

						{selectedLayer.type === "Text" && (
							<>
								<Separator />
								<section className="space-y-3">
									<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Typography
									</h3>
									<div className="space-y-1">
										<Select
											value={selectedLayer.fontFamily || "Geist"}
											onValueChange={(val) => updateLayer({ fontFamily: val })}
										>
											<SelectTrigger className="h-8 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{fontNames.map((f) => (
													<SelectItem key={f} value={f}>
														{f.replace("_", " ")}
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
											<Label className="text-[10px] text-muted-foreground uppercase">
												Color
											</Label>
											<ColorInput
												id="fill"
												value={selectedLayer.fill ?? "#ffffff"}
												onChange={(e) => updateLayer({ fill: e })}
												className="h-8 w-full"
											/>
										</div>
									</div>

									<div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-md">
										<Button
											variant={
												selectedLayer.align === "left" ? "secondary" : "ghost"
											}
											size="sm"
											className="h-6 px-0"
											onClick={() => updateLayer({ align: "left" })}
										>
											<span className="text-[10px]">Left</span>
										</Button>
										<Button
											variant={
												selectedLayer.align === "center" ? "secondary" : "ghost"
											}
											size="sm"
											className="h-6 px-0"
											onClick={() => updateLayer({ align: "center" })}
										>
											<span className="text-[10px]">Center</span>
										</Button>
										<Button
											variant={
												selectedLayer.align === "right" ? "secondary" : "ghost"
											}
											size="sm"
											className="h-6 px-0"
											onClick={() => updateLayer({ align: "right" })}
										>
											<span className="text-[10px]">Right</span>
										</Button>
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
											icon={ArrowLeftRight}
											value={selectedLayer.lineHeight ?? 1}
											onChange={(v) => updateLayer({ lineHeight: v })}
											allowDecimal
											min={0.1}
											step={0.1}
										/>
									</div>
								</section>
							</>
						)}

						<Separator />

						<section className="space-y-3">
							<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								Blending
							</h3>
							<Select
								value={selectedLayer.blendMode || "source-over"}
								onValueChange={(val) => updateLayer({ blendMode: val })}
							>
								<SelectTrigger className="h-8 text-xs capitalize">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{BLEND_MODES.map((m) => (
										<SelectItem key={m} value={m} className="capitalize">
											{m.replace("-", " ")}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</section>
					</>
				) : (
					<div className="flex flex-col items-center justify-center h-48 text-muted-foreground space-y-2 text-center opacity-50">
						<MousePointer className="w-8 h-8" />
						<p className="text-xs">Select a layer to edit properties</p>
					</div>
				)}
			</div>
		</div>
	);
};

// --- Main Designer Component ---

interface CanvasDesignerEditorProps {
	initialLayers: Map<
		HandleEntityType["id"],
		OutputItem<"Text"> | OutputItem<"Image">
	>;
	node: NodeEntityType;
	onClose: () => void;
	onSave: (config: CompositorNodeConfig) => void;
}

export const CanvasDesignerEditor: React.FC<CanvasDesignerEditorProps> = ({
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

	// Resize observer
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

	// Fit View
	const fitView = useCallback(() => {
		const padding = 60;
		const availableW = screenWidth - padding * 2;
		const availableH = screenHeight - padding * 2;
		const scaleW = availableW / viewportWidth;
		const scaleH = availableH / viewportHeight;
		const newScale = Math.min(scaleW, scaleH);
		const newPos = {
			x: (screenWidth - viewportWidth * newScale) / 2,
			y: (screenHeight - viewportHeight * newScale) / 2,
		};
		setScale(newScale);
		setStagePos(newPos);
	}, [viewportWidth, viewportHeight, screenWidth, screenHeight]);

	// Initial Center
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

	// Zoom Helpers
	const zoomIn = useCallback(() => {
		const center = { x: screenWidth / 2, y: screenHeight / 2 };
		const mousePointTo = {
			x: (center.x - stagePos.x) / scale,
			y: (center.y - stagePos.y) / scale,
		};
		const newScale = scale * 1.2;
		const newPos = {
			x: center.x - mousePointTo.x * newScale,
			y: center.y - mousePointTo.y * newScale,
		};
		setScale(newScale);
		setStagePos(newPos);
	}, [scale, stagePos, screenWidth, screenHeight]);

	const zoomOut = useCallback(() => {
		const center = { x: screenWidth / 2, y: screenHeight / 2 };
		const mousePointTo = {
			x: (center.x - stagePos.x) / scale,
			y: (center.y - stagePos.y) / scale,
		};
		const newScale = scale / 1.2;
		const newPos = {
			x: center.x - mousePointTo.x * newScale,
			y: center.y - mousePointTo.y * newScale,
		};
		setScale(newScale);
		setStagePos(newPos);
	}, [scale, stagePos, screenWidth, screenHeight]);

	const zoomTo = useCallback(
		(value: number) => {
			const center = { x: screenWidth / 2, y: screenHeight / 2 };
			const mousePointTo = {
				x: (center.x - stagePos.x) / scale,
				y: (center.y - stagePos.y) / scale,
			};
			const newPos = {
				x: center.x - mousePointTo.x * value,
				y: center.y - mousePointTo.y * value,
			};
			setScale(value);
			setStagePos(newPos);
		},
		[scale, stagePos, screenWidth, screenHeight],
	);

	// Data Getters
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
				return GetAssetEndpoint(layerData.data.entity.id);
			}
			return layerData?.data?.processData?.dataUrl;
		},
		[initialLayers],
	);

	// Initialize Layers
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
					// New layer init
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
					};

					if (newLayer.type === "Text") {
						newLayer.width = 300;
						newLayer.fontSize = 40;
						newLayer.fontFamily = "Geist";
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

	// Deselect on Pan
	useEffect(() => {
		if (mode === "pan" && selectedId) {
			setSelectedId(null);
		}
	}, [mode, selectedId]);

	// Global Keyboard Shortcuts (Space Pan, Arrows Nudge, Delete)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isInput =
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA";
			if (isInput) return;

			// Spacebar Pan
			if (e.code === "Space" && !e.repeat) {
				e.preventDefault();
				if (mode !== "pan") {
					lastModeRef.current = mode;
					setMode("pan");
				}
			}

			// Arrow Nudge
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
				setMode(lastModeRef.current); // Revert to previous mode
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
			<div className="flex h-screen w-screen bg-background overflow-hidden relative text-foreground">
				<div className="relative shrink-0 z-20">
					<LayersPanel onSave={handleSave} onClose={handleCloseRequest} />
				</div>

				<div className="flex-1 flex flex-col relative min-w-0 z-0">
					<div
						ref={containerRef}
						className="flex-1 relative overflow-hidden bg-neutral-900/90"
					>
						{/* Grid Background */}
						<div
							className="absolute inset-0 pointer-events-none"
							style={{
								backgroundImage:
									"radial-gradient(circle, #404040 1px, transparent 1px)",
								backgroundSize: "24px 24px",
								opacity: 0.3,
							}}
						/>
						<Canvas />
					</div>

					{/* Floating Toolbar */}
					<div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
						<Menubar className="border border-border/50 bg-background/80 backdrop-blur-md shadow-2xl rounded-full px-2 py-1 h-12 ring-1 ring-white/5">
							<Button
								title="Select (V)"
								variant={mode === "select" ? "secondary" : "ghost"}
								size="icon"
								className="rounded-full w-9 h-9"
								onClick={() => setMode("select")}
							>
								<MousePointer className="w-4 h-4" />
							</Button>
							<Button
								title="Pan (Space)"
								variant={mode === "pan" ? "secondary" : "ghost"}
								size="icon"
								className="rounded-full w-9 h-9"
								onClick={() => setMode("pan")}
							>
								<Hand className="w-4 h-4" />
							</Button>

							<div className="w-px h-5 bg-border mx-2" />

							<MenubarMenu>
								<MenubarTrigger asChild>
									<Button
										variant="ghost"
										className="h-9 px-3 text-xs font-mono rounded-full"
									>
										{zoomPercentage}{" "}
										<ChevronDown className="w-3 h-3 ml-2 opacity-50" />
									</Button>
								</MenubarTrigger>
								<MenubarContent align="center" className="min-w-[140px]">
									<MenubarItem onClick={() => zoomIn()}>Zoom In</MenubarItem>
									<MenubarItem onClick={() => zoomOut()}>Zoom Out</MenubarItem>
									<MenubarItem onClick={() => zoomTo(1)}>
										Actual Size (100%)
									</MenubarItem>
									<MenubarItem onClick={() => zoomTo(2)}>200%</MenubarItem>
									<Separator className="my-1" />
									<MenubarItem onClick={() => fitView()}>
										Fit to Screen
									</MenubarItem>
								</MenubarContent>
							</MenubarMenu>
						</Menubar>
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
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
