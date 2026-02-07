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
import { COMPOSITOR_DEFAULTS } from "@gatewai/types";
import { Separator } from "@radix-ui/react-menubar";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
	ChevronDown,
	Eye,
	EyeOff,
	Hand,
	ImageIcon,
	Layers,
	LockOpen,
	MousePointer,
	MoveHorizontal,
	MoveVertical,
	Save,
	Settings2,
	Type,
	X as XIcon,
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
import { useHotkeys } from "react-hotkeys-hook";
import {
	Group as KonvaGroup,
	Image as KonvaImage,
	Label as KonvaLabel,
	Layer as KonvaLayer,
	Text as KonvaText,
	Line,
	Rect,
	Stage,
	Tag,
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { dataTypeColors } from "@/config/colors";
import { GetAssetEndpoint, GetFontAssetUrl } from "@/lib/file";
import { fontManager } from "@/lib/fonts";
import { CollapsibleSection } from "@/modules/common/CollapsibleSection";
import { StyleControls } from "@/modules/common/properties/StyleControls";
import { TransformControls } from "@/modules/common/properties/TransformControls";
import { TypographyControls } from "@/modules/common/properties/TypographyControls";
import { useAppSelector } from "@/store";
import { useGetFontListQuery } from "@/store/fonts";
import type { HandleEntityType } from "@/store/handles";
import { handleSelectors } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";

//#region CONSTANTS
// Local defaults removed in favor of shared COMPOSITOR_DEFAULTS

const ASPECT_RATIOS = [
	{ label: "Youtube / HD (16:9)", width: 1280, height: 720 },
	{ label: "Full HD (16:9)", width: 1920, height: 1080 },
	{ label: "TikTok / Reel (9:16)", width: 720, height: 1280 },
	{ label: "Square (1:1)", width: 1080, height: 1080 },
	{ label: "Portrait (4:5)", width: 1080, height: 1350 },
];

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
	computedWidth?: number;
}

/**
 * Resolves the display label for a layer based on priority:
 * 1. Handle Label (if not null/empty)
 * 2. First DataType from Handle
 * 3. Layer ID
 */
const resolveLayerLabel = (
	handle: any,
	layer: LocalCompositorLayer,
): string => {
	if (
		handle?.label &&
		typeof handle.label === "string" &&
		handle.label.trim() !== ""
	) {
		return handle.label;
	}
	if (
		Array.isArray(handle?.dataTypes) &&
		handle.dataTypes.length > 0 &&
		handle.dataTypes[0]
	) {
		return handle.dataTypes[0];
	}
	return layer.id;
};

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
	hoveredId: string | null;
	setHoveredId: (id: string | null) => void;
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
				if (layer.id !== excludeId && layer.opacity !== 0) {
					const effectiveWidth =
						layer.type === "Text"
							? (layer.computedWidth ?? 0)
							: (layer.width ?? 0);
					const effectiveHeight =
						layer.type === "Text"
							? (layer.computedHeight ?? 0)
							: (layer.height ?? 0);

					const centerX = Math.round(layer.x + effectiveWidth / 2);
					const centerY = Math.round(layer.y + effectiveHeight / 2);

					vSnaps.push(
						Math.round(layer.x),
						centerX,
						Math.round(layer.x + effectiveWidth),
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

			if (e.evt.shiftKey) {
				setGuides([]);
				return;
			}

			const { hSnaps, vSnaps } = getSnapPositions(id);
			let newX = node.x();
			let newY = node.y();

			const nodeWidth = node.width() * node.scaleX();
			const nodeHeight = node.height() * node.scaleY();

			const centerX = newX + nodeWidth / 2;
			const centerY = newY + nodeHeight / 2;
			const right = newX + nodeWidth;
			const bottom = newY + nodeHeight;

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

			if (vGuides.length > 0) node.x(newX);
			if (hGuides.length > 0) node.y(newY);

			// Sync Label Position
			const labelNode = node.getStage()?.findOne(`#label-${id}`);
			if (labelNode) {
				const scale = node.getStage()?.scaleX() || 1;
				const invScale = 1 / scale;
				labelNode.x(newX);
				labelNode.y(newY - 26 * invScale);
			}

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

			node.scaleX(1);
			node.scaleY(1);

			updateLayers((prev) =>
				prev.map((l) => {
					if (l.id !== id) return l;

					const updates: Partial<LocalCompositorLayer> = {
						x: Math.round(node.x()),
						y: Math.round(node.y()),
						rotation: Math.round(node.rotation()),
					};

					if (l.type !== "Text") {
						updates.width = Math.round(node.width() * scaleX);
						updates.height = Math.round(node.height() * scaleY);
					}

					return { ...l, ...updates };
				}),
			);
		},
		[updateLayers],
	);

	return {
		handleDragMove,
		handleDragEnd,
		handleTransformEnd,
	};
};

