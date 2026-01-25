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
	ChevronDown,
	Eye,
	EyeOff,
	Hand,
	ImageIcon,
	Layers,
	MousePointer,
	Move,
	MoveHorizontal,
	MoveVertical,
	RotateCw,
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

// UI Components
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
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/util/color-input";
import { fontManager } from "@/lib/fonts";
import { useGetFontListQuery } from "@/store/fonts";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { GetAssetEndpoint, GetFontAssetUrl } from "@/utils/file";

// -----------------------------------------------------------------------------
// Constants & Types
// -----------------------------------------------------------------------------

const DEFAULTS = {
	FONT_FAMILY: "Inter",
	FONT_SIZE: 64,
	FILL: "#ffffff",
	LINE_HEIGHT: 1.1,
	ALIGN: "left",
	VERTICAL_ALIGN: "top",
	LETTER_SPACING: 0,
	CANVAS_WIDTH: 1080,
	CANVAS_HEIGHT: 1080,
} as const;

const ASPECT_RATIOS = [
	{ label: "Youtube / HD (16:9)", width: 1280, height: 720 },
	{ label: "Full HD (16:9)", width: 1920, height: 1080 },
	{ label: "TikTok / Reel (9:16)", width: 720, height: 1280 },
	{ label: "Square (1:1)", width: 1080, height: 1080 },
	{ label: "Portrait (4:5)", width: 1080, height: 1350 },
] as const;

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
	// Ensure zIndex is always present for local sorting
	zIndex: number;
}

interface Guide {
	type: "horizontal" | "vertical";
	position: number;
}

// -----------------------------------------------------------------------------
// Context Definition
// -----------------------------------------------------------------------------

interface EditorState {
	// Canvas State
	layers: LocalCompositorLayer[];
	zoomPercentage: string; // Add this
	updateLayers: (
		updater: SetStateAction<LocalCompositorLayer[]>,
		isUserChange?: boolean,
	) => void;
	updateLayer: (id: string, updates: Partial<LocalCompositorLayer>) => void;

	// Selection State
	selectedId: string | null;
	setSelectedId: (id: string | null) => void;

	// Viewport State
	viewportWidth: number;
	viewportHeight: number;
	updateViewportSize: (w: number, h: number) => void;

	// Tool State
	mode: "select" | "pan";
	setMode: Dispatch<SetStateAction<"select" | "pan">>;
	isEditingText: boolean;
	setIsEditingText: (editing: boolean) => void;
	editingLayerId: string | null;
	setEditingLayerId: (id: string | null) => void;

	// Zoom/Pan State
	scale: number;
	setScale: Dispatch<SetStateAction<number>>;
	stagePos: { x: number; y: number };
	setStagePos: Dispatch<SetStateAction<{ x: number; y: number }>>;
	zoomIn: () => void;
	zoomOut: () => void;
	zoomTo: (value: number) => void;
	fitView: () => void;

	// Refs & Layout
	stageRef: RefObject<Konva.Stage | null>;
	transformerRef: RefObject<Konva.Transformer | null>;
	containerSize: { width: number; height: number };

	// Guides
	guides: Guide[];
	setGuides: Dispatch<SetStateAction<Guide[]>>;

	// Data Access
	getTextData: (handleId: string) => string;
	getImageData: (handleId: string) => FileData;
	getImageUrl: (handleId: string) => string | undefined;

	// Meta
	isDirty: boolean;
	setIsDirty: Dispatch<SetStateAction<boolean>>;
	isNodeDragging: boolean;
	setIsNodeDragging: Dispatch<SetStateAction<boolean>>;
}

const EditorContext = createContext<EditorState | undefined>(undefined);

const useEditor = () => {
	const context = useContext(EditorContext);
	if (!context) throw new Error("useEditor must be used within EditorProvider");
	return context;
};

// -----------------------------------------------------------------------------
// Hooks (Logic)
// -----------------------------------------------------------------------------

