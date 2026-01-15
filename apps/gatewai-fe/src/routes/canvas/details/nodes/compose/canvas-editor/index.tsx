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
	CompositorLayer,
	CompositorNodeConfig,
	FileData,
	OutputItem,
} from "@gatewai/types";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
	AlignCenterHorizontal,
	AlignCenterVertical,
	ArrowLeftRight,
	ArrowUpDown,
	Bold,
	ChevronDown,
	Eye,
	EyeOff,
	Hand,
	ImageIcon,
	Italic,
	Layers,
	LockOpen,
	MousePointer,
	Move,
	MoveHorizontal,
	MoveVertical,
	RotateCw,
	Settings2,
	Type,
	Underline,
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

// Internal Component Imports
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
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ColorPicker } from "@/components/util/color-input";
import { fontManager } from "@/lib/fonts";
import { useGetFontListQuery } from "@/store/fonts";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint, GetFontAssetUrl } from "@/utils/file";

const DEFAULTS = {
	FONT_FAMILY: "Inter",
	FONT_SIZE: 64,
	FILL: "#ffffff",
	LINE_HEIGHT: 1.1,
	ALIGN: "left",
	VERTICAL_ALIGN: "top",
	LETTER_SPACING: 0,
};

const BLEND_MODES = [
	"source-over",
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

interface LocalCompositorLayer extends CompositorLayer {
	computedHeight?: number;
}

interface EditorContextType {
	layers: LocalCompositorLayer[];
	updateLayers: (
		updater: SetStateAction<LocalCompositorLayer[]>,
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
	transformerRef: RefObject<Konva.Transformer | null>;
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

			for (const layer of layers) {
				if (
					layer.id !== excludeId &&
					layer.width &&
					(layer.height ?? layer.computedHeight)
				) {
					// Use opacity as a proxy for visibility/locking if needed, though strictly we should check lock state
					if (layer.opacity === 0) continue;

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
			}
			return { hSnaps, vSnaps };
		},
		[layers, viewportHeight, viewportWidth],
	);

	const handleDragMove = useCallback(
		(e: KonvaEventObject<DragEvent>) => {
			const node = e.target;
			const id = node.id();

			// Skip snapping if Shift key is pressed (common design pattern)
			if (e.evt.shiftKey) {
				setGuides([]);
				return;
			}

			const { hSnaps, vSnaps } = getSnapPositions(id);
			let newX = node.x();
			let newY = node.y();

			// Calculate edges
			const nodeWidth = node.width() * node.scaleX();
			const nodeHeight = node.height() * node.scaleY();

			const centerX = newX + nodeWidth / 2;
			const centerY = newY + nodeHeight / 2;
			const right = newX + nodeWidth;
			const bottom = newY + nodeHeight;

			// Vertical snaps
			const vGuides: Guide[] = [];
			for (const snap of vSnaps) {
				if (Math.abs(newX - snap) < SNAP_THRESHOLD) {
					newX = snap;
					vGuides.push({ type: "vertical", position: snap });
				} else if (Math.abs(centerX - snap) < SNAP_THRESHOLD) {
					newX = snap - nodeWidth / 2;
					vGuides.push({ type: "vertical", position: snap });
				} else if (Math.abs(right - snap) < SNAP_THRESHOLD) {
					newX = snap - nodeWidth;
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
					newY = snap - nodeHeight / 2;
					hGuides.push({ type: "horizontal", position: snap });
				} else if (Math.abs(bottom - snap) < SNAP_THRESHOLD) {
					newY = snap - nodeHeight;
					hGuides.push({ type: "horizontal", position: snap });
				}
			}

			// Only apply closest snap
			if (vGuides.length > 0) node.x(newX);
			if (hGuides.length > 0) node.y(newY);

			// Deduplicate guides visually
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
		(e: KonvaEventObject<DragEvent>) => {
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
		(e: KonvaEventObject<Event>) => {
			const node = e.target;
			const id = node.id();

			const scaleX = node.scaleX();
			const scaleY = node.scaleY();

			// Reset scale and apply to width/height to keep coordinate system clean
			node.scaleX(1);
			node.scaleY(1);

			updateLayers((prev) =>
				prev.map((l) => {
					if (l.id !== id) return l;

					const updates: Partial<LocalCompositorLayer> = {
						x: Math.round(node.x()),
						y: Math.round(node.y()),
						rotation: Math.round(node.rotation()),
						width: Math.round(node.width() * scaleX),
					};

					if (l.type === "Image") {
						updates.height = Math.round(node.height() * scaleY);
					} else if (l.type === "Text") {
						// For Text, we check if height has been manually resized by user (non-auto)
						// If the transformer changed height significantly, we might want to capture it
						// for vertical alignment to work.
						updates.height = Math.round(node.height() * scaleY);
					}

					return { ...l, ...updates };
				}),
			);
		},
		[updateLayers],
	);

	return { handleDragMove, handleDragEnd, handleTransformEnd };
};

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
					className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`}
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

interface LayerProps {
	layer: LocalCompositorLayer;
	onDragStart: (e: KonvaEventObject<DragEvent>) => void;
	onDragMove: (e: KonvaEventObject<DragEvent>) => void;
	onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
	onTransformStart: (e: KonvaEventObject<Event>) => void;
	onTransformEnd: (e: KonvaEventObject<Event>) => void;
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

	// Initialize dimensions if missing
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

	const handleSelect = () => setSelectedId(layer.id);

	const handleTransform = useCallback((e: KonvaEventObject<Event>) => {
		const node = e.target as Konva.Image;
		const scaleX = node.scaleX();
		const scaleY = node.scaleY();
		// Prevent zero dimension
		if (node.width() * scaleX < 5) node.scaleX(5 / node.width());
		if (node.height() * scaleY < 5) node.scaleY(5 / node.height());
	}, []);

	return (
		<KonvaImage
			id={layer.id}
			name="object"
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
			visible={layer.opacity !== 0}
		/>
	);
};

const TextLayer: React.FC<LayerProps> = ({
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
		transformerRef,
		selectedId,
	} = useEditor();

	const text = getTextData(layer.inputHandleId);
	const textRef = useRef<Konva.Text>(null);

	const handleSelect = () => setSelectedId(layer.id);

	const handleDoubleClick = () => {
		setSelectedId(layer.id);
		setIsEditingText(true);
		setEditingLayerId(layer.id);
	};

	// Monitor properties that change text dimensions.
	// Sync Konva's calculated height back to state and force Transformer update.
	// biome-ignore lint/correctness/useExhaustiveDependencies: Internal calculations being made when these chandes
	useEffect(() => {
		const node = textRef.current;
		if (!node) return;

		const syncHeight = () => {
			const calculatedHeight = node.height();

			if (selectedId === layer.id && transformerRef.current) {
				transformerRef.current.forceUpdate();
				transformerRef.current.getLayer()?.batchDraw();
			}

			if (calculatedHeight !== layer.computedHeight) {
				updateLayers(
					(prev) =>
						prev.map((l) =>
							l.id === layer.id
								? { ...l, computedHeight: calculatedHeight }
								: l,
						),
					false,
				);
			}
		};

		if (layer.fontFamily) {
			document.fonts.ready.then(syncHeight);
		} else {
			syncHeight();
		}
	}, [
		layer.fontFamily,
		layer.fontSize,
		layer.width,
		layer.height,
		layer.lineHeight,
		layer.letterSpacing,
		layer.textDecoration,
		layer.fontStyle,
		text,
		selectedId,
		layer.id,
		layer.computedHeight,
		updateLayers,
		transformerRef,
	]);

	// Load Font
	useEffect(() => {
		if (layer.fontFamily) {
			const fontUrl = GetFontAssetUrl(layer.fontFamily);
			fontManager
				.loadFont(layer.fontFamily, fontUrl)
				.then(() => {
					stageRef.current?.batchDraw();
					if (textRef.current) {
						const h = textRef.current.height();
						if (h !== layer.computedHeight) {
							updateLayers(
								(prev) =>
									prev.map((l) =>
										l.id === layer.id ? { ...l, computedHeight: h } : l,
									),
								false,
							);
						}
					}
				})
				.catch((err) =>
					console.warn(`Failed to load font ${layer.fontFamily}`, err),
				);
		}
	}, [
		layer.fontFamily,
		stageRef,
		updateLayers,
		layer.id,
		layer.computedHeight,
	]);

	const handleTransform = useCallback((e: KonvaEventObject<Event>) => {
		const node = e.target as Konva.Text;

		// Reset Y scale to prevent distortion, we want text to wrap
		node.scaleY(1);

		const newWidth = Math.max(20, node.width() * node.scaleX());

		node.setAttrs({
			width: newWidth,
			scaleX: 1,
			// We do NOT reset height here if the user wants to vertically align within a box.
			// But traditionally in this editor, dragging corner scales box width.
			// If we want auto-height, we leave it undefined.
			// However, if vertical align is active, we need a fixed height.
			// For simplicity, we keep height auto unless explicitly set by a specialized tool.
			// But for parity with the transformer logic which might set height:
			height: node.height() * node.scaleY(), // capture height for V-align
		});
	}, []);

	return (
		<KonvaText
			ref={textRef}
			id={layer.id}
			name="object"
			x={layer.x}
			y={layer.y}
			text={text as string}
			fontSize={layer.fontSize ?? DEFAULTS.FONT_SIZE}
			fontFamily={layer.fontFamily ?? DEFAULTS.FONT_FAMILY}
			fontStyle={layer.fontStyle ?? "normal"}
			textDecoration={layer.textDecoration ?? ""}
			fill={layer.fill ?? DEFAULTS.FILL}
			width={layer.width ?? 200}
			height={layer.height} // Pass explicit height to support Vertical Align
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
			align={layer.align || DEFAULTS.ALIGN}
			verticalAlign={layer.verticalAlign ?? DEFAULTS.VERTICAL_ALIGN}
			letterSpacing={layer.letterSpacing ?? DEFAULTS.LETTER_SPACING}
			lineHeight={layer.lineHeight ?? DEFAULTS.LINE_HEIGHT}
			opacity={layer.opacity ?? 1}
			visible={layer.opacity !== 0}
		/>
	);
};

const TransformerComponent: React.FC = () => {
	const { selectedId, layers, stageRef, mode, transformerRef } = useEditor();

	useEffect(() => {
		if (
			selectedId &&
			transformerRef.current &&
			stageRef.current &&
			mode === "select"
		) {
			const node = stageRef.current.findOne(`#${selectedId}`);
			if (node) {
				transformerRef.current.nodes([node]);
				transformerRef.current.getLayer()?.batchDraw();
			} else {
				transformerRef.current.nodes([]);
			}
		} else if (transformerRef.current) {
			transformerRef.current.nodes([]);
			transformerRef.current.getLayer()?.batchDraw();
		}
	}, [selectedId, stageRef, mode, transformerRef]);

	const selectedLayer = layers.find((l) => l.id === selectedId);

	const enabledAnchors = useMemo(() => {
		if (selectedLayer?.type === "Text") {
			// Allow resizing height now for vertical alignment support
			return [
				"top-left",
				"top-right",
				"bottom-left",
				"bottom-right",
				"middle-left",
				"middle-right",
			];
		}
		if (selectedLayer?.type === "Image" && selectedLayer.lockAspect) {
			return ["top-left", "top-right", "bottom-left", "bottom-right"];
		}
		return undefined;
	}, [selectedLayer]);

	return (
		<Transformer
			ref={transformerRef}
			rotateEnabled
			flipEnabled={false}
			borderStroke="#3b82f6"
			borderStrokeWidth={1}
			anchorStroke="#3b82f6"
			anchorFill="#ffffff"
			anchorSize={9}
			anchorCornerRadius={2}
			padding={2}
			keepRatio={selectedLayer?.type === "Image" && selectedLayer.lockAspect}
			enabledAnchors={enabledAnchors}
			boundBoxFunc={(oldBox, newBox) => {
				if (newBox.width < 5 || newBox.height < 5) return oldBox;
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
					stroke="#ec4899"
					strokeWidth={1}
					dash={[4, 4]}
				/>
			))}
		</>
	);
};

