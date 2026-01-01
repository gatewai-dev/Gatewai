import type {
	CompositorLayer,
	CompositorNodeConfig,
	CompositorResult,
	FileData,
	OutputItem,
} from "@gatewai/types";
import type Konva from "konva";
import { ImageIcon, TextIcon } from "lucide-react";
import type React from "react";
import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	Image as KonvaImage,
	Layer as KonvaLayer,
	Text as KonvaText,
	Line,
	Stage,
	Transformer,
} from "react-konva";
import useImage from "use-image";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
	viewportWidth: number;
	viewportHeight: number;
	setViewportWidth: (w: number) => void;
	setViewportHeight: (h: number) => void;
	guides: Guide[];
	setGuides: Dispatch<SetStateAction<Guide[]>>;
	isEditingText: boolean;
	setIsEditingText: (editing: boolean) => void;
	editingLayerId: string | null;
	setEditingLayerId: (id: string | null) => void;
	stageRef: React.RefObject<Konva.Stage | null>;

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
	const SNAP_THRESHOLD = 3;

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
			setGuides([...vGuides, ...hGuides]);
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
	onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
	onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
	onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
}

// Image Layer Component
const ImageLayer: React.FC<LayerProps> = ({
	layer,
	onDragMove,
	onDragEnd,
	onTransformEnd,
}) => {
	const { setSelectedId, setLayers, getImageUrl } = useEditor();
	const url = getImageUrl(layer.inputHandleId);
	const [image] = useImage(url, "anonymous");

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
			draggable
			onClick={handleSelect}
			onTap={handleSelect}
			onDragMove={onDragMove}
			onDragEnd={onDragEnd}
			onTransformEnd={onTransformEnd}
			globalCompositeOperation={layer.blendMode as GlobalCompositeOperation}
		/>
	);
};

// Text Layer Component
const TextLayer: React.FC<
	LayerProps & { layer: CompositorLayer & { type: "Text" } }
> = ({ layer, onDragMove, onDragEnd, onTransformEnd }) => {
	const { setSelectedId, setIsEditingText, setEditingLayerId, getTextData } =
		useEditor();

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
			draggable
			onClick={handleSelect}
			onTap={handleSelect}
			onDblClick={handleDoubleClick}
			onDblTap={handleDoubleClick}
			onDragMove={onDragMove}
			onDragEnd={onDragEnd}
			onTransformEnd={onTransformEnd}
			globalCompositeOperation={layer.blendMode as GlobalCompositeOperation}
		/>
	);
};

// Transformer component
const TransformerComponent: React.FC = () => {
	const { selectedId, layers, stageRef } = useEditor();
	const trRef = useRef<Konva.Transformer>(null);

	useEffect(() => {
		if (selectedId && trRef.current && stageRef.current) {
			const node = stageRef.current.findOne(`#${selectedId}`);
			if (node) {
				trRef.current.nodes([node]);
				trRef.current.getLayer()?.batchDraw();
			}
		}
	}, [selectedId, stageRef]);

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
			{guides.map((guide) => (
				<Line
					key={guide.type + guide.position}
					points={
						guide.type === "vertical"
							? [guide.position, 0, guide.position, viewportHeight]
							: [0, guide.position, viewportWidth, guide.position]
					}
					stroke="#888888"
					strokeWidth={1}
					dash={[4, 4]}
				/>
			))}
		</>
	);
};