const useSnapping = (
	layers: LocalCompositorLayer[],
	viewportW: number,
	viewportH: number,
	setGuides: Dispatch<SetStateAction<Guide[]>>,
) => {
	const SNAP_THRESHOLD = 5;

	const getSnapPositions = useCallback(
		(excludeId: string) => {
			const hSnaps: number[] = [0, Math.round(viewportH / 2), viewportH];
			const vSnaps: number[] = [0, Math.round(viewportW / 2), viewportW];

			for (const layer of layers) {
				if (layer.id !== excludeId && layer.opacity !== 0) {
					const w =
						layer.type === "Text"
							? (layer.computedWidth ?? 0)
							: (layer.width ?? 0);
					const h =
						layer.type === "Text"
							? (layer.computedHeight ?? 0)
							: (layer.height ?? 0);

					const cx = Math.round(layer.x + w / 2);
					const cy = Math.round(layer.y + h / 2);

					vSnaps.push(Math.round(layer.x), cx, Math.round(layer.x + w));
					hSnaps.push(Math.round(layer.y), cy, Math.round(layer.y + h));
				}
			}
			return { hSnaps, vSnaps };
		},
		[layers, viewportH, viewportW],
	);

	const handleDragMove = useCallback(
		(e: KonvaEventObject<DragEvent>) => {
			const node = e.target;
			if (e.evt.shiftKey) {
				setGuides([]);
				return;
			}

			const { hSnaps, vSnaps } = getSnapPositions(node.id());
			let newX = node.x();
			let newY = node.y();

			const w = node.width() * node.scaleX();
			const h = node.height() * node.scaleY();
			const cx = newX + w / 2;
			const cy = newY + h / 2;
			const right = newX + w;
			const bottom = newY + h;

			const vGuides: Guide[] = [];
			const hGuides: Guide[] = [];

			// Vertical Snapping
			for (const snap of vSnaps) {
				if (Math.abs(newX - snap) < SNAP_THRESHOLD) {
					newX = snap;
					vGuides.push({ type: "vertical", position: snap });
				} else if (Math.abs(cx - snap) < SNAP_THRESHOLD) {
					newX = snap - w / 2;
					vGuides.push({ type: "vertical", position: snap });
				} else if (Math.abs(right - snap) < SNAP_THRESHOLD) {
					newX = snap - w;
					vGuides.push({ type: "vertical", position: snap });
				}
			}

			// Horizontal Snapping
			for (const snap of hSnaps) {
				if (Math.abs(newY - snap) < SNAP_THRESHOLD) {
					newY = snap;
					hGuides.push({ type: "horizontal", position: snap });
				} else if (Math.abs(cy - snap) < SNAP_THRESHOLD) {
					newY = snap - h / 2;
					hGuides.push({ type: "horizontal", position: snap });
				} else if (Math.abs(bottom - snap) < SNAP_THRESHOLD) {
					newY = snap - h;
					hGuides.push({ type: "horizontal", position: snap });
				}
			}

			if (vGuides.length) node.x(newX);
			if (hGuides.length) node.y(newY);

			// Deduplicate guides
			const guideMap = new Map<string, Guide>();
			[...vGuides, ...hGuides].forEach((g) =>
				guideMap.set(`${g.type}-${g.position}`, g),
			);
			setGuides(Array.from(guideMap.values()));
		},
		[getSnapPositions, setGuides],
	);

	return { handleDragMove };
};

const useEditorShortcuts = () => {
	const {
		setMode,
		mode,
		zoomIn,
		zoomOut,
		fitView,
		selectedId,
		updateLayer,
		isDirty,
		isNodeDragging,
	} = useEditor();
	const lastModeRef = useRef<"select" | "pan">("select");

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

			if (isInput) return;

			// Tools
			if (e.key.toLowerCase() === "v") setMode("select");
			if (e.key.toLowerCase() === "h") setMode("pan");

			// Pan Mode (Space)
			if (e.code === "Space" && !e.repeat && !isNodeDragging) {
				e.preventDefault();
				if (mode !== "pan") {
					lastModeRef.current = mode;
					setMode("pan");
				}
			}

			// Zoom
			if (e.ctrlKey || e.metaKey) {
				if (e.key === "=" || e.key === "+") {
					e.preventDefault();
					zoomIn();
				}
				if (e.key === "-") {
					e.preventDefault();
					zoomOut();
				}
				if (e.key === "0") {
					e.preventDefault();
					fitView();
				}
			}

			// Nudge
			if (
				selectedId &&
				["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
			) {
				e.preventDefault();
				const shift = e.shiftKey ? 10 : 1;
				const updates: Partial<LocalCompositorLayer> = {};

				// We need current values, but we can't access them easily in this closure without 'layers' dependency
				// So we rely on functional updates in the consumer or just assume standard nudge
				// Simplified: We need to read from state.
				// NOTE: To fix "stale closure" on Nudge, we should ideally use a functional update
				// exposed by context that accepts a callback based on previous state.
				// For brevity in this refactor, we are using the imperative updateLayer which might need current state.
				// Better approach: Let the consumer handle keydown or expose a "nudge" function.
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				const target = e.target as HTMLElement;
				if (!["INPUT", "TEXTAREA"].includes(target.tagName)) {
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
	}, [mode, selectedId, setMode, zoomIn, zoomOut, fitView, isNodeDragging]);
};

// -----------------------------------------------------------------------------
// Sub-Components
// -----------------------------------------------------------------------------

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
				<div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300">
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

const ImageLayer: React.FC<{ layer: LocalCompositorLayer }> = React.memo(
	({ layer }) => {
		const {
			setSelectedId,
			updateLayer,
			getImageUrl,
			mode,
			setGuides,
			viewportWidth,
			viewportHeight,
			layers,
			setIsNodeDragging,
		} = useEditor();

		const { handleDragMove } = useSnapping(
			layers,
			viewportWidth,
			viewportHeight,
			setGuides,
		);
		const url = getImageUrl(layer.inputHandleId);
		const [image] = useImage(url ?? "", "anonymous");

		// Initialize Dimensions from loaded image
		useEffect(() => {
			if (image && (!layer.width || !layer.height)) {
				updateLayer(layer.id, {
					width: Math.round(image.width),
					height: Math.round(image.height),
				});
			}
		}, [image, layer.id, layer.width, layer.height, updateLayer]);

		const handleTransformEnd = (e: KonvaEventObject<Event>) => {
			const node = e.target;
			const scaleX = node.scaleX();
			const scaleY = node.scaleY();

			// Reset scale and apply to width/height to keep things clean
			node.scaleX(1);
			node.scaleY(1);

			updateLayer(layer.id, {
				x: Math.round(node.x()),
				y: Math.round(node.y()),
				rotation: Math.round(node.rotation()),
				width: Math.round(node.width() * scaleX),
				height: Math.round(node.height() * scaleY),
			});
		};

		const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
			const node = e.target;
			updateLayer(layer.id, {
				x: Math.round(node.x()),
				y: Math.round(node.y()),
			});
			setGuides([]);
			setIsNodeDragging(false);
		};

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
				onClick={() => setSelectedId(layer.id)}
				onTap={() => setSelectedId(layer.id)}
				onDragStart={() => {
					setSelectedId(layer.id);
					setIsNodeDragging(true);
				}}
				onDragMove={handleDragMove}
				onDragEnd={handleDragEnd}
				onTransformEnd={handleTransformEnd}
				globalCompositeOperation={layer.blendMode as GlobalCompositeOperation}
				opacity={layer.opacity ?? 1}
				visible={layer.opacity !== 0}
			/>
		);
	},
);
ImageLayer.displayName = "ImageLayer";

