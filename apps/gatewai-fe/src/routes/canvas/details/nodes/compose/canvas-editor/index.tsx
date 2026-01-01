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
import { BLEND_MODES } from "@/routes/canvas/blend-modes";
import { useGetFontListQuery } from "@/store/fonts";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint } from "@/utils/file";

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
			const hSnaps: number[] = [0, viewportHeight / 2, viewportHeight]; // Canvas edges and center
			const vSnaps: number[] = [0, viewportWidth / 2, viewportWidth];
			layers.forEach((layer) => {
				if (
					layer.id !== excludeId &&
					layer.width &&
					(layer.height ?? layer.computedHeight)
				) {
					const effectiveHeight = layer.height ?? layer.computedHeight ?? 0;
					const centerX = layer.x + (layer.width * layer.scaleX) / 2;
					const centerY = layer.y + (effectiveHeight * layer.scaleY) / 2;
					vSnaps.push(layer.x, centerX, layer.x + layer.width * layer.scaleX);
					hSnaps.push(
						layer.y,
						centerY,
						layer.y + effectiveHeight * layer.scaleY,
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
			const centerX = newX + (node.width() * node.scaleX()) / 2;
			const centerY = newY + (node.height() * node.scaleY()) / 2;
			const right = newX + node.width() * node.scaleX();
			const bottom = newY + node.height() * node.scaleY();
			// Vertical snaps
			const vGuides: Guide[] = [];
			for (const snap of vSnaps) {
				if (Math.abs(newX - snap) < SNAP_THRESHOLD) {
					newX = snap;
					vGuides.push({ type: "vertical", position: snap });
				} else if (Math.abs(centerX - snap) < SNAP_THRESHOLD) {
					newX = snap - (node.width() * node.scaleX()) / 2;
					vGuides.push({ type: "vertical", position: snap });
				} else if (Math.abs(right - snap) < SNAP_THRESHOLD) {
					newX = snap - node.width() * node.scaleX();
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
					newY = snap - (node.height() * node.scaleY()) / 2;
					hGuides.push({ type: "horizontal", position: snap });
				} else if (Math.abs(bottom - snap) < SNAP_THRESHOLD) {
					newY = snap - node.height() * node.scaleY();
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
				prev.map((l) => (l.id === id ? { ...l, x: node.x(), y: node.y() } : l)),
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
								x: node.x(),
								y: node.y(),
								scaleX: node.scaleX(),
								scaleY: node.scaleY(),
								rotation: node.rotation(),
								width: l.type === "Text" ? node.width() : l.width,
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
						? { ...l, width: image.width, height: image.height }
						: l,
				),
			);
		}
	}, [image, layer.id, layer.width, layer.height, setLayers]);
	const handleSelect = () => {
		setSelectedId(layer.id);
	};
	return (
		<KonvaImage
			id={layer.id}
			x={layer.x}
			y={layer.y}
			width={layer.width}
			height={layer.height}
			scaleX={layer.scaleX}
			scaleY={layer.scaleY}
			rotation={layer.rotation}
			image={image}
			draggable={mode === "select"}
			onClick={handleSelect}
			onTap={handleSelect}
			onDragStart={onDragStart}
			onDragMove={onDragMove}
			onDragEnd={onDragEnd}
			onTransformStart={onTransformStart}
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
		const newWidth = Math.max(20, node.width() * node.scaleX());
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
			const newHeight = node.height();
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
			fontFamily={layer.fontFamily ?? "sans-serif"}
			fill={layer.fill ?? "#000000"}
			width={layer.width ?? 200}
			height={layer.height}
			rotation={layer.rotation}
			scaleX={layer.scaleX}
			scaleY={layer.scaleY}
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
				{layers.map((layer) => {
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
							const reversed = currentLayers.slice().reverse();
							const oldIndexRev = reversed.findIndex((l) => l.id === active.id);
							const newIndexRev = reversed.findIndex((l) => l.id === over.id);
							const newReversed = arrayMove(reversed, oldIndexRev, newIndexRev);
							return newReversed.reverse();
						});
					}
				}}
			>
				<SortableContext
					items={layers
						.slice()
						.reverse()
						.map((l) => l.id)}
					strategy={verticalListSortingStrategy}
				>
					<div className="flex flex-col">
						{layers
							.slice()
							.reverse()
							.map((layer) => (
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
	const updateLayer = (updates: Partial<CompositorLayer>) => {
		setLayers((prev) =>
			prev.map((l) => (l.id === selectedId ? { ...l, ...updates } : l)),
		);
	};
	let computedWidth = 0;
	let computedHeight = 0;
	if (selectedLayer) {
		computedWidth = (selectedLayer.width ?? 0) * selectedLayer.scaleX;
		computedHeight =
			(selectedLayer.height ?? selectedLayer.computedHeight ?? 0) *
			selectedLayer.scaleY;
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
							type="text"
							value={viewportWidth}
							onChange={(e) =>
								setViewportWidth(parseFloat(e.target.value) || 800)
							}
							placeholder="Width"
							className="w-full"
						/>
					</div>
					<div className="flex-1 flex flex-col gap-1">
						<Label htmlFor="canvas-height">Height:</Label>
						<Input
							id="canvas-height"
							type="text"
							value={viewportHeight}
							onChange={(e) =>
								setViewportHeight(parseFloat(e.target.value) || 600)
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
									type="text"
									value={selectedLayer.x}
									onChange={(e) =>
										updateLayer({ x: parseFloat(e.target.value) || 0 })
									}
								/>
							</div>
							<div className="flex-1 flex flex-col gap-1">
								<Label htmlFor="y">Y:</Label>
								<Input
									id="y"
									type="text"
									value={selectedLayer.y}
									onChange={(e) =>
										updateLayer({ y: parseFloat(e.target.value) || 0 })
									}
								/>
							</div>
						</div>
						<div className="flex gap-2">
							<div className="flex-1 flex flex-col gap-1">
								<Label htmlFor="width">Width:</Label>
								<Input
									id="width"
									type="text"
									value={computedWidth}
									onChange={(e) => {
										const newWidth = parseFloat(e.target.value) ?? 0;
										if (selectedLayer.type === "Text") {
											updateLayer({ width: newWidth });
										} else {
											updateLayer({
												scaleX: newWidth / (selectedLayer.width ?? 1),
											});
										}
									}}
								/>
							</div>
							{selectedLayer.type === "Image" && (
								<div className="flex-1 flex flex-col gap-1">
									<Label htmlFor="height">Height:</Label>
									<Input
										id="height"
										type="text"
										value={computedHeight}
										onChange={(e) => {
											const newHeight =
												parseFloat(e.target.value) ?? selectedLayer.height ?? 0;
											updateLayer({
												scaleY: newHeight / (selectedLayer.height ?? 1),
											});
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
								{selectedLayer.rotation.toFixed(2)}°
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
										value={selectedLayer.fontFamily || "sans-serif"}
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
													{fontName.replace("_", "")}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex flex-col gap-1">
									<Label htmlFor="color">Color:</Label>
									<input
										id="color"
										type="color"
										value={selectedLayer.fill}
										onChange={(e) => updateLayer({ fill: e.target.value })}
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
	// Load initial layers
	useEffect(() => {
		const existingConfig = (node.config as CompositorNodeConfig) ?? {
			layerUpdates: {},
		};
		const layerUpdates = { ...existingConfig.layerUpdates };
		initialLayers.forEach((output, handleId) => {
			if (!layerUpdates[handleId]) {
				const newLayer: CompositorLayer = {
					type: output.type,
					scaleX: 1,
					scaleY: 1,
					width: undefined,
					height: undefined,
					x: 0,
					y: 0,
					id: handleId,
					inputHandleId: handleId,
					rotation: 0,
					lockAspect: true,
					blendMode: "source-over",
				};
				if (newLayer.type === "Text") {
					newLayer.width = 200;
					newLayer.fontSize = 24;
					newLayer.fontFamily = "sans-serif";
					newLayer.fill = "#000000";
					newLayer.letterSpacing = 0;
					newLayer.lineHeight = newLayer.fontSize;
					newLayer.align = "left";
					newLayer.verticalAlign = "top";
				}
				if (newLayer.type === "Image") {
					const fData = getImageData(handleId);
					if (fData.entity) {
						newLayer.width = fData.entity.width ?? 200;
						newLayer.height = fData.entity.height ?? 200;
					} else if (fData.processData) {
						newLayer.width = fData.processData.width ?? 200;
						newLayer.height = fData.processData.height ?? 200;
					} else {
						newLayer.width = 200;
						newLayer.height = 200;
					}
				}
				layerUpdates[handleId] = newLayer;
			}
		});
		setLayers(Object.values(layerUpdates));
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
