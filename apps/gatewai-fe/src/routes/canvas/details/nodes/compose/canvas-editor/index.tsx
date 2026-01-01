import type {
	CompositorLayer,
	CompositorNodeConfig,
	CompositorResult,
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
				if (layer.id !== excludeId && layer.width && layer.height) {
					const centerX = layer.x + (layer.width * layer.scaleX) / 2;
					const centerY = layer.y + (layer.height * layer.scaleY) / 2;
					vSnaps.push(layer.x, centerX, layer.x + layer.width * layer.scaleX);
					hSnaps.push(layer.y, centerY, layer.y + layer.height * layer.scaleY);
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

	return (
		<KonvaText
			id={layer.id}
			x={layer.x}
			y={layer.y}
			text={text as string}
			fontSize={layer.fontSize || 24}
			fontFamily={layer.fontFamily || "sans-serif"}
			fill={layer.fill || "#000000"}
			width={layer.width || 200}
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
			onTransformEnd={onTransformEnd}
			globalCompositeOperation={layer.blendMode as GlobalCompositeOperation}
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
					stroke="#ff00ff"
					strokeWidth={1}
				/>
			))}
		</>
	);
};

// The background "Paper" representing the viewport
const ArtboardBackground: React.FC = () => {
	const { viewportWidth, viewportHeight } = useEditor();
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
				fill="#ffffff"
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

const LAYER_ITEM_TYPE = "LAYER";

interface LayerItemProps {
	layer: CompositorLayer;
	selectedId: string | null;
	setSelectedId: (id: string) => void;
	moveLayer: (
		draggedId: string,
		targetId: string,
		insertAfter: boolean,
	) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({
	layer,
	selectedId,
	setSelectedId,
	moveLayer,
}) => {
	const ref = useRef<HTMLButtonElement>(null);

	const [{ isDragging }, drag] = useDrag<
		{ id: string },
		unknown,
		{ isDragging: boolean }
	>(() => ({
		type: LAYER_ITEM_TYPE,
		item: { id: layer.id },
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	}));

	const [{ isOver }, drop] = useDrop<
		{ id: string },
		unknown,
		{ isOver: boolean }
	>(() => ({
		accept: LAYER_ITEM_TYPE,
		collect: (monitor) => ({
			isOver: monitor.isOver(),
		}),
		drop: (item, monitor) => {
			if (item.id === layer.id) return;
			// Determine if drop is above or below the midpoint
			const clientY = monitor.getClientOffset()?.y ?? 0;
			const rect = ref.current?.getBoundingClientRect();
			const midpoint = (rect?.top ?? 0) + (rect?.height ?? 0) / 2;
			const insertAfter = clientY > midpoint;
			moveLayer(item.id, layer.id, insertAfter);
		},
	}));

	drag(drop(ref));

	return (
		<Button
			ref={ref}
			variant="ghost"
			onClick={() => setSelectedId(layer.id)}
			onKeyUp={(e) => {
				if (e.key === "Enter") {
					setSelectedId(layer.id);
				}
			}}
			className={`cursor-pointer w-full flex items-center gap-2 p-2 transition-colors duration-200 hover:bg-gray-800 ${
				layer.id === selectedId ? "bg-gray-800" : ""
			} ${isDragging ? "opacity-50" : ""} ${isOver ? "border border-blue-500" : ""}`}
		>
			{layer.type === "Image" ? (
				<ImageIcon className="size-4" />
			) : (
				<TextIcon className="size-4" />
			)}{" "}
			{layer.type.charAt(0).toUpperCase() + layer.type.slice(1)} -{" "}
			{layer.id.slice(0, 6)}
		</Button>
	);
};

const LayersPanel: React.FC<{ onSave: () => void; onClose: () => void }> = ({
	onSave,
	onClose,
}) => {
	const { layers, setLayers, selectedId, setSelectedId } = useEditor();

	const moveLayer = useCallback(
		(draggedId: string, targetId: string, insertAfter: boolean) => {
			const displayLayers = layers.slice();
			const draggedIndex = displayLayers.findIndex((l) => l.id === draggedId);
			let targetIndex = displayLayers.findIndex((l) => l.id === targetId);

			if (draggedIndex < 0 || targetIndex < 0) return;

			if (insertAfter) targetIndex += 1;

			const newDisplayLayers = [...displayLayers];
			const [moved] = newDisplayLayers.splice(draggedIndex, 1);
			let adjustedTargetIndex = targetIndex;
			if (draggedIndex < targetIndex) adjustedTargetIndex -= 1;
			newDisplayLayers.splice(adjustedTargetIndex, 0, moved);

			setLayers(newDisplayLayers);
		},
		[layers, setLayers],
	);

	return (
		<div className="absolute left-0 top-0 bottom-0 w-56 overflow-y-auto bg-background p-2 border-r border-gray-700 z-10 text-xs">
			<div className="flex justify-evenly my-4">
				<Button onClick={onClose} variant="outline">
					Close
				</Button>
				<Button onClick={onSave}>
					<SaveAll className="size-4" /> Save
				</Button>
			</div>
			<Separator className="my-4" />
			<h3 className="mb-4 text-xl font-bold text-gray-100">Layers</h3>
			<ul className="space-y-2">
				{layers.map((layer) => (
					<LayerItem
						key={layer.id}
						layer={layer}
						selectedId={selectedId}
						setSelectedId={setSelectedId}
						moveLayer={moveLayer}
					/>
				))}
			</ul>
		</div>
	);
};

// Inspector Panel (Right sidebar like Figma)
const InspectorPanel: React.FC = () => {
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
		computedHeight = (selectedLayer.height ?? 0) * selectedLayer.scaleY;
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
										const newWidth =
											parseFloat(e.target.value) ?? selectedLayer.width ?? 0;
										updateLayer({
											scaleX: newWidth / (selectedLayer.width ?? 1),
										});
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
									<Input
										id="fontFamily"
										value={selectedLayer.fontFamily}
										onChange={(e) =>
											updateLayer({ fontFamily: e.target.value })
										}
									/>
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [screenWidth, screenHeight, viewportHeight, viewportWidth]); // Run when screen size stabilizes

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
		<DndProvider backend={TouchBackend} options={{ enableMouseEvents: true }}>
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
										<MenubarItem onClick={() => zoomOut()}>
											Zoom out
										</MenubarItem>
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
		</DndProvider>
	);
};