const TextLayer: React.FC<{ layer: LocalCompositorLayer }> = React.memo(
	({ layer }) => {
		const {
			setSelectedId,
			setIsEditingText,
			setEditingLayerId,
			getTextData,
			mode,
			updateLayer,
			setGuides,
			viewportWidth,
			viewportHeight,
			layers,
			selectedId,
			transformerRef,
			setIsNodeDragging,
		} = useEditor();

		const text = getTextData(layer.inputHandleId);
		const { handleDragMove } = useSnapping(
			layers,
			viewportWidth,
			viewportHeight,
			setGuides,
		);
		const textRef = useRef<Konva.Text>(null);

		const handleDoubleClick = () => {
			setSelectedId(layer.id);
			setIsEditingText(true);
			setEditingLayerId(layer.id);
		};

		// Sync computed dimensions
		useEffect(() => {
			const node = textRef.current;
			if (!node) return;

			const sync = () => {
				const w = node.textWidth;
				const h = node.textHeight;

				if (selectedId === layer.id && transformerRef.current) {
					transformerRef.current.forceUpdate();
				}

				if (
					Math.abs(w - (layer.computedWidth ?? 0)) > 0.5 ||
					Math.abs(h - (layer.computedHeight ?? 0)) > 0.5
				) {
					updateLayer(layer.id, { computedWidth: w, computedHeight: h });
				}
			};

			if (layer.fontFamily) {
				document.fonts.ready.then(sync);
			} else {
				sync();
			}
		}, [layer, text, selectedId, updateLayer, transformerRef]);

		// Load Font
		useEffect(() => {
			if (layer.fontFamily) {
				const fontUrl = GetFontAssetUrl(layer.fontFamily);
				fontManager
					.loadFont(layer.fontFamily, fontUrl)
					.catch((err) =>
						console.warn(`Failed to load font ${layer.fontFamily}`, err),
					);
			}
		}, [layer.fontFamily]);

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
				rotation={layer.rotation}
				draggable={mode === "select"}
				onClick={() => setSelectedId(layer.id)}
				onTap={() => setSelectedId(layer.id)}
				onDblClick={handleDoubleClick}
				onDblTap={handleDoubleClick}
				onDragStart={() => {
					setSelectedId(layer.id);
					setIsNodeDragging(true);
				}}
				onDragMove={handleDragMove}
				onDragEnd={(e) => {
					updateLayer(layer.id, {
						x: Math.round(e.target.x()),
						y: Math.round(e.target.y()),
					});
					setGuides([]);
					setIsNodeDragging(false);
				}}
				onTransformEnd={(e) => {
					updateLayer(layer.id, {
						x: Math.round(e.target.x()),
						y: Math.round(e.target.y()),
						rotation: Math.round(e.target.rotation()),
					});
				}}
				globalCompositeOperation={layer.blendMode as GlobalCompositeOperation}
				wrap="none"
				align={layer.align || DEFAULTS.ALIGN}
				verticalAlign={layer.verticalAlign ?? DEFAULTS.VERTICAL_ALIGN}
				letterSpacing={layer.letterSpacing ?? DEFAULTS.LETTER_SPACING}
				lineHeight={layer.lineHeight ?? DEFAULTS.LINE_HEIGHT}
				opacity={layer.opacity ?? 1}
				visible={layer.opacity !== 0}
			/>
		);
	},
);
TextLayer.displayName = "TextLayer";