const ArtboardBackground: React.FC = () => {
	const { viewportWidth, viewportHeight } = useEditor();

	// Checkered pattern
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
			{/* Drop Shadow for Artboard Depth */}
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
			{/* Main Artboard */}
			<Rect
				x={0}
				y={0}
				width={viewportWidth}
				height={viewportHeight}
				fillPatternImage={patternImage as any}
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
		(e: KonvaEventObject<TouchEvent | MouseEvent>) => {
			const clickedOnEmpty =
				e.target === stageRef.current || e.target.name() === "artboard-bg";
			if (clickedOnEmpty) {
				setSelectedId(null);
			}
		},
		[stageRef, setSelectedId],
	);

	const handleStageMouseDown = useCallback(
		(e: KonvaEventObject<MouseEvent>) => {
			// Middle mouse button pan
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
		(e: KonvaEventObject<WheelEvent>) => {
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
			const scaleBy = 1.1; // Slightly faster zoom
			const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

			if (newScale < 0.05 || newScale > 20) return;

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

	// Sync stage drag back to state for Pan tool
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
						layer,
						onDragStart: () => setSelectedId(layer.id),
						onDragMove: handleDragMove,
						onDragEnd: handleDragEnd,
						onTransformStart: () => setSelectedId(layer.id),
						onTransformEnd: handleTransformEnd,
					};
					if (layer.type === "Image") {
						return <ImageLayer key={layer.id} {...props} />;
					}
					if (layer.type === "Text") {
						return <TextLayer key={layer.id} {...props} />;
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
	layer: LocalCompositorLayer;
	selectedId: string | null;
	setSelectedId: (id: string) => void;
	updateLayer: (id: string, updates: Partial<LocalCompositorLayer>) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({
	layer,
	selectedId,
	setSelectedId,
	updateLayer,
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
	const isHidden = layer.opacity === 0;

	const toggleVisibility = (e: React.MouseEvent) => {
		e.stopPropagation();
		updateLayer(layer.id, { opacity: isHidden ? 1 : 0 });
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			if (!isDragging) {
				setSelectedId(layer.id);
			}
		}
	};

	return (
		<button
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={`
        flex items-center gap-2 px-3 py-2 border-b border-white/5 cursor-pointer outline-none group transition-colors select-none
        ${isSelected ? "bg-blue-600/20 text-blue-100" : "hover:bg-white/5 text-gray-400"}
        ${isDragging ? "bg-neutral-800" : ""}
      `}
			onClick={() => !isDragging && setSelectedId(layer.id)}
			onKeyDown={handleKeyDown}
			tabIndex={0}
		>
			<div className="shrink-0 text-gray-500 group-hover:text-gray-300">
				{layer.type === "Image" ? (
					<ImageIcon className="size-3.5" />
				) : (
					<Type className="size-3.5" />
				)}
			</div>

			<span
				className={`truncate flex-1 text-[11px] font-medium ${isSelected ? "text-blue-100" : "text-gray-300"}`}
			>
				{layer.id}
			</span>

			<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
				<Button
					size="icon"
					variant="ghost"
					className="h-5 w-5 hover:bg-white/10"
					onClick={toggleVisibility}
					aria-label={isHidden ? "Show layer" : "Hide layer"}
				>
					{isHidden ? (
						<EyeOff className="w-3 h-3" />
					) : (
						<Eye className="w-3 h-3" />
					)}
				</Button>
				<Button
					size="icon"
					variant="ghost"
					className="h-5 w-5 hover:bg-white/10"
					disabled
				>
					<LockOpen className="w-3 h-3" />
				</Button>
			</div>
		</button>
	);
};

const LayersPanel: React.FC = () => {
	const { layers, updateLayers, selectedId, setSelectedId } = useEditor();

	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);
	const displayLayers = useMemo(
		() => [...sortedLayers].reverse(),
		[sortedLayers],
	);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (e: DragEndEvent) => {
		const { active, over } = e;
		if (over && active.id !== over.id) {
			updateLayers((currentLayers) => {
				const currentSorted = [...currentLayers].sort(
					(a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
				);
				const oldIndex = currentSorted.findIndex((l) => l.id === active.id);
				const newIndex = currentSorted.findIndex((l) => l.id === over.id);

				const newSorted = arrayMove(currentSorted, oldIndex, newIndex);

				return currentLayers.map((l) => {
					const pos = newSorted.findIndex((s) => s.id === l.id);
					return { ...l, zIndex: newSorted.length - pos }; // Reassign z-index
				});
			});
		}
	};

	const updateLayer = (id: string, updates: Partial<LocalCompositorLayer>) => {
		updateLayers((prev) =>
			prev.map((l) => (l.id === id ? { ...l, ...updates } : l)),
		);
	};

	return (
		<div className="absolute left-0 top-0 bottom-0 w-60 bg-[#0a0a0a] border-r border-white/10 z-20 flex flex-col shadow-2xl">
			<div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-900/50 backdrop-blur shrink-0 h-10">
				<span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
					<Layers className="w-3.5 h-3.5" /> Layers
				</span>
			</div>

			<ScrollArea className="flex-1">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={displayLayers.map((l) => l.id)}
						strategy={verticalListSortingStrategy}
					>
						<div className="flex flex-col py-2">
							{displayLayers.map((layer) => (
								<LayerItem
									key={layer.id}
									layer={layer}
									selectedId={selectedId}
									setSelectedId={setSelectedId}
									updateLayer={updateLayer}
								/>
							))}
							{displayLayers.length === 0 && (
								<div className="py-8 text-center text-[11px] text-gray-600 italic">
									No layers
								</div>
							)}
						</div>
					</SortableContext>
				</DndContext>
			</ScrollArea>
		</div>
	);
};

const InspectorPanel: React.FC = () => {
	const { data: fontList } = useGetFontListQuery({});
	const fontNames = useMemo(() => {
		if (Array.isArray(fontList) && (fontList as string[])?.length > 0) {
			return fontList as string[];
		}
		return [
			"Geist",
			"Inter",
			"Arial",
			"Courier New",
			"Times New Roman",
			"Verdana",
		];
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

	const updateLayer = (updates: Partial<LocalCompositorLayer>) => {
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
			<div className="w-72 border-l border-white/10 bg-[#0a0a0a] z-20 shadow-xl flex flex-col">
				<div className="px-4 py-3 bg-neutral-900/50 backdrop-blur border-b border-white/10 shrink-0 h-10 flex items-center">
					<h2 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
						Canvas Settings
					</h2>
				</div>
				<div className="p-4 space-y-6">
					<div className="space-y-3">
						<Label className="text-[10px] text-gray-500 uppercase font-bold tracking-wide">
							Dimensions
						</Label>
						<div className="grid grid-cols-2 gap-3">
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
							<SelectTrigger className="h-8 text-[11px] bg-white/5 border-white/10 text-gray-300">
								<SelectValue placeholder="Select Preset" />
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

					<div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-white/10 rounded-lg bg-white/2">
						<MousePointer className="w-5 h-5 text-gray-600 mb-2" />
						<p className="text-[11px] text-gray-500">Select a layer to edit</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<ScrollArea className="w-72 border-l border-white/10 bg-[#0a0a0a] z-20 shadow-xl">
			<div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-900/50 backdrop-blur h-14">
				<div className="flex flex-col min-w-0">
					<span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">
						Selected
					</span>
					<div className="flex items-center gap-2">
						{selectedLayer.type === "Image" ? (
							<ImageIcon className="w-3.5 h-3.5 text-blue-400" />
						) : (
							<Type className="w-3.5 h-3.5 text-blue-400" />
						)}
						<h2 className="text-xs font-semibold text-white truncate max-w-[140px]">
							{selectedLayer.id}
						</h2>
					</div>
				</div>
			</div>

			<div className="pb-20">
				<CollapsibleSection title="Transform" icon={Move}>
					<div className="space-y-3">
						<div className="flex gap-1">
							<Button
								variant="outline"
								size="sm"
								className="flex-1 h-7 text-[10px] border-white/10 bg-white/5 hover:bg-white/10 hover:text-white text-gray-400"
								onClick={() => centerLayer("x")}
							>
								<AlignCenterHorizontal className="w-3 h-3 mr-1" /> Center X
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="flex-1 h-7 text-[10px] border-white/10 bg-white/5 hover:bg-white/10 hover:text-white text-gray-400"
								onClick={() => centerLayer("y")}
							>
								<AlignCenterVertical className="w-3 h-3 mr-1" /> Center Y
							</Button>
						</div>

						<div className="grid grid-cols-2 gap-3">
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
									value={Math.round(
										selectedLayer.height ?? selectedLayer.computedHeight ?? 0,
									)}
									onChange={(v) => updateLayer({ height: v })}
									min={1}
								/>
							)}
							<DraggableNumberInput
								label="Rot"
								icon={RotateCw}
								value={Math.round(selectedLayer.rotation)}
								onChange={(v) => updateLayer({ rotation: v })}
							/>
						</div>

						{selectedLayer.type === "Image" && (
							<div className="flex items-center justify-between pt-2">
								<Label className="text-[10px] text-gray-400">
									Lock Aspect Ratio
								</Label>
								<Switch
									checked={selectedLayer.lockAspect ?? true}
									onCheckedChange={(c) => updateLayer({ lockAspect: c })}
									className="scale-75 data-[state=checked]:bg-blue-600"
								/>
							</div>
						)}
					</div>
				</CollapsibleSection>

				{selectedLayer.type === "Text" && (
					<CollapsibleSection title="Typography" icon={Type}>
						<div className="space-y-4">
							<div className="space-y-1.5">
								<Label className="text-[10px] text-gray-500 font-medium">
									Font Family
								</Label>
								<Select
									value={selectedLayer.fontFamily || DEFAULTS.FONT_FAMILY}
									onValueChange={(val) => updateLayer({ fontFamily: val })}
								>
									<SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white">
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
									value={selectedLayer.fontSize || DEFAULTS.FONT_SIZE}
									onChange={(v) => updateLayer({ fontSize: v })}
									min={1}
								/>
								<div className="space-y-1">
									<Label className="text-[10px] text-gray-500 block mb-1">
										Color
									</Label>
									<ColorPicker
										value={selectedLayer.fill ?? DEFAULTS.FILL}
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
									<Bold className="w-3.5 h-3.5" />
								</Button>
								<Separator
									orientation="vertical"
									className="h-3 my-auto mx-1 bg-white/10"
								/>
								<Button
									variant={isItalic ? "secondary" : "ghost"}
									size="icon"
									className="h-6 flex-1 rounded-sm"
									onClick={() => toggleStyle("italic")}
								>
									<Italic className="w-3.5 h-3.5" />
								</Button>
								<Separator
									orientation="vertical"
									className="h-3 my-auto mx-1 bg-white/10"
								/>
								<Button
									variant={isUnderline ? "secondary" : "ghost"}
									size="icon"
									className="h-6 flex-1 rounded-sm"
									onClick={toggleUnderline}
								>
									<Underline className="w-3.5 h-3.5" />
								</Button>
							</div>

							<div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded border border-white/5">
								{(["left", "center", "right"] as const).map((align) => (
									<Button
										key={align}
										variant={
											(selectedLayer.align || DEFAULTS.ALIGN) === align
												? "secondary"
												: "ghost"
										}
										size="sm"
										className="h-6 text-[10px] capitalize rounded-sm"
										onClick={() => updateLayer({ align })}
									>
										{align}
									</Button>
								))}
							</div>

							<div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded border border-white/5 mt-2">
								{(["top", "middle", "bottom"] as const).map((vAlign) => (
									<Button
										key={vAlign}
										variant={
											(selectedLayer.verticalAlign ||
												DEFAULTS.VERTICAL_ALIGN) === vAlign
												? "secondary"
												: "ghost"
										}
										size="sm"
										className="h-6 text-[10px] capitalize rounded-sm"
										onClick={() => updateLayer({ verticalAlign: vAlign })}
									>
										{vAlign}
									</Button>
								))}
							</div>

							<div className="grid grid-cols-2 gap-3 mt-2">
								<DraggableNumberInput
									label="Letter"
									icon={ArrowLeftRight}
									value={selectedLayer.letterSpacing ?? DEFAULTS.LETTER_SPACING}
									onChange={(v) => updateLayer({ letterSpacing: v })}
								/>
								<DraggableNumberInput
									label="Line"
									icon={ArrowUpDown}
									value={selectedLayer.lineHeight ?? DEFAULTS.LINE_HEIGHT}
									onChange={(v) => updateLayer({ lineHeight: v })}
									allowDecimal
									step={0.1}
								/>
							</div>
						</div>
					</CollapsibleSection>
				)}

				<CollapsibleSection title="Appearance" icon={Settings2}>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label className="text-[10px] text-gray-500">Opacity</Label>
							<div className="flex items-center gap-2">
								<DraggableNumberInput
									label="%"
									icon={Layers}
									value={Math.round((selectedLayer.opacity ?? 1) * 100)}
									onChange={(v) => updateLayer({ opacity: v / 100 })}
									min={0}
									max={100}
									className="flex-1"
								/>
							</div>
						</div>

						<div className="space-y-2">
							<Label className="text-[10px] text-gray-500">Blend Mode</Label>
							<Select
								value={selectedLayer.blendMode || "source-over"}
								onValueChange={(val) => updateLayer({ blendMode: val })}
							>
								<SelectTrigger className="h-8 text-[11px] capitalize bg-white/5 border-white/10 text-white">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="bg-neutral-800 border-white/10 text-white max-h-[200px]">
									{BLEND_MODES.map((m) => (
										<SelectItem
											key={m}
											value={m}
											className="capitalize text-xs"
										>
											{m.replace("-", " ")}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</CollapsibleSection>
			</div>
		</ScrollArea>
	);
};

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
		<div className="flex items-center gap-1.5 p-1.5 rounded-full bg-[#1a1a1a] border border-white/10 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4">
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

			<div className="w-px h-4 bg-white/10 mx-1" />

			<Menubar className="border-none bg-transparent h-auto p-0">
				<MenubarMenu>
					<MenubarTrigger asChild>
						<Button
							variant="ghost"
							className="h-8 px-3 text-[11px] rounded-full text-gray-300 hover:text-white hover:bg-white/10 font-medium tabular-nums"
							onDoubleClick={() => zoomTo(1)}
						>
							{zoomPercentage}
							<ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
						</Button>
					</MenubarTrigger>
					<MenubarContent
						align="center"
						sideOffset={10}
						className="min-w-[140px] bg-[#1a1a1a] border-white/10 text-gray-200"
					>
						<MenubarItem onClick={() => zoomIn()}>Zoom In (+)</MenubarItem>
						<MenubarItem onClick={() => zoomOut()}>Zoom Out (-)</MenubarItem>
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

			<div className="flex items-center gap-1.5 pr-1">
				<Button
					size="sm"
					className="h-7 text-[11px] font-medium rounded-full px-4  border-0 transition-transform active:scale-95"
					onClick={onSave}
					disabled={!isDirty}
				>
					Save
				</Button>
				<Button
					size="sm"
					variant="ghost"
					className="h-7 w-7 rounded-full p-0 text-gray-400 hover:text-white hover:bg-red-500/20 transition-colors"
					onClick={onClose}
				>
					<span className="sr-only">Close</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<title>Close</title>
						<path d="M18 6 6 18" />
						<path d="m6 6 12 12" />
					</svg>
				</Button>
			</div>
		</div>
	);
});

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
	const [layers, setLayers] = useState<LocalCompositorLayer[]>([]);

	const [isDirty, setIsDirty] = useState(false);

	const updateLayers = useCallback(
		(
			updater: SetStateAction<LocalCompositorLayer[]>,
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
	const [viewportWidth, setViewportWidth] = useState(nodeConfig.width ?? 1080);
	const [viewportHeight, setViewportHeight] = useState(
		nodeConfig.height ?? 1080,
	);

	const updateViewportWidth = useCallback((w: number) => {
		setViewportWidth(w);
		setIsDirty(true);
	}, []);

	const updateViewportHeight = useCallback((h: number) => {
		setViewportHeight(h);
		setIsDirty(true);
	}, []);

	const [guides, setGuides] = useState<Guide[]>([]);
	const [isEditingText, setIsEditingText] = useState(false);
	const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

	const stageRef = useRef<Konva.Stage | null>(null);
	const transformerRef = useRef<Konva.Transformer | null>(null);

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
		const padding = 80;
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
	const zoomIn = useCallback(() => setScale((s) => s * 1.2), []);
	const zoomOut = useCallback(() => setScale((s) => s / 1.2), []);
	const zoomTo = useCallback((value: number) => setScale(value), []);

	// Data getters
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

	// Initialize layers
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
					const newLayer: LocalCompositorLayer = {
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
						newLayer.width = existingConfig.width;
						newLayer.fontSize = DEFAULTS.FONT_SIZE;
						newLayer.fontFamily = DEFAULTS.FONT_FAMILY;
						newLayer.fontStyle = "normal";
						newLayer.textDecoration = "";
						newLayer.fill = DEFAULTS.FILL;
						newLayer.letterSpacing = DEFAULTS.LETTER_SPACING;
						newLayer.lineHeight = DEFAULTS.LINE_HEIGHT;
						newLayer.align = DEFAULTS.ALIGN;
						newLayer.verticalAlign = DEFAULTS.VERTICAL_ALIGN;
						newLayer.computedHeight = undefined;
					}

					if (newLayer.type === "Image") {
						const fData = getImageData(handleId);
						if (fData.entity) {
							newLayer.width = Math.round(
								fData.entity.width ?? existingConfig.width ?? 300,
							);
						} else if (fData.processData) {
							newLayer.width = Math.round(
								fData.processData.width ?? existingConfig.width ?? 300,
							);
						} else {
							newLayer.width = existingConfig.width;
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

	// Keyboard Shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isInput =
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA";
			if (isInput) return;

			// Tools
			if (e.key.toLowerCase() === "v") setMode("select");
			if (e.key.toLowerCase() === "h") setMode("pan");

			// Pan Spacebar
			if (e.code === "Space" && !e.repeat) {
				e.preventDefault();
				if (mode !== "pan") {
					lastModeRef.current = mode;
					setMode("pan");
				}
			}

			// Zoom
			if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
				e.preventDefault();
				zoomIn();
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "-") {
				e.preventDefault();
				zoomOut();
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "0") {
				e.preventDefault();
				fitView();
			}

			// Nudge
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

			// Delete
			if (e.key === "Delete" || e.key === "Backspace") {
				// Optional: Add layer deletion if desired, currently purely hiding via opacity
				// if (selectedId) updateLayers(prev => prev.filter(l => l.id !== selectedId));
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
	}, [mode, selectedId, updateLayers, zoomIn, zoomOut, fitView]);

	const handleSave = useCallback(() => {
		const layerUpdates = layers.reduce<Record<string, CompositorLayer>>(
			(acc, layer) => {
				const { ...rest } = layer;
				acc[layer.inputHandleId] = rest;
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
				transformerRef,
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
			<div className="flex h-screen w-screen bg-[#050505] overflow-hidden relative text-foreground font-sans selection:bg-blue-500/30">
				<div className="relative shrink-0 z-20">
					<LayersPanel />
				</div>

				<div className="flex-1 flex flex-col relative min-w-0 z-0">
					<div
						ref={containerRef}
						className="flex-1 relative overflow-hidden bg-[#050505]"
					>
						{/* Subtle Grid Background */}
						<div
							className="absolute inset-0 pointer-events-none opacity-20"
							style={{
								backgroundImage:
									"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)",
								backgroundSize: "20px 20px",
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
					<AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
						<AlertDialogHeader>
							<AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
							<AlertDialogDescription className="text-gray-400">
								You have unsaved changes. Are you sure you want to leave without
								saving?
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white">
								Cancel
							</AlertDialogCancel>
							<AlertDialogAction
								onClick={onClose}
								className="bg-red-600 text-white hover:bg-red-700 border-0"
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
