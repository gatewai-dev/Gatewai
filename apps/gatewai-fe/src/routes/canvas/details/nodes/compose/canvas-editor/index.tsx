import type { DataType, FileAsset } from "@gatewai/db"; // Assuming this is available
import type {
	CompositorResult,
	DataForType,
	FileData,
	OutputItem,
} from "@gatewai/types"; // Assuming the provided types are in a separate file, imported as needed
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
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
import WebFont from "webfontloader";
import { generateId } from "@/lib/idgen";
import { BLEND_MODES } from "@/routes/canvas/blend-modes";

// Internal Layer type, extending OutputItem with transform properties
interface InternalLayer {
	id: string;
	type: "text" | "image";
	output: OutputItem<DataType>; // Original output item
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	scaleX: number;
	scaleY: number;
	fontFamily?: string; // For text
	fontSize?: number; // For text
	fill?: string; // For text color
	lockAspect?: boolean; // For images, default true
	blendingMode: string; // Blending mode, default 'source-over'
}

// Editor Context
interface EditorContextType {
	layers: InternalLayer[];
	setLayers: Dispatch<SetStateAction<InternalLayer[]>>;
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
	stageRef: React.RefObject<Konva.Stage>;
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

// Font loading hook
const useFontLoader = (fontFamilies: string[]) => {
	useEffect(() => {
		if (fontFamilies.length > 0) {
			WebFont.load({
				google: {
					families: fontFamilies,
				},
				active: () => console.log("Fonts loaded"),
				inactive: () => console.error("Fonts failed to load"),
			});
		}
	}, [fontFamilies]);
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
				if (layer.id !== excludeId) {
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
		(e: Konva.KonvaEventObject<"dragmove">) => {
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
		(e: Konva.KonvaEventObject<"dragend">) => {
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
		(e: Konva.KonvaEventObject<"transformend">) => {
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
const blendingModes = BLEND_MODES;

// Layer Props
interface LayerProps {
	layer: InternalLayer;
	onDragMove: (e: Konva.KonvaEventObject<"dragmove">) => void;
	onDragEnd: (e: Konva.KonvaEventObject<"dragend">) => void;
	onTransformEnd: (e: Konva.KonvaEventObject<"transformend">) => void;
}

// Image Layer Component
const ImageLayer: React.FC<
	LayerProps & { layer: InternalLayer & { type: "image" } }
> = ({ layer, onDragMove, onDragEnd, onTransformEnd }) => {
	const { setSelectedId, setLayers } = useEditor();
	const url =
		typeof layer.output.data === "object" && "dataUrl" in layer.output.data
			? (layer.output.data as { dataUrl: string }).dataUrl
			: (layer.output.data as FileData).entity?.signedUrl || "";
	const [image] = useImage(url, "anonymous");

	useEffect(() => {
		if (image && (layer.width === 200 || layer.height === 200)) {
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
			globalCompositeOperation={layer.blendingMode as GlobalCompositeOperation}
		/>
	);
};

// Text Layer Component
const TextLayer: React.FC<
	LayerProps & { layer: InternalLayer & { type: "text" } }
> = ({ layer, onDragMove, onDragEnd, onTransformEnd }) => {
	const { setSelectedId, setIsEditingText, setEditingLayerId } = useEditor();

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
			text={layer.output.data as string}
			fontSize={layer.fontSize || 24}
			fontFamily={layer.fontFamily || "Arial"}
			fill={layer.fill || "black"}
			width={layer.width}
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
			globalCompositeOperation={layer.blendingMode as GlobalCompositeOperation}
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

	const handleTransform = useCallback(
		(e: Konva.KonvaEventObject<"transform">) => {
			const node = e.target;
			const layer = layers.find((l) => l.id === node.id());
			if (
				layer &&
				layer.type === "image" &&
				layer.lockAspect &&
				!(e.evt as MouseEvent).shiftKey
			) {
				// Maintain aspect ratio
				const scaleX = node.scaleX();
				const scaleY = node.scaleY();
				const uniformScale = Math.max(scaleX, scaleY);
				node.scaleX(uniformScale);
				node.scaleY(uniformScale);
			}
		},
		[layers],
	);

	return (
		<Transformer
			ref={trRef}
			rotateEnabled
			flipEnabled={false}
			boundBoxFunc={(oldBox, newBox) => {
				if (newBox.width < 5 || newBox.height < 5) {
					return oldBox;
				}
				return newBox;
			}}
			onTransform={handleTransform}
		/>
	);
};

// Text Editor Overlay
const TextEditor: React.FC<{ layer: InternalLayer & { type: "text" } }> = ({
	layer,
}) => {
	const { setLayers, setIsEditingText, setEditingLayerId, stageRef } =
		useEditor();
	const [text, setText] = useState(layer.output.data as string);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.focus();
			textarea.style.width = `${layer.width * layer.scaleX}px`;
			textarea.style.height = `${layer.height * layer.scaleY}px`;
			textarea.style.fontSize = `${(layer.fontSize || 24) * Math.min(layer.scaleX, layer.scaleY)}px`;
			textarea.style.fontFamily = layer.fontFamily || "Arial";
			textarea.style.color = layer.fill || "black";
			// Position based on stage coords
			const absPos = stageRef.current?.getAbsolutePosition() || { x: 0, y: 0 };
			textarea.style.left = `${layer.x + absPos.x}px`;
			textarea.style.top = `${layer.y + absPos.y}px`;
			textarea.style.transform = `rotate(${layer.rotation}deg) scale(${layer.scaleX}, ${layer.scaleY})`;
			textarea.style.transformOrigin = "top left";
		}
	}, [layer, stageRef]);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setText(e.target.value);
	};

	const handleBlur = () => {
		setLayers((prev) =>
			prev.map((l) =>
				l.id === layer.id ? { ...l, output: { ...l.output, data: text } } : l,
			),
		);
		setIsEditingText(false);
		setEditingLayerId(null);
	};

	return (
		<textarea
			ref={textareaRef}
			value={text}
			onChange={handleChange}
			onBlur={handleBlur}
			style={{
				position: "absolute",
				border: "none",
				outline: "none",
				resize: "none",
				overflow: "hidden",
				background: "transparent",
				lineHeight: 1.2,
			}}
		/>
	);
};

// Guides Component
const Guides: React.FC = () => {
	const { guides, viewportWidth, viewportHeight } = useEditor();
	return (
		<>
			{guides.map((guide, i) => (
				<Line
					key={i}
					points={
						guide.type === "vertical"
							? [guide.position, 0, guide.position, viewportHeight]
							: [0, guide.position, viewportWidth, guide.position]
					}
					stroke="blue"
					strokeWidth={1}
					dash={[4, 4]}
				/>
			))}
		</>
	);
};

// Main Canvas
const Canvas: React.FC = () => {
	const {
		layers,
		viewportWidth,
		viewportHeight,
		isEditingText,
		editingLayerId,
		stageRef,
	} = useEditor();
	const { handleDragMove, handleDragEnd, handleTransformEnd } = useSnap();

	const editingLayer = layers.find((l) => l.id === editingLayerId) as
		| (InternalLayer & { type: "text" })
		| undefined;

	const handleStageClick = useCallback(
		(e: Konva.KonvaEventObject<"click">) => {
			if (e.target === stageRef.current) {
				useEditor().setSelectedId(null);
			}
		},
		[stageRef],
	);

	return (
		<div style={{ position: "relative" }}>
			<Stage
				ref={stageRef}
				width={viewportWidth}
				height={viewportHeight}
				style={{ background: "transparent" }}
				onClick={handleStageClick}
				onTap={handleStageClick}
			>
				<KonvaLayer>
					{/* Background rect if needed, but transparent */}
				</KonvaLayer>
				<KonvaLayer>
					{layers.map((layer) => {
						if (layer.type === "image") {
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
						if (layer.type === "text") {
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
			{isEditingText && editingLayer && <TextEditor layer={editingLayer} />}
		</div>
	);
};

// Viewport Controls
const ViewportControls: React.FC = () => {
	const { viewportWidth, setViewportWidth, viewportHeight, setViewportHeight } =
		useEditor();
	return (
		<div style={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}>
			<input
				type="number"
				value={viewportWidth}
				onChange={(e) => setViewportWidth(parseInt(e.target.value, 10) || 800)}
				placeholder="Width"
				style={{ marginRight: "8px" }}
			/>
			<input
				type="number"
				value={viewportHeight}
				onChange={(e) => setViewportHeight(parseInt(e.target.value, 10) || 600)}
				placeholder="Height"
			/>
		</div>
	);
};

// Layers Panel (Left sidebar like Figma)
const LayersPanel: React.FC = () => {
	const { layers, setSelectedId } = useEditor();
	return (
		<div
			style={{
				width: 200,
				height: "100vh",
				overflowY: "auto",
				background: "#f0f0f0",
				position: "absolute",
				left: 0,
				top: 0,
				padding: "16px",
				boxSizing: "border-box",
			}}
		>
			<h3 style={{ marginBottom: "8px" }}>Layers</h3>
			<ul style={{ listStyle: "none", padding: 0 }}>
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
						style={{
							cursor: "pointer",
							padding: "4px",
							background:
								layer.id === useEditor().selectedId ? "#ddd" : "transparent",
						}}
					>
						{layer.type.charAt(0).toUpperCase() + layer.type.slice(1)} -{" "}
						{layer.id.slice(0, 6)}
					</li>
				))}
			</ul>
		</div>
	);
};

// Properties Panel (Right sidebar like Figma)
const PropertiesPanel: React.FC = () => {
	const { selectedId, layers, setLayers } = useEditor();
	const selectedLayer = layers.find((l) => l.id === selectedId);

	if (!selectedLayer) return null;

	const updateLayer = (updates: Partial<InternalLayer>) => {
		setLayers((prev) =>
			prev.map((l) => (l.id === selectedId ? { ...l, ...updates } : l)),
		);
	};

	return (
		<div
			style={{
				width: 200,
				height: "100vh",
				overflowY: "auto",
				background: "#f0f0f0",
				position: "absolute",
				right: 0,
				top: 0,
				padding: "16px",
				boxSizing: "border-box",
			}}
		>
			<h3 style={{ marginBottom: "8px" }}>Properties</h3>
			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				<label>
					X:{" "}
					<input
						type="number"
						value={selectedLayer.x}
						onChange={(e) =>
							updateLayer({ x: parseFloat(e.target.value) || 0 })
						}
					/>
				</label>
				<label>
					Y:{" "}
					<input
						type="number"
						value={selectedLayer.y}
						onChange={(e) =>
							updateLayer({ y: parseFloat(e.target.value) || 0 })
						}
					/>
				</label>
				<label>
					Width:{" "}
					<input
						type="number"
						value={selectedLayer.width * selectedLayer.scaleX}
						onChange={(e) => {
							const newWidth =
								parseFloat(e.target.value) || selectedLayer.width;
							updateLayer({ scaleX: newWidth / selectedLayer.width });
						}}
					/>
				</label>
				<label>
					Height:{" "}
					<input
						type="number"
						value={selectedLayer.height * selectedLayer.scaleY}
						onChange={(e) => {
							const newHeight =
								parseFloat(e.target.value) || selectedLayer.height;
							updateLayer({ scaleY: newHeight / selectedLayer.height });
						}}
					/>
				</label>
				<label>
					Rotation:{" "}
					<input
						type="number"
						value={selectedLayer.rotation}
						onChange={(e) =>
							updateLayer({ rotation: parseFloat(e.target.value) || 0 })
						}
					/>
				</label>
				<label>
					Blending Mode:{" "}
					<select
						value={selectedLayer.blendingMode}
						onChange={(e) => updateLayer({ blendingMode: e.target.value })}
					>
						{blendingModes.map((mode) => (
							<option key={mode} value={mode}>
								{mode}
							</option>
						))}
					</select>
				</label>
				{selectedLayer.type === "text" && (
					<>
						<label>
							Font Size:{" "}
							<input
								type="number"
								value={selectedLayer.fontSize}
								onChange={(e) =>
									updateLayer({ fontSize: parseFloat(e.target.value) || 24 })
								}
							/>
						</label>
						<label>
							Font Family:{" "}
							<input
								value={selectedLayer.fontFamily}
								onChange={(e) => updateLayer({ fontFamily: e.target.value })}
							/>
						</label>
						<label>
							Color:{" "}
							<input
								type="color"
								value={selectedLayer.fill}
								onChange={(e) => updateLayer({ fill: e.target.value })}
							/>
						</label>
					</>
				)}
				{selectedLayer.type === "image" && (
					<label>
						Lock Aspect:{" "}
						<input
							type="checkbox"
							checked={selectedLayer.lockAspect ?? true}
							onChange={(e) => updateLayer({ lockAspect: e.target.checked })}
						/>
					</label>
				)}
			</div>
		</div>
	);
};

// Main Editor Component
interface CanvasDesignerEditorProps {
	initialLayers: OutputItem<DataType>[];
	onSave: (result: CompositorResult) => void;
}

export const CanvasDesignerEditor: React.FC<CanvasDesignerEditorProps> = ({
	initialLayers,
	onSave,
}) => {
	const [layers, setLayers] = useState<InternalLayer[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [viewportWidth, setViewportWidth] = useState(800);
	const [viewportHeight, setViewportHeight] = useState(600);
	const [guides, setGuides] = useState<Guide[]>([]);
	const [isEditingText, setIsEditingText] = useState(false);
	const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const stageRef = useRef<Konva.Stage>(null);

	// Load initial layers
	useEffect(() => {
		const newLayers: InternalLayer[] = initialLayers
			.map((item, index) => {
				const id = generateId();
				const defaultX = 100 + index * 20;
				const defaultY = 100 + index * 20;
				if (item.type === "Text") {
					return {
						id,
						type: "text",
						output: item,
						x: defaultX,
						y: defaultY,
						width: 200,
						height: 50,
						rotation: 0,
						scaleX: 1,
						scaleY: 1,
						fontFamily: "Arial",
						fontSize: 24,
						fill: "black",
						blendingMode: "source-over",
					};
				} else if (item.type === "Image") {
					const fileData = item.data as FileData;
					const width = fileData.entity?.width || 200;
					const height = fileData.entity?.height || 200;
					return {
						id,
						type: "image",
						output: item,
						x: defaultX,
						y: defaultY,
						width,
						height,
						rotation: 0,
						scaleX: 1,
						scaleY: 1,
						lockAspect: true,
						blendingMode: "source-over",
					};
				}
				// Ignore other types for now
				return null;
			})
			.filter((layer): layer is InternalLayer => layer !== null);
		setLayers(newLayers);
	}, [initialLayers]);

	// Compute unique fonts from current layers and load them
	const fonts = Array.from(
		new Set(
			layers
				.filter((l) => l.type === "text")
				.map((l) => l.fontFamily || "Arial"),
		),
	);
	useFontLoader(fonts);

	// Handle saving with proper render cycle
	useEffect(() => {
		if (isSaving && stageRef.current) {
			const dataUrl = stageRef.current.toDataURL({
				mimeType: "image/png",
				pixelRatio: 2, // Higher quality
			});
			const fileData: FileData = { dataUrl: dataUrl ?? "" };
			const outputItem: OutputItem<"Image"> = {
				type: "Image",
				data: fileData,
				outputHandleId: "compositor_output",
			};
			const result: CompositorResult = {
				selectedOutputIndex: 0,
				outputs: [{ items: [outputItem] }],
			};
			onSave(result);
			setIsSaving(false);
		}
	}, [isSaving, onSave]);

	const handleSave = () => {
		// Hide guides and transformer for clean export
		setGuides([]);
		setSelectedId(null);
		setIsSaving(true);
	};

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
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					height: "100vh",
					position: "relative",
					overflow: "hidden",
				}}
			>
				<LayersPanel />
				<div
					className="checkered-background"
					style={{
						width: viewportWidth,
						height: viewportHeight,
						backgroundImage: `
              linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%),
              linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)
            `,
						backgroundSize: "20px 20px",
						backgroundPosition: "0 0, 10px 10px",
						position: "relative",
					}}
				>
					<Canvas />
				</div>
				<PropertiesPanel />
				<ViewportControls />
				<button
					onClick={handleSave}
					style={{ position: "absolute", bottom: 10, zIndex: 10 }}
				>
					Save
				</button>
			</div>
		</EditorContext.Provider>
	);
};