const Canvas: React.FC = () => {
	const { layers, viewportWidth, viewportHeight, setSelectedId, stageRef } =
		useEditor();
	const { handleDragMove, handleDragEnd, handleTransformEnd } = useSnap();

	const handleStageClick = useCallback(
		(e: Konva.KonvaEventObject<TouchEvent | MouseEvent>) => {
			if (e.target === stageRef.current) {
				setSelectedId(null);
			}
		},
		[stageRef, setSelectedId],
	);

	return (
		<div style={{ position: "relative" }}>
			<Stage
				ref={stageRef}
				width={viewportWidth}
				height={viewportHeight}
				style={{ background: "transparent", cursor: "crosshair" }}
				onClick={handleStageClick}
				onTap={handleStageClick}
			>
				<KonvaLayer>
					{/* Background rect if needed, but transparent */}
				</KonvaLayer>
				<KonvaLayer>
					{layers.map((layer) => {
						if (layer.type === "Image") {
							return (
								<ImageLayer
									key={layer.id}
									layer={layer}
									onDragMove={handleDragMove}
									onDragEnd={handleDragEnd}
									onTransformEnd={handleTransformEnd}
								/>
							);
						}
						if (layer.type === "Text") {
							return (
								<TextLayer
									key={layer.id}
									layer={layer}
									onDragMove={handleDragMove}
									onDragEnd={handleDragEnd}
									onTransformEnd={handleTransformEnd}
								/>
							);
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
		</div>
	);
};

// Layers Panel (Left sidebar like Figma)
const LayersPanel: React.FC = () => {
	const { layers, setSelectedId, selectedId } = useEditor();
	return (
		<div className="absolute left-0 top-0 bottom-0 w-56 overflow-y-auto bg-background p-2 border border-gray-700 z-10 text-xs">
			<h3 className="mb-4 text-xl font-bold text-gray-100">Layers</h3>
			<ul className="space-y-2">
				{layers.map((layer) => (
					<li
						key={layer.id}
						onClick={() => setSelectedId(layer.id)}
						onKeyUp={(e) => {
							if (e.key === "Enter") {
								setSelectedId(layer.id);
							}
						}}
						tabIndex={0}
						role="button"
						className={`cursor-pointer flex items-center gap-2 p-2 transition-colors duration-200 hover:bg-gray-800 ${
							layer.id === selectedId ? "bg-gray-800" : ""
						}`}
					>
						{layer.type === "Image" ? (
							<ImageIcon className="size-4" />
						) : (
							<TextIcon className="size-4" />
						)}{" "}
						{layer.type.charAt(0).toUpperCase() + layer.type.slice(1)} -{" "}
						{layer.id.slice(0, 6)}
					</li>
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

	return (
		<div className="absolute right-0 top-0 bottom-0 w-56 overflow-y-auto bg-background p-4 border border-gray-700 z-10 text-gray-200">
			<h3 className="mb-4 text-xl font-bold text-gray-100">Inspector</h3>
			<div className="space-y-4">
				<div className="flex flex-col gap-1">
					<Label htmlFor="canvas-width">Canvas Width:</Label>
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
				<div className="flex flex-col gap-1">
					<Label htmlFor="canvas-height">Canvas Height:</Label>
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
				{selectedLayer && (
					<>
						<hr className="my-4 border-gray-600" />
						<h4 className="mb-2 text-lg font-semibold text-gray-100">
							Layer Properties
						</h4>
						<div className="flex flex-col gap-1">
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
						<div className="flex flex-col gap-1">
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
						<div className="flex flex-col gap-1">
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
							<div className="flex flex-col gap-1">
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
}

export const CanvasDesignerEditor: React.FC<CanvasDesignerEditorProps> = ({
	initialLayers,
	node,
}) => {
	const [layers, setLayers] = useState<CompositorLayer[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [viewportWidth, setViewportWidth] = useState(800);
	const [viewportHeight, setViewportHeight] = useState(600);
	const [guides, setGuides] = useState<Guide[]>([]);
	const [isEditingText, setIsEditingText] = useState(false);
	const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
	const stageRef = useRef<Konva.Stage | null>(null);

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
		// Note: In a full implementation, update node.config with layerUpdates on changes
	}, [initialLayers, node.config, getImageData]);

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
				guides,
				setGuides,
				isEditingText,
				setIsEditingText,
				editingLayerId,
				setEditingLayerId,
				stageRef,
				getTextData,
				getImageData,
				getImageUrl,
			}}
		>
			<div className="flex justify-center items-center h-screen w-screen bg-background overflow-hidden relative">
				<LayersPanel />
				<div
					className="relative border border-gray-700 overflow-hidden"
					style={{
						width: viewportWidth,
						height: viewportHeight,
					}}
				>
					<div
						className="absolute inset-0 checkered-background"
						style={{
							backgroundImage: `
								linear-gradient(45deg, #333333 25%, #222222 25%, #222222 75%, #333333 75%),
								linear-gradient(45deg, #333333 25%, #222222 25%, #222222 75%, #333333 75%)
							`,
							backgroundSize: "40px 40px",
							backgroundPosition: "0 0, 20px 20px",
						}}
					/>
					<Canvas />
				</div>
				<InspectorPanel />
			</div>
		</EditorContext.Provider>
	);
};