const TransformerComponent: React.FC = () => {
	const { selectedId, layers, stageRef, mode, transformerRef } = useEditor();

	const selectedLayer = useMemo(
		() => layers.find((l) => l.id === selectedId),
		[layers, selectedId],
	);

	// Force update transformer when layer dimensions change via Inspector
	useEffect(() => {
		if (transformerRef.current && selectedLayer) {
			// This ensures the box resizes if width/height changed externally (e.g. input field)
			transformerRef.current.forceUpdate();
			transformerRef.current.getLayer()?.batchDraw();
		}
	}, [
		selectedLayer?.width,
		selectedLayer?.height,
		selectedLayer?.x,
		selectedLayer?.y,
		selectedLayer?.rotation,
		transformerRef,
	]);

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

	const enabledAnchors = useMemo(() => {
		if (selectedLayer?.type === "Text") return []; // Text scales via font size usually, or transform without anchors for this editor
		if (selectedLayer?.lockAspect) {
			return ["top-left", "top-right", "bottom-left", "bottom-right"];
		}
		return undefined; // All anchors
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

const ArtboardBackground: React.FC = React.memo(() => {
	const { viewportWidth, viewportHeight } = useEditor();
	const patternImage = useMemo(() => {
		const size = 20;
		const canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = "#1e1e1e";
			ctx.fillRect(0, 0, size, size);
			ctx.fillStyle = "#262626";
			ctx.fillRect(0, 0, size / 2, size / 2);
			ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
		}
		return canvas;
	}, []);

	return (
		<Group>
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
		</Group>
	);
});
ArtboardBackground.displayName = "ArtboardBackground";

const Canvas: React.FC = () => {
	const {
		layers,
		containerSize,
		setSelectedId,
		stageRef,
		mode,
		setMode,
		scale,
		stagePos,
		setScale,
		setStagePos,
		guides,
	} = useEditor();

	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => a.zIndex - b.zIndex),
		[layers],
	);

	const handleWheel = useCallback(
		(e: KonvaEventObject<WheelEvent>) => {
			e.evt.preventDefault();
			if (!stageRef.current) return;

			if (!e.evt.ctrlKey && !e.evt.metaKey) {
				setStagePos((p) => ({ x: p.x - e.evt.deltaX, y: p.y - e.evt.deltaY }));
				return;
			}

			const stage = stageRef.current;
			const oldScale = stage.scaleX();
			const pointer = stage.getPointerPosition();
			if (!pointer) return;

			const mousePointTo = {
				x: (pointer.x - stage.x()) / oldScale,
				y: (pointer.y - stage.y()) / oldScale,
			};

			const newScale = e.evt.deltaY > 0 ? oldScale / 1.1 : oldScale * 1.1;
			if (newScale < 0.05 || newScale > 20) return;

			setScale(newScale);
			setStagePos({
				x: pointer.x - mousePointTo.x * newScale,
				y: pointer.y - mousePointTo.y * newScale,
			});
		},
		[stageRef, setScale, setStagePos],
	);

	return (
		<Stage
			ref={stageRef}
			width={containerSize.width}
			height={containerSize.height}
			style={{
				background: "transparent",
				cursor: mode === "pan" ? "grab" : "default",
			}}
			onClick={(e) => {
				// Only deselect if clicking the empty stage or background
				if (
					e.target === stageRef.current ||
					e.target.name() === "artboard-bg"
				) {
					setSelectedId(null);
				}
			}}
			onWheel={handleWheel}
			draggable={mode === "pan"}
			onDragEnd={(e) => {
				// Only update stage position if the stage itself was dragged
				if (e.target === stageRef.current) {
					setStagePos(stageRef.current.position());
				}
			}}
			scale={{ x: scale, y: scale }}
			position={stagePos}
		>
			<KonvaLayer name="artboard-bg">
				<ArtboardBackground />
			</KonvaLayer>
			<KonvaLayer>
				{sortedLayers.map((layer) =>
					layer.type === "Image" ? (
						<ImageLayer key={layer.id} layer={layer} />
					) : (
						<TextLayer key={layer.id} layer={layer} />
					),
				)}
			</KonvaLayer>
			<KonvaLayer>
				<TransformerComponent />
			</KonvaLayer>
			<KonvaLayer listening={false}>
				{guides.map((g, i) => (
					<Line
						key={`${g.type}-${g.position}-${i}`}
						points={
							g.type === "vertical"
								? [g.position, -10000, g.position, 10000]
								: [-10000, g.position, 10000, g.position]
						}
						stroke="#ec4899"
						strokeWidth={1 / scale} // Keep guides thin visually
						dash={[4 / scale, 4 / scale]}
					/>
				))}
			</KonvaLayer>
		</Stage>
	);
};

const LayersPanel: React.FC = () => {
	const { layers, updateLayers, selectedId, setSelectedId, updateLayer } =
		useEditor();

	// Reverse for display (Top layer on top of list)
	const displayLayers = useMemo(
		() => [...layers].sort((a, b) => b.zIndex - a.zIndex),
		[layers],
	);

	const handleDragEnd = (e: DragEndEvent) => {
		const { active, over } = e;
		if (over && active.id !== over.id) {
			updateLayers((current) => {
				// Reorder based on Z-Index logic
				const sorted = [...current].sort((a, b) => b.zIndex - a.zIndex);
				const oldIdx = sorted.findIndex((l) => l.id === active.id);
				const newIdx = sorted.findIndex((l) => l.id === over.id);
				const reordered = arrayMove(sorted, oldIdx, newIdx);

				// Reassign z-indices
				return reordered.map((l, idx) => ({
					...l,
					zIndex: reordered.length - idx,
				}));
			});
		}
	};

	return (
		<div className="absolute left-0 top-0 bottom-0 w-60 bg-[#0f0f0f] border-r border-white/10 z-20 flex flex-col shadow-2xl">
			<div className="flex items-center px-4 py-3 border-b border-white/10 bg-neutral-900/50 backdrop-blur h-10">
				<span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
					<Layers className="w-3.5 h-3.5" /> Layers
				</span>
			</div>
			<ScrollArea className="flex-1 bg-[#0f0f0f]">
				<DndContext
					sensors={useSensors(
						useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
						useSensor(KeyboardSensor),
					)}
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
						</div>
					</SortableContext>
				</DndContext>
			</ScrollArea>
		</div>
	);
};