//#region Components

interface LayerProps {
	layer: LocalCompositorLayer;
	onDragStart: (e: KonvaEventObject<DragEvent>) => void;
	onDragMove: (e: KonvaEventObject<DragEvent>) => void;
	onDragEnd: (e: KonvaEventObject<DragEvent>) => void;
	onTransformEnd: (e: KonvaEventObject<Event>) => void;
}

const ImageLayer: React.FC<LayerProps> = ({
	layer,
	onDragStart,
	onDragMove,
	onDragEnd,
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

	const handleSelect = () => setSelectedId(layer.id);

	const handleTransform = useCallback((e: KonvaEventObject<Event>) => {
		const node = e.target as Konva.Image;
		const scaleX = node.scaleX();
		const scaleY = node.scaleY();
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
			onTransform={handleTransform}
			onTransformEnd={onTransformEnd}
			onMouseEnter={() => useEditor().setHoveredId(layer.id)}
			onMouseLeave={() => useEditor().setHoveredId(null)}
			globalCompositeOperation={layer.blendMode as GlobalCompositeOperation}
			opacity={layer.opacity ?? 1}
			stroke={layer.stroke}
			strokeWidth={layer.strokeWidth ?? COMPOSITOR_DEFAULTS.STROKE_WIDTH}
			cornerRadius={layer.cornerRadius ?? COMPOSITOR_DEFAULTS.CORNER_RADIUS}
			visible={layer.opacity !== 0}
		/>
	);
};

const TextLayer: React.FC<LayerProps> = ({
	layer,
	onDragStart,
	onDragMove,
	onDragEnd,
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

	useEffect(() => {
		const node = textRef.current;
		if (!node) return;

		const syncDimensions = () => {
			const calculatedWidth = node.textWidth;
			const calculatedHeight = node.textHeight;

			if (selectedId === layer.id && transformerRef.current) {
				transformerRef.current.forceUpdate();
				transformerRef.current.getLayer()?.batchDraw();
			}

			if (
				typeof calculatedWidth !== "number" ||
				typeof calculatedHeight !== "number"
			)
				return;

			if (
				Math.abs(calculatedWidth - (layer.computedWidth ?? 0)) > 0.5 ||
				Math.abs(calculatedHeight - (layer.computedHeight ?? 0)) > 0.5
			) {
				updateLayers(
					(prev) =>
						prev.map((l) =>
							l.id === layer.id
								? {
										...l,
										computedWidth: calculatedWidth,
										computedHeight: calculatedHeight,
									}
								: l,
						),
					false,
				);
			}
		};

		if (layer.fontFamily) {
			document.fonts.ready.then(syncDimensions);
		} else {
			syncDimensions();
		}
		stageRef.current?.batchDraw();
	}, [
		layer.fontFamily,
		layer.fontSize,
		layer.lineHeight,
		layer.letterSpacing,
		layer.textDecoration,
		layer.fontStyle,
		text,
		selectedId,
		layer.id,
		layer.computedHeight,
		layer.computedWidth,
		updateLayers,
		transformerRef,
		stageRef,
	]);

	useEffect(() => {
		if (layer.fontFamily) {
			const fontUrl = GetFontAssetUrl(layer.fontFamily);
			fontManager
				.loadFont(layer.fontFamily, fontUrl)
				.then(() => {
					stageRef.current?.batchDraw();
					if (textRef.current) {
						const w = textRef.current.textWidth;
						const h = textRef.current.textHeight;
						if (typeof w !== "number" || typeof h !== "number") return;
						if (
							Math.abs(w - (layer.computedWidth ?? 0)) > 0.5 ||
							Math.abs(h - (layer.computedHeight ?? 0)) > 0.5
						) {
							updateLayers(
								(prev) =>
									prev.map((l) =>
										l.id === layer.id
											? { ...l, computedWidth: w, computedHeight: h }
											: l,
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
		layer.computedWidth,
	]);

	return (
		<KonvaText
			ref={textRef}
			id={layer.id}
			name="object"
			x={layer.x}
			y={layer.y}
			text={text as string}
			fontSize={layer.fontSize ?? COMPOSITOR_DEFAULTS.FONT_SIZE}
			fontFamily={layer.fontFamily ?? COMPOSITOR_DEFAULTS.FONT_FAMILY}
			fontStyle={layer.fontStyle ?? "normal"}
			textDecoration={layer.textDecoration ?? ""}
			fill={layer.fill ?? COMPOSITOR_DEFAULTS.FILL}
			rotation={layer.rotation}
			draggable={mode === "select"}
			onClick={handleSelect}
			onTap={handleSelect}
			onDblClick={handleDoubleClick}
			onDblTap={handleDoubleClick}
			onDragStart={onDragStart}
			onDragMove={onDragMove}
			onDragEnd={onDragEnd}
			onTransformEnd={onTransformEnd}
			onMouseEnter={() => useEditor().setHoveredId(layer.id)}
			onMouseLeave={() => useEditor().setHoveredId(null)}
			globalCompositeOperation={layer.blendMode as GlobalCompositeOperation}
			align={layer.align || COMPOSITOR_DEFAULTS.ALIGN}
			letterSpacing={layer.letterSpacing ?? COMPOSITOR_DEFAULTS.LETTER_SPACING}
			lineHeight={layer.lineHeight ?? COMPOSITOR_DEFAULTS.LINE_HEIGHT}
			padding={layer.padding ?? COMPOSITOR_DEFAULTS.PADDING}
			stroke={layer.stroke}
			strokeWidth={layer.strokeWidth ?? COMPOSITOR_DEFAULTS.STROKE_WIDTH}
			opacity={layer.opacity ?? 1}
			visible={layer.opacity !== 0}
		/>
	);
};

const LayerLabel: React.FC<{ layer: LocalCompositorLayer }> = ({ layer }) => {
	const { scale } = useEditor();
	const handles = useAppSelector(handleSelectors.selectEntities);
	const handle = handles[layer.inputHandleId];
	const name = useMemo(() => resolveLayerLabel(handle, layer), [handle, layer]);

	const colorConfig = useMemo(() => {
		const type = handle?.dataTypes?.[0];
		// @ts-expect-error
		return dataTypeColors[type] || { hex: "#555" };
	}, [handle]);

	const { selectedId, hoveredId } = useEditor();
	const isVisible = layer.id === selectedId || layer.id === hoveredId;

	// Constant size label (inverse scale)
	const invScale = 1 / scale;

	if (layer.opacity === 0 || !isVisible) return null;

	// Calculate Y offset to position label ABOVE the layer
	// Tag height is roughly 24px (fontSize 12 + padding 6*2) => 24. adjust as needed.
	// We want it slightly above: say 26px.
	const yOffset = 26 * invScale;

	return (
		<KonvaLabel
			id={`label-${layer.id}`}
			x={layer.x}
			y={layer.y - yOffset}
			scaleX={invScale}
			scaleY={invScale}
			listening={false}
		>
			<Tag
				fill={colorConfig.hex}
				cornerRadius={2}
				opacity={1}
				shadowColor="black"
				shadowBlur={2}
				shadowOpacity={0.2}
			/>
			<KonvaText
				text={name}
				padding={4}
				fill="#fff"
				fontSize={10}
				fontFamily="Inter"
				fontStyle="bold"
			/>
		</KonvaLabel>
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
			return [];
		}
		if (selectedLayer?.lockAspect) {
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
	// Checkered pattern for transparency
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
		<KonvaGroup>
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
			<Rect
				x={0}
				y={0}
				width={viewportWidth}
				height={viewportHeight}
				fillPatternImage={patternImage as any}
				fillPatternRepeat="repeat"
				listening={false}
			/>
		</KonvaGroup>
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

	// --- Hotkeys ---

	useHotkeys("h", () => {
		setMode("pan");
	}, []);
	useHotkeys("v", () => {
		setMode("select");
	}, []);
	useHotkeys(
		"space",
		(e) => {
			e.preventDefault(); // Prevent scrolling
			if (mode !== "pan") {
				lastModeRef.current = mode;
				setMode("pan");
			}
		},
		{ keydown: true },
	);
	useHotkeys(
		"space",
		(e) => {
			e.preventDefault();
			if (mode === "pan") {
				setMode(lastModeRef.current || "select");
			}
		},
		{ keyup: true },
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
			// Middle mouse (button 1) OR Pan Mode
			if (e.evt.button === 1 || mode === "pan") {
				e.evt.preventDefault();
				const stage = e.currentTarget;

				// Ensure we are in pan mode for the cursor style
				if (mode !== "pan") {
					lastModeRef.current = mode;
					setMode("pan");
				}

				stage.draggable(true);
				stage.startDrag();

				const reset = () => {
					stage.draggable(false);
					// If this was a middle-click temporary pan, revert.
					// If we are holding Space, the keyup handler handles revert.
					// If we are manually in Pan mode (H), we stay in Pan mode.

					// Logic: If button was 1 (middle), revert.
					if (e.evt.button === 1) {
						setMode(lastModeRef.current || "select");
					}
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

			// Zoom if Ctrl/Meta is pressed
			if (e.evt.ctrlKey || e.evt.metaKey) {
				const oldScale = stage.scaleX();
				const pointer = stage.getPointerPosition();
				if (!pointer) return;

				const mousePointTo = {
					x: (pointer.x - stage.x()) / oldScale,
					y: (pointer.y - stage.y()) / oldScale,
				};

				const direction = e.evt.deltaY > 0 ? -1 : 1;
				const scaleBy = 1.1;
				const newScale =
					direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

				if (newScale < 0.05 || newScale > 20) return;

				const newPos = {
					x: pointer.x - mousePointTo.x * newScale,
					y: pointer.y - mousePointTo.y * newScale,
				};

				setScale(newScale);
				setStagePos(newPos);
				return;
			}

			// Pan (Scroll) logic
			// Shift = Horizontal Pan
			// Default = Vertical Pan
			const sensitivity = 1; // Adjust sensitivity as needed
			let dx = 0;
			let dy = 0;

			if (e.evt.shiftKey) {
				dx = -e.evt.deltaY * sensitivity;
				dy = -e.evt.deltaX * sensitivity; // Handle horizontal scroll devices
			} else {
				dx = -e.evt.deltaX * sensitivity;
				dy = -e.evt.deltaY * sensitivity;
			}

			setStagePos({
				x: stagePos.x + dx,
				y: stagePos.y + dy,
			});
		},
		[stageRef, setScale, setStagePos, stagePos],
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
						layer,
						onDragStart: () => setSelectedId(layer.id),
						onDragMove: handleDragMove,
						onDragEnd: handleDragEnd,
						onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
							setSelectedId(layer.id);
							handleTransformEnd(e);
						},
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
			{/* Labels on top of content but below UI overlays */}
			<KonvaLayer listening={false}>
				{sortedLayers.map((layer) => (
					<LayerLabel key={layer.id} layer={layer} />
				))}
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

//#region Panels

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
	const handles = useAppSelector(handleSelectors.selectEntities);
	const handle = handles[layer.inputHandleId];
	const name = useMemo(() => resolveLayerLabel(handle, layer), [handle, layer]);

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
			if (!isDragging) setSelectedId(layer.id);
		}
	};

	return (
		<button
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={`
        flex items-center gap-2 px-3 py-2 border-b border-white/5 cursor-pointer outline-none group transition-colors select-none w-full text-left
        ${isSelected ? "bg-blue-600/20 text-blue-100" : "hover:bg-white/5 text-gray-400"}
        ${isDragging ? "bg-neutral-800" : ""}
      `}
			onClick={() => !isDragging && setSelectedId(layer.id)}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			type="button"
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
				{name}
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
					return { ...l, zIndex: newSorted.length - pos };
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
		<div className="absolute left-0 top-0 bottom-0 w-60 bg-[#0f0f0f] border-r border-white/10 z-20 flex flex-col shadow-2xl">
			<div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-neutral-900/50 backdrop-blur shrink-0 h-10">
				<span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
					<Layers className="w-3.5 h-3.5" /> Layers
				</span>
			</div>

			<ScrollArea className="flex-1 bg-[#0f0f0f]">
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

		const effectiveWidth =
			selectedLayer.type === "Text"
				? (selectedLayer.computedWidth ?? 0)
				: (selectedLayer.width ?? 0);
		const effectiveHeight =
			selectedLayer.type === "Text"
				? (selectedLayer.computedHeight ?? 0)
				: (selectedLayer.height ?? 0);

		if (axis === "x") {
			updateLayer({ x: Math.round((viewportWidth - effectiveWidth) / 2) });
		} else {
			updateLayer({ y: Math.round((viewportHeight - effectiveHeight) / 2) });
		}
	};

	// Unused toggles removed

	if (!selectedLayer) {
		return (
			<ScrollArea className="w-72 h-full border-l border-white/10 bg-[#0f0f0f] z-20 shadow-xl">
				<div className="flex flex-col min-h-full">
					<div className="px-4 py-3 bg-neutral-900 border-b border-white/5 shrink-0 h-10 flex items-center">
						<h2 className="text-[10px] font-bold text-gray-200 uppercase tracking-wide flex items-center gap-2">
							<Settings2 className="w-3.5 h-3.5 text-blue-400" />
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
									const preset = ASPECT_RATIOS.find((r) => r.label === val);
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
									{ASPECT_RATIOS.map((r) => (
										<SelectItem key={r.label} value={r.label}>
											<span className="flex items-center justify-between w-full gap-6">
												<span>{r.label}</span>
												<span className="text-[10px] text-gray-500 font-mono">
													{r.width}x{r.height}
												</span>
											</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-white/10 rounded-lg bg-white/2">
							<MousePointer className="w-6 h-6 text-gray-700 mb-3" />
							<p className="text-[11px] font-medium text-gray-400">
								No Layer Selected
							</p>
							<p className="text-[10px] text-gray-600 mt-1">
								Select a layer to edit properties
							</p>
						</div>
					</div>
				</div>
			</ScrollArea>
		);
	}

	return (
		<ScrollArea className="w-72 h-full border-l border-white/10 bg-[#0f0f0f] z-20 shadow-xl">
			<div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-neutral-900/50 backdrop-blur">
				<div className="flex flex-col min-w-0">
					<span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider mb-0.5">
						Properties
					</span>
					<div className="flex items-center gap-2">
						<h2 className="text-sm font-semibold text-white truncate max-w-[140px]">
							{selectedLayer.id}
						</h2>
					</div>
				</div>
				<span className="text-[9px] bg-white/10 px-2 py-1 rounded text-gray-300 font-medium uppercase border border-white/5 tracking-wider">
					{selectedLayer.type}
				</span>
			</div>

			<div className="pb-20">
				<TransformControls
					x={selectedLayer.x}
					y={selectedLayer.y}
					width={selectedLayer.width}
					height={selectedLayer.height}
					rotation={selectedLayer.rotation}
					lockAspect={selectedLayer.lockAspect}
					showDimensions={selectedLayer.type !== "Text"}
					showScale={false}
					showLockAspect={selectedLayer.type === "Image"}
					onChange={updateLayer}
					onCenter={centerLayer}
				/>

				<StyleControls
					backgroundColor={undefined}
					stroke={selectedLayer.stroke}
					strokeWidth={selectedLayer.strokeWidth}
					cornerRadius={selectedLayer.cornerRadius}
					padding={selectedLayer.padding}
					opacity={selectedLayer.opacity}
					showBackground={false}
					showStroke={true}
					showCornerRadius={selectedLayer.type === "Image"}
					showPadding={selectedLayer.type === "Text"}
					showOpacity={true}
					onChange={updateLayer}
				/>

				{selectedLayer.type === "Text" && (
					<TypographyControls
						fontFamily={selectedLayer.fontFamily ?? "Inter"}
						fontSize={selectedLayer.fontSize ?? 40}
						fill={selectedLayer.fill ?? "#fff"}
						fontStyle={selectedLayer.fontStyle ?? "normal"}
						textDecoration={selectedLayer.textDecoration ?? ""}
						align={selectedLayer.align}
						letterSpacing={selectedLayer.letterSpacing}
						lineHeight={selectedLayer.lineHeight}
						onChange={updateLayer}
					/>
				)}

				<CollapsibleSection title="Blending" icon={Settings2}>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label className="text-[10px] text-gray-500 font-semibold">
								BLEND MODE
							</Label>
							<Select
								value={selectedLayer.blendMode || "source-over"}
								onValueChange={(val) =>
									updateLayer({ blendMode: val as GlobalCompositeOperation })
								}
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
		<div className="flex items-center gap-1.5 p-1.5 rounded-full border border-border/50 bg-background/80 backdrop-blur-md shadow-2xl ring-1 ring-white/5 z-50 animate-in fade-in slide-in-from-bottom-4">
			<TooltipProvider>
				<div className="flex rounded-full p-0.5">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={mode === "select" ? "secondary" : "ghost"}
								size="icon"
								className="rounded-full w-8 h-8"
								onClick={() => setMode("select")}
							>
								<MousePointer className="w-3.5 h-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Select Tool (V)</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={mode === "pan" ? "secondary" : "ghost"}
								size="icon"
								className="rounded-full w-8 h-8"
								onClick={() => setMode("pan")}
							>
								<Hand className="w-3.5 h-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Pan Tool (H) or hold Space</TooltipContent>
					</Tooltip>
				</div>
			</TooltipProvider>

			<div className="w-px h-5 bg-white/10 mx-1" />

			<Menubar className="border-none bg-transparent h-auto p-0">
				<MenubarMenu>
					<MenubarTrigger asChild>
						<Button
							variant="ghost"
							className="h-8 px-3 text-[11px] rounded-full text-gray-300 hover:text-white hover:bg-white/10 font-medium min-w-[80px] justify-between"
							onDoubleClick={() => zoomTo(1)}
						>
							{zoomPercentage}
							<ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
						</Button>
					</MenubarTrigger>
					<MenubarContent
						align="center"
						sideOffset={10}
						className="min-w-40 bg-neutral-900/95 backdrop-blur-xl border-white/10 text-gray-200"
					>
						<MenubarItem onClick={() => zoomIn()}>
							<span className="flex-1">Zoom In</span>
							<span className="text-xs text-gray-500 ml-4">+</span>
						</MenubarItem>
						<MenubarItem onClick={() => zoomOut()}>
							<span className="flex-1">Zoom Out</span>
							<span className="text-xs text-gray-500 ml-4">−</span>
						</MenubarItem>
						<MenubarItem onClick={() => zoomTo(1)}>
							<span className="flex-1">Actual Size</span>
							<span className="text-xs text-gray-500 ml-4">1</span>
						</MenubarItem>
						<Separator className="my-1 bg-white/10" />
						<MenubarItem onClick={() => fitView()}>
							<span className="flex-1">Fit to Screen</span>
							<span className="text-xs text-gray-500 ml-4">0</span>
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>

			<div className="w-px h-5 bg-white/10 mx-1" />

			<div className="flex items-center gap-1">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size="sm"
								variant="default"
								className="h-8 text-[11px] font-semibold rounded-full px-4"
								onClick={onSave}
								disabled={!isDirty}
							>
								<Save className="w-3.5 h-3.5 mr-1" />
								Save
							</Button>
						</TooltipTrigger>
						<TooltipContent>Save (⌘S)</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size="icon"
								variant="ghost"
								className="h-8 w-8 rounded-full text-gray-400 hover:text-white hover:bg-white/10"
								onClick={onClose}
							>
								<XIcon className="w-4 h-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Close (Esc)</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>
		</div>
	);
});

//#region Main Editor

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
	const [hoveredId, setHoveredId] = useState<string | null>(null);
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

	// Resize observer
	useEffect(() => {
		const updateSize = () => {
			if (containerRef.current) {
				setScreenWidth(containerRef.current.offsetWidth);
				setScreenHeight(containerRef.current.offsetHeight);
			}
		};
		updateSize();
		const observer = new ResizeObserver(updateSize);
		if (containerRef.current) observer.observe(containerRef.current);
		return () => observer.disconnect();
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

	// Initial centering
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
						newLayer.fontSize = COMPOSITOR_DEFAULTS.FONT_SIZE;
						newLayer.fontFamily = COMPOSITOR_DEFAULTS.FONT_FAMILY;
						newLayer.fontStyle = "normal";
						newLayer.textDecoration = "";
						newLayer.fill = COMPOSITOR_DEFAULTS.FILL;
						newLayer.letterSpacing = COMPOSITOR_DEFAULTS.LETTER_SPACING;
						newLayer.lineHeight = COMPOSITOR_DEFAULTS.LINE_HEIGHT;
						newLayer.align = COMPOSITOR_DEFAULTS.ALIGN;
						newLayer.verticalAlign = COMPOSITOR_DEFAULTS.VERTICAL_ALIGN;
						newLayer.padding = COMPOSITOR_DEFAULTS.PADDING;
						newLayer.computedHeight = undefined;
						newLayer.computedWidth = undefined;
					}

					if (newLayer.type === "Image") {
						const fData = getImageData(handleId);
						if (fData.entity) {
							newLayer.width = Math.round(
								fData.entity.width ?? existingConfig.width ?? 300,
							);
							newLayer.height = Math.round(
								fData.entity.height ?? existingConfig.height ?? 300,
							);
						} else if (fData.processData) {
							newLayer.width = Math.round(
								fData.processData.width ?? existingConfig.width ?? 300,
							);
							newLayer.height = Math.round(
								fData.processData.height ?? existingConfig.height ?? 300,
							);
						} else {
							newLayer.width = existingConfig.width;
							newLayer.height = existingConfig.height;
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

			// Save (Ctrl/Cmd + S)
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				if (isDirty) handleSave();
				return;
			}

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
				// Optional: Add layer deletion if desired
			}

			// Close (Esc)
			if (e.key === "Escape") {
				handleCloseRequest();
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
	}, [mode, selectedId, updateLayers, zoomIn, zoomOut, fitView, isDirty]);

	const handleSave = useCallback(() => {
		const layerUpdates = layers.reduce<Record<string, CompositorLayer>>(
			(acc, layer) => {
				const { computedHeight, computedWidth, ...rest } = layer;
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

	const handleDiscardAndClose = () => {
		setShowCloseAlert(false);
		onClose();
	};

	const handleSaveAndClose = () => {
		handleSave();
		setShowCloseAlert(false);
		onClose();
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
				hoveredId,
				setHoveredId,
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
						style={{
							backgroundImage:
								"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
							backgroundSize: "32px 32px",
							backgroundColor: "#0F0F0F",
						}}
					>
						<Canvas />
					</div>

					{/* Floating Toolbar */}
					<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300">
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
							<AlertDialogTitle className="text-white">
								Unsaved Changes
							</AlertDialogTitle>
							<AlertDialogDescription className="text-gray-400">
								You have unsaved changes. Are you sure you want to leave without
								saving?
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel
								onClick={() => setShowCloseAlert(false)}
								className="bg-transparent border-white/10 text-gray-300 hover:bg-white/5 hover:text-white"
							>
								Cancel
							</AlertDialogCancel>
							<Button
								variant="destructive"
								onClick={handleDiscardAndClose}
								className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0"
							>
								Discard
							</Button>
							<AlertDialogAction
								onClick={handleSaveAndClose}
								className="bg-primary text-primary-foreground hover:bg-primary/90"
							>
								Save & Close
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</EditorContext.Provider>
	);
};
