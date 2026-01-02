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
	ChevronDown,
	Hand,
	ImageIcon,
	MousePointer,
	SaveAll,
	TextIcon,
	X,
} from "lucide-react";
import type React from "react";
import {
	createContext,
	type Dispatch,
	type MutableRefObject,
	type SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { TouchBackend } from "react-dnd-touch-backend";
import { BsAspectRatio } from "react-icons/bs";
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
import { Button } from "@/components/ui/button";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColorInput } from "@/components/util/color-input";
import { BLEND_MODES } from "@/routes/canvas/blend-modes";
import { useGetFontListQuery } from "@/store/fonts";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint, GetFontAssetUrl } from "@/utils/file";

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

// Editor Context
interface EditorContextType {
	layers: CompositorLayer[];
	setLayers: Dispatch<SetStateAction<CompositorLayer[]>>;
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;
	// The dimensions of the "Artboard" (Output size)
	viewportWidth: number;
	viewportHeight: number;
	setViewportWidth: (w: number) => void;
	setViewportHeight: (h: number) => void;
	// The dimensions of the visible window (Screen size)
	screenWidth: number;
	screenHeight: number;
	guides: Guide[];
	setGuides: Dispatch<SetStateAction<Guide[]>>;
	isEditingText: boolean;
	setIsEditingText: (editing: boolean) => void;
	editingLayerId: string | null;
	setEditingLayerId: (id: string | null) => void;
	stageRef: MutableRefObject<Konva.Stage | null>;
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
// Snap logic hook
const useSnap = () => {
	const { layers, setLayers, viewportWidth, viewportHeight, setGuides } =
		useEditor();
	const SNAP_THRESHOLD = 5;
	const getSnapPositions = useCallback(
		(excludeId: string) => {
			const hSnaps: number[] = [
				0,
				Math.round(viewportHeight / 2),
				viewportHeight,
			]; // Canvas edges and center
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
			setLayers((prev) =>
				prev.map((l) =>
					l.id === id
						? { ...l, x: Math.round(node.x()), y: Math.round(node.y()) }
						: l,
				),
			);
			setGuides([]);
		},
		[setLayers, setGuides],
	);
	const handleTransformEnd = useCallback(
		(e: Konva.KonvaEventObject<Event>) => {
			const node = e.target;
			const id = node.id();
			setLayers((prev) =>
				prev.map((l) =>
					l.id === id
						? {
								...l,
								x: Math.round(node.x()),
								y: Math.round(node.y()),
								rotation: Math.round(node.rotation()),
								width: Math.round(node.width()),
								height:
									l.type === "Image" ? Math.round(node.height()) : l.height,
							}
						: l,
				),
			);
		},
		[setLayers],
	);
	return { handleDragMove, handleDragEnd, handleTransformEnd };
};
// Blending modes list
const blendModes = BLEND_MODES;
// Layer Props
interface LayerProps {
	layer: CompositorLayer;
	onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
	onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
	onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
	onTransformStart: (e: Konva.KonvaEventObject<Event>) => void;
	onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
}
// Image Layer Component
const ImageLayer: React.FC<LayerProps> = ({
	layer,
	onDragStart,
	onDragMove,
	onDragEnd,
	onTransformStart,
	onTransformEnd,
}) => {
	const { setSelectedId, setLayers, getImageUrl, mode } = useEditor();
	const url = getImageUrl(layer.inputHandleId);
	const [image] = useImage(url ?? "", "anonymous");
	useEffect(() => {
		if (image && (!layer.width || !layer.height)) {
			setLayers((prev) =>
				prev.map((l) =>
					l.id === layer.id
						? {
								...l,
								width: Math.round(image.width),
								height: Math.round(image.height),
							}
						: l,
				),
			);
		}
	}, [image, layer.id, layer.width, layer.height, setLayers]);
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
// Text Layer Component
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
		setLayers,
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
	const handleTransform = useCallback((e: Konva.KonvaEventObject<Event>) => {
		const node = e.target as Konva.Text;
		const newWidth = Math.max(20, Math.round(node.width() * node.scaleX()));
		node.setAttrs({
			width: newWidth,
			scaleX: 1,
			scaleY: 1,
		});
	}, []);
	useEffect(() => {
		const node = stageRef.current?.findOne(`#${layer.id}`) as
			| Konva.Text
			| undefined;
		if (node && layer.type === "Text") {
			const newHeight = Math.round(node.height());
			if (newHeight !== layer.computedHeight) {
				setLayers((prev) =>
					prev.map((l) =>
						l.id === layer.id ? { ...l, computedHeight: newHeight } : l,
					),
				);
			}
		}
	}, [layer.id, layer.type, setLayers, stageRef, layer.computedHeight]);
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
			padding={1} // This makes word wrap consistent with pixi js
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
// Transformer component
const TransformerComponent: React.FC = () => {
	const { selectedId, layers, stageRef, mode } = useEditor();
	const trRef = useRef<Konva.Transformer>(null);
	useEffect(() => {
		if (selectedId && trRef.current && stageRef.current && mode === "select") {
			const node = stageRef.current.findOne(`#${selectedId}`);
			if (node) {
				trRef.current.nodes([node]);
				trRef.current.getLayer()?.batchDraw();
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
// Guides Component
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
					stroke="#ff4500"
					strokeWidth={1}
				/>
			))}
		</>
	);
};
// The background "Paper" representing the viewport
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
			// Base fill (equivalent to transparent in CSS, but using white for opaque checkerboard)
			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, size, size);
			// Checker color squares (assuming --checker-color is a light gray)
			ctx.fillStyle = "#cccccc";
			ctx.fillRect(0, 0, half, half);
			ctx.fillRect(half, half, half, half);
		}
		return canvas;
	}, []);
	return (
		<Group>
			{/* Shadow for depth effect */}
			<Rect
				x={10}
				y={10}
				width={viewportWidth}
				height={viewportHeight}
				fill="rgba(0,0,0,0.3)"
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
				shadowColor="black"
				shadowBlur={20}
				shadowOpacity={0.2}
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
		scale,
		stagePos,
		setScale,
		setStagePos,
	} = useEditor();
	const { handleDragMove, handleDragEnd, handleTransformEnd } = useSnap();
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);
	const handleStageClick = useCallback(
		(e: Konva.KonvaEventObject<TouchEvent | MouseEvent>) => {
			if (e.target === stageRef.current) {
				setSelectedId(null);
			}
		},
		[stageRef, setSelectedId],
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
			const newPos = {
				x: pointer.x - mousePointTo.x * newScale,
				y: pointer.y - mousePointTo.y * newScale,
			};
			setScale(newScale);
			setStagePos(newPos);
		},
		[stageRef, setScale, setStagePos],
	);
	// Sync stage transform
	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;
		stage.scale({ x: scale, y: scale });
		stage.position(stagePos);
		stage.batchDraw();
	}, [scale, stagePos, stageRef]);
	// Handle stage drag for panning
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
			draggable={mode === "pan"}
		>
			<KonvaLayer>
				{/* The "Paper" Area - Visualizes the 0,0 to W,H coordinate system */}
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
	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className="mb-2"
		>
			<Button
				variant="ghost"
				onClick={() => {
					// Prevent drag click from triggering select immediately if dragging
					if (!isDragging) setSelectedId(layer.id);
				}}
				className={`cursor-pointer w-full rounded-sm flex items-center gap-2 p-2 transition-colors duration-200 hover:bg-gray-800 ${
					layer.id === selectedId
						? "bg-gray-800 border-l-2 border-blue-500"
						: ""
				}`}
			>
				{layer.type === "Image" ? (
					<ImageIcon className="size-4 text-blue-400" />
				) : (
					<TextIcon className="size-4 text-green-400" />
				)}{" "}
				<span className="truncate flex-1 text-left">
					{layer.type} - {layer.id.slice(0, 4)}
				</span>
			</Button>
		</div>
	);
};
const LayersPanel: React.FC<{ onSave: () => void; onClose: () => void }> = ({
	onSave,
	onClose,
}) => {
	const { layers, setLayers, selectedId, setSelectedId } = useEditor();
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0)),
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
		<div className="absolute left-0 top-0 bottom-0 w-56 overflow-y-auto bg-background p-3 border-r border-gray-800 z-10 text-xs flex flex-col">
			<div className="flex justify-between items-center mb-4">
				<h3 className="font-bold text-gray-100">Layers</h3>
				<div className="flex gap-1">
					<Button onClick={onClose} size="icon" variant="ghost" title="Close">
						<X className="size-4 rotate-90" />
					</Button>
					<Button onClick={onSave} size="icon" title="Save">
						<SaveAll className="size-4" />
					</Button>
				</div>
			</div>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={(e) => {
					const { active, over } = e;
					if (over && active.id !== over.id) {
						setLayers((currentLayers) => {
							const currentSorted = [...currentLayers].sort(
								(a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
							);
							const oldIndex = currentSorted.findIndex(
								(l) => l.id === active.id,
							);
							const newIndex = currentSorted.findIndex((l) => l.id === over.id);
							const newSorted = arrayMove(currentSorted, oldIndex, newIndex);
							const newLayers = currentLayers.map((l) => {
								const pos = newSorted.findIndex((s) => s.id === l.id);
								return { ...l, zIndex: newSorted.length - pos };
							});
							return newLayers;
						});
					}
				}}
			>
				<SortableContext
					items={sortedLayers.map((l) => l.id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="flex flex-col">
						{sortedLayers.map((layer) => (
							<LayerItem
								key={layer.id}
								layer={layer}
								selectedId={selectedId}
								setSelectedId={setSelectedId}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	);
};
// Inspector Panel (Right sidebar like Figma)
const InspectorPanel: React.FC = () => {
	const { data: fontList } = useGetFontListQuery({});
	const fontNames = useMemo(() => {
		if (Array.isArray(fontList) && (fontList as string[])?.length > 0) {
			return fontList as string[];
		}
		return [];
	}, [fontList]);
	const {
		selectedId,
		layers,
		setLayers,
		viewportWidth,
		setViewportWidth,
		viewportHeight,
		setViewportHeight,
	} = useEditor();
	const selectedLayer = layers.find((l) => l.id === selectedId);
	const updateLayer = async (updates: Partial<CompositorLayer>) => {
		if (updates.fontFamily) {
			const fontUrl = GetFontAssetUrl(updates.fontFamily);
			await fontManager.loadFont(updates.fontFamily, fontUrl);
		}
		setLayers((prev) =>
			prev.map((l) => (l.id === selectedId ? { ...l, ...updates } : l)),
		);
	};
	let computedWidth = 0;
	let computedHeight = 0;
	if (selectedLayer) {
		computedWidth = selectedLayer.width ?? 0;
		computedHeight =
			selectedLayer.type === "Image"
				? (selectedLayer.height ?? 0)
				: (selectedLayer.computedHeight ?? 0);
	}
	const aspectRatios = useMemo(
		() => [
			{ label: "1:1", width: 800, height: 800 },
			{ label: "16:9", width: 1280, height: 720 },
			{ label: "9:16", width: 720, height: 1280 },
			{ label: "4:3", width: 800, height: 600 },
			{ label: "3:4", width: 600, height: 800 },
		],
		[],
	);
	return (
		<div className="absolute right-0 top-0 bottom-0 w-56 overflow-y-auto bg-background p-4 border-l border-gray-700 z-10 text-gray-200">
			<h3 className="mb-4 text-xl font-bold text-gray-100">Canvas</h3>
			<div className="space-y-4">
				<div className="flex flex-wrap gap-2 mb-4">
					{aspectRatios.map((ratio) => (
						<Tooltip key={ratio.label}>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									onClick={() => {
										setViewportWidth(ratio.width);
										setViewportHeight(ratio.height);
									}}
									className="p-2"
								>
									<BsAspectRatio className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>{ratio.label}</p>
							</TooltipContent>
						</Tooltip>
					))}
				</div>
				<div className="flex gap-2">
					<div className="flex-1 flex flex-col gap-1">
						<Label htmlFor="canvas-width">Width:</Label>
						<Input
							id="canvas-width"
							type="number"
							step="1"
							value={Math.round(viewportWidth)}
							onChange={(e) =>
								setViewportWidth(parseInt(e.target.value) || 800)
							}
							placeholder="Width"
							className="w-full"
						/>
					</div>
					<div className="flex-1 flex flex-col gap-1">
						<Label htmlFor="canvas-height">Height:</Label>
						<Input
							id="canvas-height"
							type="number"
							step="1"
							value={Math.round(viewportHeight)}
							onChange={(e) =>
								setViewportHeight(parseInt(e.target.value) || 600)
							}
							placeholder="Height"
							className="w-full"
						/>
					</div>
				</div>
				{selectedLayer && (
					<>
						<hr className="my-4 border-gray-600" />
						<h4 className="mb-2 text-lg font-semibold text-gray-100">
							Layer Properties
						</h4>
						<div className="flex gap-2">
							<div className="flex-1 flex flex-col gap-1">
								<Label htmlFor="x">X:</Label>
								<Input
									id="x"
									type="number"
									step="1"
									value={Math.round(selectedLayer.x)}
									onChange={(e) =>
										updateLayer({ x: Number(e.target.value) || 0 })
									}
								/>
							</div>
							<div className="flex-1 flex flex-col gap-1">
								<Label htmlFor="y">Y:</Label>
								<Input
									id="y"
									type="number"
									step="1"
									value={Math.round(selectedLayer.y)}
									onChange={(e) =>
										updateLayer({ y: Number(e.target.value) || 0 })
									}
								/>
							</div>
						</div>
						<div className="flex gap-2">
							<div className="flex-1 flex flex-col gap-1">
								<Label htmlFor="width">Width:</Label>
								<Input
									id="width"
									type="number"
									step="1"
									value={Math.round(computedWidth)}
									onChange={(e) => {
										const newWidth = Number(e.target.value) || 0;
										if (selectedLayer.type === "Text") {
											updateLayer({ width: newWidth });
										} else {
											if (selectedLayer.lockAspect) {
												const oldWidth = selectedLayer.width ?? 1;
												const oldHeight = selectedLayer.height ?? 1;
												const ratio = oldHeight / oldWidth;
												updateLayer({
													width: newWidth,
													height: newWidth * ratio,
												});
											} else {
												updateLayer({ width: newWidth });
											}
										}
									}}
								/>
							</div>
							{selectedLayer.type === "Image" && (
								<div className="flex-1 flex flex-col gap-1">
									<Label htmlFor="height">Height:</Label>
									<Input
										id="height"
										type="number"
										step="1"
										value={Math.round(computedHeight)}
										onChange={(e) => {
											const newHeight = Number(e.target.value) || 0;
											if (selectedLayer.lockAspect) {
												const oldWidth = selectedLayer.width ?? 1;
												const oldHeight = selectedLayer.height ?? 1;
												const ratio = oldWidth / oldHeight;
												updateLayer({
													height: newHeight,
													width: newHeight * ratio,
												});
											} else {
												updateLayer({ height: newHeight });
											}
										}}
									/>
								</div>
							)}
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor="rotation">Rotation:</Label>
							<Slider
								id="rotation"
								value={[selectedLayer.rotation]}
								onValueChange={(v) => updateLayer({ rotation: v[0] })}
								min={-360}
								max={360}
								step={1}
							/>
							<div className="text-sm text-gray-400 mt-1">
								{selectedLayer.rotation}°
							</div>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor="blendMode">Blending Mode:</Label>
							<Select
								value={selectedLayer.blendMode}
								onValueChange={(value) => updateLayer({ blendMode: value })}
							>
								<SelectTrigger id="blendMode">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{blendModes.map((mode) => (
										<SelectItem key={mode} value={mode}>
											{mode}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor="zIndex">Z-Index:</Label>
							<Input
								id="zIndex"
								type="number"
								value={selectedLayer.zIndex ?? 0}
								onChange={(e) =>
									updateLayer({ zIndex: Number(e.target.value) })
								}
							/>
						</div>
						{selectedLayer.type === "Text" && (
							<>
								<div className="flex flex-col gap-1">
									<Label htmlFor="fontSize">Font Size:</Label>
									<Slider
										id="fontSize"
										value={[selectedLayer.fontSize || 24]}
										onValueChange={(v) => updateLayer({ fontSize: v[0] })}
										min={8}
										max={72}
										step={1}
									/>
									<div className="text-sm text-gray-400 mt-1">
										{(selectedLayer.fontSize || 24).toFixed(2)}px
									</div>
								</div>
								<div className="flex flex-col gap-1">
									<Label htmlFor="fontFamily">Font Family:</Label>
									<Select
										value={selectedLayer.fontFamily || "Geist"}
										onValueChange={(value) =>
											updateLayer({ fontFamily: value })
										}
									>
										<SelectTrigger id="fontFamily">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{fontNames.map((fontName) => (
												<SelectItem key={`${fontName}_opt`} value={fontName}>
													{fontName.replace("_", " ")}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex flex-col gap-1">
									<Label htmlFor="color">Color:</Label>
									<ColorInput
										id="color"
										value={selectedLayer.fill ?? "#fff"}
										onChange={(e) => updateLayer({ fill: e })}
										className="w-full h-8 cursor-pointer"
									/>
								</div>
								<hr className="my-4 border-gray-600" />
								<div className="flex flex-col gap-1">
									<Label htmlFor="letterSpacing">Letter Spacing:</Label>
									<Slider
										id="letterSpacing"
										value={[selectedLayer.letterSpacing ?? 0]}
										onValueChange={(v) => updateLayer({ letterSpacing: v[0] })}
										min={-10}
										max={50}
										step={1}
									/>
									<div className="text-sm text-gray-400 mt-1">
										{(selectedLayer.letterSpacing ?? 0).toFixed(0)}px
									</div>
								</div>
								<div className="flex flex-col gap-1">
									<Label htmlFor="lineHeight">Line Height:</Label>
									<Slider
										id="lineHeight"
										value={[selectedLayer.lineHeight ?? 1]}
										onValueChange={(v) => updateLayer({ lineHeight: v[0] })}
										min={0.5}
										max={3}
										step={0.1}
									/>
									<div className="text-sm text-gray-400 mt-1">
										{(selectedLayer.lineHeight ?? 1).toFixed(1)}
									</div>
								</div>
								<div className="flex flex-col gap-1">
									<Label htmlFor="align">Horizontal Alignment:</Label>
									<Select
										value={selectedLayer.align ?? "left"}
										onValueChange={(value) => updateLayer({ align: value })}
									>
										<SelectTrigger id="align">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="left">Left</SelectItem>
											<SelectItem value="center">Center</SelectItem>
											<SelectItem value="right">Right</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="flex flex-col gap-1">
									<Label htmlFor="verticalAlign">Vertical Alignment:</Label>
									<Select
										value={selectedLayer.verticalAlign ?? "top"}
										onValueChange={(value) =>
											updateLayer({ verticalAlign: value })
										}
									>
										<SelectTrigger id="verticalAlign">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="top">Top</SelectItem>
											<SelectItem value="middle">Middle</SelectItem>
											<SelectItem value="bottom">Bottom</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</>
						)}
						{selectedLayer.type === "Image" && (
							<div className="flex items-center space-x-2">
								<Switch
									id="lockAspect"
									checked={selectedLayer.lockAspect ?? true}
									onCheckedChange={(checked) =>
										updateLayer({ lockAspect: checked })
									}
								/>
								<Label htmlFor="lockAspect">Lock Aspect Ratio</Label>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
};
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
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [viewportWidth, setViewportWidth] = useState(nodeConfig.width ?? 1024);
	const [viewportHeight, setViewportHeight] = useState(
		nodeConfig.height ?? 1024,
	);
	const [guides, setGuides] = useState<Guide[]>([]);
	const [isEditingText, setIsEditingText] = useState(false);
	const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
	const stageRef = useRef<Konva.Stage | null>(null);
	const [mode, setMode] = useState<"select" | "pan">("select");
	const [scale, setScale] = useState(1);
	const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);
	const [screenWidth, setScreenWidth] = useState(100);
	const [screenHeight, setScreenHeight] = useState(100);
	const zoomPercentage = `${Math.round(scale * 100)}%`;
	// Resize observer to keep track of available screen space for the canvas
	useEffect(() => {
		const updateSize = () => {
			if (containerRef.current) {
				setScreenWidth(containerRef.current.offsetWidth);
				setScreenHeight(containerRef.current.offsetHeight);
			}
		};
		// Initial sizing
		updateSize();
		window.addEventListener("resize", updateSize);
		return () => window.removeEventListener("resize", updateSize);
	}, []);
	// Center the artboard initially
	useEffect(() => {
		if (screenWidth > 100 && screenHeight > 100) {
			const x = (screenWidth - viewportWidth) / 2;
			const y = (screenHeight - viewportHeight) / 2;
			setStagePos({ x, y });
		}
	}, [screenWidth, screenHeight, viewportHeight, viewportWidth]);
	const zoomIn = useCallback(() => {
		const stage = stageRef.current;
		if (!stage) return;
		const oldScale = scale;
		const center = { x: screenWidth / 2, y: screenHeight / 2 };
		const mousePointTo = {
			x: (center.x - stagePos.x) / oldScale,
			y: (center.y - stagePos.y) / oldScale,
		};
		const newScale = oldScale * 1.2;
		const newPos = {
			x: center.x - mousePointTo.x * newScale,
			y: center.y - mousePointTo.y * newScale,
		};
		setScale(newScale);
		setStagePos(newPos);
	}, [scale, stagePos, screenWidth, screenHeight]);
	const zoomOut = useCallback(() => {
		const stage = stageRef.current;
		if (!stage) return;
		const oldScale = scale;
		const center = { x: screenWidth / 2, y: screenHeight / 2 };
		const mousePointTo = {
			x: (center.x - stagePos.x) / oldScale,
			y: (center.y - stagePos.y) / oldScale,
		};
		const newScale = oldScale / 1.2;
		const newPos = {
			x: center.x - mousePointTo.x * newScale,
			y: center.y - mousePointTo.y * newScale,
		};
		setScale(newScale);
		setStagePos(newPos);
	}, [scale, stagePos, screenWidth, screenHeight]);
	const zoomTo = useCallback(
		(value: number) => {
			const stage = stageRef.current;
			if (!stage) return;
			const oldScale = scale;
			const center = { x: screenWidth / 2, y: screenHeight / 2 };
			const mousePointTo = {
				x: (center.x - stagePos.x) / oldScale,
				y: (center.y - stagePos.y) / oldScale,
			};
			const newScale = value;
			const newPos = {
				x: center.x - mousePointTo.x * newScale,
				y: center.y - mousePointTo.y * newScale,
			};
			setScale(newScale);
			setStagePos(newPos);
		},
		[scale, stagePos, screenWidth, screenHeight],
	);
	const fitView = useCallback(() => {
		// Fit the Artboard (0,0 to ViewportW/H) into the Screen
		const padding = 40;
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
	const getTextData = (handleId: string) => {
		const layerData = initialLayers.get(handleId) as OutputItem<"Text">;
		if (!layerData) {
			return "";
		}
		return layerData.data;
	};
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
	// Load initial layers and fonts
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
					};
					if (newLayer.type === "Text") {
						newLayer.width = 200;
						newLayer.fontSize = 24;
						newLayer.fontFamily = "Geist";
						newLayer.fill = "#000000";
						newLayer.letterSpacing = 0;
						newLayer.lineHeight = newLayer.fontSize;
						newLayer.align = "left";
						newLayer.verticalAlign = "top";
					}
					if (newLayer.type === "Image") {
						const fData = getImageData(handleId);
						if (fData.entity) {
							newLayer.width = Math.round(fData.entity.width ?? 200);
							newLayer.height = Math.round(fData.entity.height ?? 200);
						} else if (fData.processData) {
							newLayer.width = Math.round(fData.processData.width ?? 200);
							newLayer.height = Math.round(fData.processData.height ?? 200);
						} else {
							newLayer.width = 200;
							newLayer.height = 200;
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
			setLayers(Object.values(layerUpdates));
		};

		loadInitialLayers();
	}, [initialLayers, node.config, getImageData]);
	// Deselect when entering pan mode
	useEffect(() => {
		if (mode === "pan" && selectedId) {
			setSelectedId(null);
		}
	}, [mode, selectedId]);
	const handleSave = useCallback(() => {
		const layerUpdates = layers.reduce<Record<string, CompositorLayer>>(
			(acc, layer) => {
				acc[layer.inputHandleId] = layer;
				return acc;
			},
			{},
		);
		propOnSave({ layerUpdates, width: viewportWidth, height: viewportHeight });
	}, [layers, propOnSave, viewportHeight, viewportWidth]);
	return (
		<EditorContext.Provider
			value={{
				layers,
				setLayers,
				selectedId,
				setSelectedId,
				viewportWidth,
				setViewportWidth,
				viewportHeight,
				setViewportHeight,
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
			}}
		>
			<div className="flex flex-row h-screen w-screen bg-gray-950 overflow-hidden relative">
				{/* Layers Sidebar - Fixed Width */}
				<div className="relative w-56 shrink-0">
					<LayersPanel onSave={handleSave} onClose={onClose} />
				</div>
				{/* Main Canvas Area - Flexible */}
				<div className="flex-1 flex flex-col relative min-w-0">
					<div
						ref={containerRef}
						className="flex-1 relative overflow-hidden bg-neutral-900"
					>
						<div
							className="absolute inset-0 pointer-events-none"
							style={{
								backgroundImage: `
  radial-gradient(circle, #333 1px, transparent 1px)
  `,
								backgroundSize: "20px 20px",
								opacity: 0.5,
							}}
						/>
						<Canvas />
					</div>
					{/* Bottom Toolbar */}
					<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
						<Menubar className="border-0 bg-gray-800 py-1 rounded-md shadow-lg ring-1 ring-white/10">
							<Button
								title="Select"
								variant={mode === "pan" ? "ghost" : "outline"}
								size="sm"
								onClick={() => setMode("select")}
							>
								<MousePointer className="w-4" />
							</Button>
							<Button
								title="Pan"
								variant={mode === "select" ? "ghost" : "outline"}
								size="sm"
								onClick={() => setMode("pan")}
							>
								<Hand className="w-4" />
							</Button>
							<Separator orientation="vertical" />
							<MenubarMenu>
								<MenubarTrigger className="px-3 py-1 cursor-pointer text-xs">
									{zoomPercentage} <ChevronDown className="w-5" />
								</MenubarTrigger>
								<MenubarContent align="end">
									<MenubarItem onClick={() => zoomIn()}>Zoom in</MenubarItem>
									<MenubarItem onClick={() => zoomOut()}>Zoom out</MenubarItem>
									<MenubarItem onClick={() => zoomTo(1)}>
										Zoom to 100%
									</MenubarItem>
									<MenubarItem onClick={() => fitView()}>
										Zoom to fit
									</MenubarItem>
								</MenubarContent>
							</MenubarMenu>
						</Menubar>
					</div>
				</div>
				<div className="relative w-56 shrink-0">
					<InspectorPanel />
				</div>
			</div>
		</EditorContext.Provider>
	);
};