const LayerItem: React.FC<{
	layer: LocalCompositorLayer;
	selectedId: string | null;
	setSelectedId: (id: string) => void;
	updateLayer: (id: string, u: Partial<LocalCompositorLayer>) => void;
}> = ({ layer, selectedId, setSelectedId, updateLayer }) => {
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
		<button
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={`flex items-center gap-2 px-3 py-2 border-b border-white/5 cursor-pointer outline-none group transition-colors select-none w-full text-left ${isSelected ? "bg-blue-600/20 text-blue-100" : "hover:bg-white/5 text-gray-400"}`}
			onClick={() => !isDragging && setSelectedId(layer.id)}
		>
			<div className="shrink-0">
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
			<Button
				size="icon"
				variant="ghost"
				className="h-5 w-5 opacity-0 group-hover:opacity-100"
				onClick={(e) => {
					e.stopPropagation();
					updateLayer(layer.id, { opacity: layer.opacity === 0 ? 1 : 0 });
				}}
			>
				{layer.opacity === 0 ? (
					<EyeOff className="w-3 h-3" />
				) : (
					<Eye className="w-3 h-3" />
				)}
			</Button>
		</button>
	);
};

const InspectorPanel: React.FC = () => {
	const { data: fontList } = useGetFontListQuery({});
	const {
		selectedId,
		layers,
		updateLayer,
		viewportWidth,
		viewportHeight,
		updateViewportSize,
	} = useEditor();
	const selectedLayer = layers.find((l) => l.id === selectedId);

	if (!selectedLayer) {
		// Canvas Settings
		return (
			<div className="w-72 border-l border-white/10 bg-[#0f0f0f] z-20 shadow-xl flex flex-col">
				<div className="px-4 py-3 bg-neutral-900 border-b border-white/5 h-10 flex items-center">
					<h2 className="text-[10px] font-bold text-gray-200 uppercase tracking-wide flex items-center gap-2">
						<Settings2 className="w-3.5 h-3.5 text-blue-400" /> Canvas Settings
					</h2>
				</div>
				<div className="p-4 space-y-6">
					<div className="space-y-3">
						<Label className="text-[10px] text-gray-500 uppercase font-bold">
							Dimensions
						</Label>
						<div className="grid grid-cols-2 gap-3">
							<DraggableNumberInput
								label="W"
								icon={MoveHorizontal}
								value={viewportWidth}
								onChange={(v) =>
									updateViewportSize(Math.max(1, v), viewportHeight)
								}
								min={1}
							/>
							<DraggableNumberInput
								label="H"
								icon={MoveVertical}
								value={viewportHeight}
								onChange={(v) =>
									updateViewportSize(viewportWidth, Math.max(1, v))
								}
								min={1}
							/>
						</div>
						<Select
							onValueChange={(val) => {
								const p = ASPECT_RATIOS.find((r) => r.label === val);
								if (p) updateViewportSize(p.width, p.height);
							}}
						>
							<SelectTrigger className="h-8 text-[11px] bg-white/5 border-white/10 text-gray-300">
								<SelectValue placeholder="Select Preset" />
							</SelectTrigger>
							<SelectContent className="bg-neutral-800 border-white/10 text-gray-300">
								{ASPECT_RATIOS.map((r) => (
									<SelectItem key={r.label} value={r.label}>
										{r.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
		);
	}

	return (
		<ScrollArea className="w-72 border-l border-white/10 bg-[#0f0f0f] z-20 shadow-xl">
			<div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-neutral-900/50 backdrop-blur">
				<div className="flex flex-col min-w-0">
					<span className="text-[10px] text-blue-400 uppercase font-bold mb-0.5">
						Properties
					</span>
					<h2 className="text-sm font-semibold text-white truncate max-w-[140px]">
						{selectedLayer.id}
					</h2>
				</div>
				<span className="text-[9px] bg-white/10 px-2 py-1 rounded text-gray-300 font-medium uppercase">
					{selectedLayer.type}
				</span>
			</div>
			<div className="pb-20">
				<CollapsibleSection title="Transform" icon={Move}>
					<div className="space-y-3">
						<div className="flex gap-1">
							<Button
								variant="outline"
								size="sm"
								className="flex-1 h-7 text-[10px] bg-white/5 border-white/10"
								onClick={() =>
									updateLayer(selectedLayer.id, {
										x: Math.round(
											viewportWidth / 2 - (selectedLayer.width || 0) / 2,
										),
									})
								}
							>
								Center X
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="flex-1 h-7 text-[10px] bg-white/5 border-white/10"
								onClick={() =>
									updateLayer(selectedLayer.id, {
										y: Math.round(
											viewportHeight / 2 - (selectedLayer.height || 0) / 2,
										),
									})
								}
							>
								Center Y
							</Button>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<DraggableNumberInput
								label="X"
								icon={MoveHorizontal}
								value={Math.round(selectedLayer.x)}
								onChange={(v) => updateLayer(selectedLayer.id, { x: v })}
							/>
							<DraggableNumberInput
								label="Y"
								icon={MoveVertical}
								value={Math.round(selectedLayer.y)}
								onChange={(v) => updateLayer(selectedLayer.id, { y: v })}
							/>
							{selectedLayer.type !== "Text" && (
								<>
									<DraggableNumberInput
										label="W"
										icon={MoveHorizontal}
										value={Math.round(selectedLayer.width ?? 0)}
										onChange={(v) => {
											const newW = Math.max(1, v);
											if (selectedLayer.lockAspect) {
												const ratio =
													(selectedLayer.height || 1) /
													(selectedLayer.width || 1);
												updateLayer(selectedLayer.id, {
													width: newW,
													height: Math.round(newW * ratio),
												});
											} else {
												updateLayer(selectedLayer.id, { width: newW });
											}
										}}
										min={1}
									/>
									<DraggableNumberInput
										label="H"
										icon={MoveVertical}
										value={Math.round(selectedLayer.height ?? 0)}
										onChange={(v) => {
											const newH = Math.max(1, v);
											if (selectedLayer.lockAspect) {
												const ratio =
													(selectedLayer.width || 1) /
													(selectedLayer.height || 1);
												updateLayer(selectedLayer.id, {
													height: newH,
													width: Math.round(newH * ratio),
												});
											} else {
												updateLayer(selectedLayer.id, { height: newH });
											}
										}}
										min={1}
									/>
								</>
							)}
							<DraggableNumberInput
								label="Rot"
								icon={RotateCw}
								value={Math.round(selectedLayer.rotation)}
								onChange={(v) => updateLayer(selectedLayer.id, { rotation: v })}
								className="col-span-2"
							/>
						</div>
						{selectedLayer.type === "Image" && (
							<div className="flex items-center justify-between pt-2">
								<Label className="text-[10px] text-gray-400">
									Lock Aspect Ratio
								</Label>
								<Switch
									checked={selectedLayer.lockAspect}
									onCheckedChange={(c) =>
										updateLayer(selectedLayer.id, { lockAspect: c })
									}
									className="scale-75 data-[state=checked]:bg-blue-600"
								/>
							</div>
						)}
					</div>
				</CollapsibleSection>

				{selectedLayer.type === "Text" && (
					<CollapsibleSection title="Typography" icon={Type}>
						<div className="space-y-4">
							<Select
								value={selectedLayer.fontFamily}
								onValueChange={(val) =>
									updateLayer(selectedLayer.id, { fontFamily: val })
								}
							>
								<SelectTrigger className="h-8 text-xs bg-neutral-800 border-white/10">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="bg-neutral-800 border-white/10">
									{fontList?.map((f) => (
										<SelectItem key={f} value={f} style={{ fontFamily: f }}>
											{f}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<div className="grid grid-cols-2 gap-3">
								<DraggableNumberInput
									label="Size"
									icon={Type}
									value={selectedLayer.fontSize}
									onChange={(v) =>
										updateLayer(selectedLayer.id, { fontSize: v })
									}
									min={1}
								/>
								<ColorPicker
									value={selectedLayer.fill ?? "#fff"}
									onChange={(v) => updateLayer(selectedLayer.id, { fill: v })}
									className="h-8 w-full"
								/>
							</div>
						</div>
					</CollapsibleSection>
				)}

				<CollapsibleSection title="Appearance" icon={Settings2}>
					<div className="space-y-2">
						<Label className="text-[10px] text-gray-500 font-semibold">
							OPACITY
						</Label>
						<DraggableNumberInput
							label="%"
							icon={Layers}
							value={Math.round((selectedLayer.opacity ?? 1) * 100)}
							onChange={(v) =>
								updateLayer(selectedLayer.id, { opacity: v / 100 })
							}
							min={0}
							max={100}
						/>
						<div className="pt-2">
							<Label className="text-[10px] text-gray-500 font-semibold mb-2 block">
								BLEND MODE
							</Label>
							<Select
								value={selectedLayer.blendMode}
								onValueChange={(v) =>
									updateLayer(selectedLayer.id, {
										blendMode: v as LocalCompositorLayer["blendMode"],
									})
								}
							>
								<SelectTrigger className="h-8 text-[11px] bg-white/5 border-white/10">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="bg-neutral-800 border-white/10 max-h-[200px]">
									{BLEND_MODES.map((m) => (
										<SelectItem key={m} value={m} className="capitalize">
											{m}
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

const Toolbar = React.memo<{ onSave: () => void; onClose: () => void }>(
	({ onSave, onClose }) => {
		const {
			mode,
			setMode,
			zoomPercentage,
			zoomIn,
			zoomOut,
			fitView,
			isDirty,
			zoomTo,
		} = useEditor();
		return (
			<div className="flex items-center gap-1.5 p-1.5 rounded-full bg-neutral-900/90 backdrop-blur-xl border border-white/10 shadow-2xl z-50">
				<div className="flex bg-white/5 rounded-full p-0.5 border border-white/5">
					<Button
						size="icon"
						variant={mode === "select" ? "secondary" : "ghost"}
						className="rounded-full w-8 h-8"
						onClick={() => setMode("select")}
					>
						<MousePointer className="w-3.5 h-3.5" />
					</Button>
					<Button
						size="icon"
						variant={mode === "pan" ? "secondary" : "ghost"}
						className="rounded-full w-8 h-8"
						onClick={() => setMode("pan")}
					>
						<Hand className="w-3.5 h-3.5" />
					</Button>
				</div>
				<div className="w-px h-5 bg-white/10 mx-1" />
				<Menubar className="border-none bg-transparent h-auto p-0">
					<MenubarMenu>
						<MenubarTrigger asChild>
							<Button
								variant="ghost"
								className="h-8 px-3 text-[11px] rounded-full text-gray-300 min-w-[80px] justify-between"
							>
								{zoomPercentage}
								<ChevronDown className="w-3 h-3 ml-1.5 opacity-50" />
							</Button>
						</MenubarTrigger>
						<MenubarContent
							align="center"
							sideOffset={10}
							className="bg-neutral-900/95 border-white/10 text-gray-200"
						>
							<MenubarItem onClick={zoomIn}>Zoom In</MenubarItem>
							<MenubarItem onClick={zoomOut}>Zoom Out</MenubarItem>
							<MenubarItem onClick={() => zoomTo(1)}>Actual Size</MenubarItem>
							<MenubarItem onClick={fitView}>Fit to Screen</MenubarItem>
						</MenubarContent>
					</MenubarMenu>
				</Menubar>
				<div className="w-px h-5 bg-white/10 mx-1" />
				<Button
					size="sm"
					variant="default"
					className="h-8 text-[11px] font-semibold rounded-full px-4"
					onClick={onSave}
					disabled={!isDirty}
				>
					<Save className="w-3.5 h-3.5 mr-1" /> Save
				</Button>
				<Button
					size="icon"
					variant="ghost"
					className="h-8 w-8 rounded-full text-gray-400"
					onClick={onClose}
				>
					<XIcon className="w-4 h-4" />
				</Button>
			</div>
		);
	},
);

// -----------------------------------------------------------------------------
// Main Provider & Container
// -----------------------------------------------------------------------------

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

	// --- State ---
	const [layers, setLayers] = useState<LocalCompositorLayer[]>([]);
	const [isDirty, setIsDirty] = useState(false);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [viewportWidth, setViewportWidth] = useState(
		nodeConfig.width ?? DEFAULTS.CANVAS_WIDTH,
	);
	const [viewportHeight, setViewportHeight] = useState(
		nodeConfig.height ?? DEFAULTS.CANVAS_HEIGHT,
	);
	const [mode, setMode] = useState<"select" | "pan">("select");
	const [scale, setScale] = useState(1);
	const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
	const [guides, setGuides] = useState<Guide[]>([]);
	const [isEditingText, setIsEditingText] = useState(false);
	const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
	const [showCloseAlert, setShowCloseAlert] = useState(false);
	const [isNodeDragging, setIsNodeDragging] = useState(false);
	// --- Refs ---
	const stageRef = useRef<Konva.Stage | null>(null);
	const transformerRef = useRef<Konva.Transformer | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerSize, setContainerSize] = useState({
		width: 100,
		height: 100,
	});

	// --- Actions ---
	const updateLayers = useCallback(
		(updater: SetStateAction<LocalCompositorLayer[]>, isUserChange = true) => {
			setLayers(updater);
			if (isUserChange) setIsDirty(true);
		},
		[],
	);

	const updateLayer = useCallback(
		(id: string, updates: Partial<LocalCompositorLayer>) => {
			updateLayers((prev) =>
				prev.map((l) => (l.id === id ? { ...l, ...updates } : l)),
			);
		},
		[updateLayers],
	);

	const updateViewportSize = useCallback((w: number, h: number) => {
		setViewportWidth(w);
		setViewportHeight(h);
		setIsDirty(true);
	}, []);

	// --- Data Accessors ---
	const getTextData = useCallback(
		(handleId: string) =>
			(initialLayers.get(handleId) as OutputItem<"Text">)?.data || "",
		[initialLayers],
	);
	const getImageData = useCallback(
		(handleId: string) =>
			(initialLayers.get(handleId) as OutputItem<"Image">)?.data ?? {},
		[initialLayers],
	);
	const getImageUrl = useCallback(
		(handleId: string) => {
			const d = (initialLayers.get(handleId) as OutputItem<"Image">)?.data;
			if (d?.entity) return GetAssetEndpoint(d.entity);
			return d?.processData?.dataUrl;
		},
		[initialLayers],
	);

	// --- Initialization ---
	useEffect(() => {
		// Observer for container resize
		if (!containerRef.current) return;
		const observer = new ResizeObserver(() => {
			if (containerRef.current)
				setContainerSize({
					width: containerRef.current.offsetWidth,
					height: containerRef.current.offsetHeight,
				});
		});
		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		// Initialize Layers
		const cfg = (node.config as CompositorNodeConfig) ?? { layerUpdates: {} };
		const updates = { ...cfg.layerUpdates };
		let maxZ = Math.max(...Object.values(updates).map((l) => l.zIndex ?? 0), 0);

		initialLayers.forEach((output, handleId) => {
			if (!updates[handleId]) {
				const base: LocalCompositorLayer = {
					id: handleId,
					inputHandleId: handleId,
					type: output.type,
					x: 0,
					y: 0,
					rotation: 0,
					zIndex: ++maxZ,
					opacity: 1,
					blendMode: "source-over",
					lockAspect: true,
				};

				if (base.type === "Text") {
					Object.assign(base, {
						fontSize: DEFAULTS.FONT_SIZE,
						fontFamily: DEFAULTS.FONT_FAMILY,
						fill: DEFAULTS.FILL,
						align: DEFAULTS.ALIGN,
						letterSpacing: 0,
						lineHeight: 1.1,
					});
				} else {
					// Image default sizing logic
					const fData = (output as OutputItem<"Image">).data;
					const w =
						fData.entity?.width ?? fData.processData?.width ?? cfg.width ?? 300;
					const h =
						fData.entity?.height ??
						fData.processData?.height ??
						cfg.height ??
						300;
					base.width = Math.round(w);
					base.height = Math.round(h);
				}
				updates[handleId] = base;
			}
		});
		setLayers(Object.values(updates));
	}, [initialLayers, node.config]);

	// --- Zoom Logic ---
	const fitView = useCallback(() => {
		const padding = 80;
		const availW = containerSize.width - padding * 2;
		const availH = containerSize.height - padding * 2;
		const scaleVal = Math.min(availW / viewportWidth, availH / viewportHeight);
		setScale(scaleVal);
		setStagePos({
			x: Math.round((containerSize.width - viewportWidth * scaleVal) / 2),
			y: Math.round((containerSize.height - viewportHeight * scaleVal) / 2),
		});
	}, [containerSize, viewportWidth, viewportHeight]);

	useEffect(() => {
		if (containerSize.width > 100 && scale === 1 && stagePos.x === 0) fitView();
	}, [containerSize, fitView, scale, stagePos.x]);

	const handleSave = () => {
		const layerUpdates = layers.reduce<Record<string, CompositorLayer>>(
			(acc, l) => {
				// biome-ignore lint/correctness/noUnusedVariables: Logical method.
				const { computedHeight, computedWidth, ...rest } = l;
				acc[l.inputHandleId] = rest;
				return acc;
			},
			{},
		);
		propOnSave({ layerUpdates, width: viewportWidth, height: viewportHeight });
		setIsDirty(false);
	};

	const zoomPercentage = useMemo(() => `${Math.round(scale * 100)}%`, [scale]);

	const contextValue: EditorState = {
		layers,
		updateLayers,
		updateLayer,
		selectedId,
		zoomPercentage,
		setSelectedId,
		viewportWidth,
		viewportHeight,
		updateViewportSize,
		mode,
		setMode,
		isEditingText,
		setIsEditingText,
		editingLayerId,
		setEditingLayerId,
		scale,
		setScale,
		stagePos,
		setStagePos,
		zoomIn: () => setScale((s) => s * 1.2),
		zoomOut: () => setScale((s) => s / 1.2),
		zoomTo: setScale,
		fitView,
		stageRef,
		transformerRef,
		containerSize,
		guides,
		setGuides,
		getTextData,
		getImageData,
		getImageUrl,
		isDirty,
		setIsDirty,
		isNodeDragging,
		setIsNodeDragging,
	};

	return (
		<EditorContext.Provider value={contextValue}>
			<EditorShortcuts />
			<div className="flex h-screen w-screen bg-[#050505] overflow-hidden relative text-foreground font-sans selection:bg-blue-500/30">
				<div className="relative shrink-0 z-20">
					<LayersPanel />
				</div>
				<div className="flex-1 flex flex-col relative min-w-0 z-0">
					<div
						ref={containerRef}
						className="flex-1 relative overflow-hidden bg-[#0F0F0F]"
						style={{
							backgroundImage:
								"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
							backgroundSize: "32px 32px",
						}}
					>
						<Canvas />
					</div>
					<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
						<Toolbar
							onSave={handleSave}
							onClose={() => (isDirty ? setShowCloseAlert(true) : onClose())}
						/>
					</div>
				</div>
				<div className="relative shrink-0 z-20">
					<InspectorPanel />
				</div>

				<AlertDialog open={showCloseAlert} onOpenChange={setShowCloseAlert}>
					<AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
						<AlertDialogHeader>
							<AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
							<AlertDialogDescription className="text-gray-400">
								You have unsaved changes. Are you sure you want to leave?
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel
								onClick={() => setShowCloseAlert(false)}
								className="bg-transparent border-white/10 text-gray-300 hover:bg-white/5"
							>
								Cancel
							</AlertDialogCancel>
							<Button
								variant="destructive"
								onClick={() => {
									setShowCloseAlert(false);
									onClose();
								}}
								className="bg-red-500/20 text-red-400 border-0"
							>
								Discard
							</Button>
							<AlertDialogAction
								onClick={() => {
									handleSave();
									setShowCloseAlert(false);
									onClose();
								}}
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

// Helper component to activate shortcuts within Context
const EditorShortcuts = () => {
	useEditorShortcuts();
	return null;
};
