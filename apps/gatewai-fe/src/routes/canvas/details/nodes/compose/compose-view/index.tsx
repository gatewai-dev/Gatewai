import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Stage } from "react-konva";
import useImage from "use-image";
import { Button } from "@/components/ui/button";
import { ExportCompV2 } from "./export";
import CompLayersPanel from "./layers-panel";

const MARGINS = 100;

function CompositorV2({
	id,
	data,
	onClose,
	updateNodeData,
	container,
	containerScale = 1,
	stageOffsetX = 0,
	stageOffsetY = 0,
}) {
	const { layers, layerOrder } = data;

	const stageRef = useRef(null);
	const containerRef = useRef(null);
	const compositorRef = useRef(null);
	const backgroundLayerRef = useRef(null);
	const canvasDimensions = useRef(data.canvasDimensions || null);
	const prevCanvasDimensions = useRef(null);

	const [isLoading, setIsLoading] = useState(true);

	const layerRefs = useRef({});
	// const [layerOrder, setLayerOrder] = useState(data.layerOrder || []);
	const [layersImages, setLayersImages] = useState({});

	const [backgroundImage] = useImage(
		Object.values(layers).find((layer) => layer.name === "background").url,
		"Anonymous",
	);

	const [selectedLayer, setSelectedLayer] = useState("canvas");
	const [spacePressed, setSpacePressed] = useState(false);
	const [_cmdPressed, setCmdPressed] = useState(false);
	const [stageDimensionsUpdated, setStageDimensionsUpdated] = useState(false);

	/// transform updates
	const [tempTransformedLayer, setTempTransformedLayer] = useState(null);

	const [stageDimensions, setStageDimensions] = useState(
		data.stageDimensions || {
			width: 0,
			height: 0,
		},
	);
	const [stageZoom, setStageZoom] = useState(1);

	const { resetViewport, handleZoomToPoint } = useCanvasPanAndZoomV2(
		stageRef,
		compositorRef,
		backgroundLayerRef,
	);

	const loadImages = useCallback(async () => {
		setIsLoading(true);
		try {
			// Get all layer keys
			const layerKeys = Object.keys(layers);

			// Check if we need to load new images or remove old ones
			const needsUpdate = layerKeys.some((key) => {
				const layer = layers[key];
				const currentImage = layersImages[key];

				// Case 1: Layer has URL but image isn't loaded or URL changed
				if (layer.url && (!currentImage || currentImage.src !== layer.url)) {
					return true;
				}

				// Case 2: Layer no longer has URL but still has an image
				if (!layer.url && currentImage) {
					return true;
				}

				return false;
			});

			if (!needsUpdate) {
				setIsLoading(false);

				return;
			}

			const newImages = {};

			// Process all layers
			const loadPromises = layerKeys.map(
				(key) =>
					new Promise((resolve) => {
						const layer = layers[key];

						// If layer has no URL, skip loading but ensure it's removed from images
						if (!layer.url) {
							resolve();

							return;
						}

						// Keep existing image if URL hasn't changed
						if (layersImages[key]?.src === layer.url) {
							newImages[key] = layersImages[key];
							resolve();

							return;
						}

						// Load new image
						const img = new window.Image();
						img.crossOrigin = "anonymous";
						img.onload = () => {
							newImages[key] = img;
							resolve();
						};
						img.onerror = () => {
							logger.error(`Failed to load image for layer: ${key}`);
							resolve();
						};
						img.src = layer.url;
					}),
			);

			await Promise.all(loadPromises);
			setLayersImages(newImages);
		} catch (error) {
			logger.error("Error loading images:", error);
		} finally {
			setIsLoading(false);
		}
	}, [layers, layersImages]);

	useEffect(() => {
		loadImages();
	}, [layers]);

	/// init

	useEffect(() => {
		if (container === "node") return; // prevent changes from node
		if (!stageDimensionsUpdated) {
			return;
		}

		// first time the editor is opened
		if (backgroundImage && !canvasDimensions.current?.width) {
			canvasDimensions.current = calculateImageDimensions(
				backgroundImage,
				stageDimensions.width,
				stageDimensions.height,
				1,
				MARGINS,
				false,
			);

			// Update node data after dimensions are calculated
			updateNodeData(id, {
				canvasDimensions: canvasDimensions.current,
			});
		}
	}, [
		backgroundImage,
		stageDimensions.width,
		stageDimensions.height,
		id,
		updateNodeData,
		stageDimensionsUpdated,
	]);

	const renderBackground = () => {
		if (!canvasDimensions.current?.width) {
			return null;
		}

		const { x, y, width, height } = canvasDimensions.current;

		return (
			<CheckeredBackground
				size={10}
				x={x}
				y={y}
				width={width}
				height={height}
			/>
		);
	};

	// if container is node - prevent from mouse interactions
	useEffect(() => {
		const stage = stageRef.current;
		if (!stage) return;

		// Get the stage container DOM element
		const stageContainer = stage.container();
		if (!stageContainer) return;

		// Save the original style
		const originalStyle = stageContainer.style.pointerEvents;

		// Disable pointer events if not in editor
		stageContainer.style.pointerEvents =
			container === "editor" ? "auto" : "none";

		return () => {
			if (stageContainer) {
				stageContainer.style.pointerEvents = originalStyle;
			}
		};
	}, [container]);

	const setLayersSize = useCallback(
		(forceUpdate) => {
			Object.keys(layers).map((key) => {
				const layer = layers[key];
				if (!layersImages[key]) return;
				if (layer.transform && !forceUpdate) return;

				// first time the layer is loaded
				const { width, height } = calculateImageDimensions(
					layer.transform
						? {
								width:
									layer.transform.width / prevCanvasDimensions.current.scale,
								height:
									layer.transform.height / prevCanvasDimensions.current.scale,
							}
						: layersImages[key],
					canvasDimensions.current.width,
					canvasDimensions.current.height,
					canvasDimensions.current.scale,
					0,
					true, // prevent upscaling
				);

				const prevX = layer.transform
					? layer.transform.x
					: canvasDimensions.current.x;
				const prevY = layer.transform
					? layer.transform.y
					: canvasDimensions.current.y;

				const newX = prevCanvasDimensions.current?.scale
					? prevX - prevCanvasDimensions.current.x + canvasDimensions.current.x
					: canvasDimensions.current.x;
				const newY = prevCanvasDimensions.current?.scale
					? prevY - prevCanvasDimensions.current.y + canvasDimensions.current.y
					: canvasDimensions.current.y;

				layer.transform = {
					x: newX,
					y: newY,
					width,
					height,
					scaleX: 1,
					scaleY: 1,
					rotation: 0,
				};
			});
		},
		[
			layerRefs,
			layersImages,
			stageDimensions,
			canvasDimensions,
			prevCanvasDimensions,
		],
	);

	useEffect(() => {
		if (layers && layersImages) {
			setLayersSize(false);
		}
	}, [layers, layersImages, canvasDimensions]);

	const setCanvasDimensions = useCallback(
		(newValues) => {
			const oldCanvas = cloneDeep(canvasDimensions.current);
			prevCanvasDimensions.current = oldCanvas;
			canvasDimensions.current = {
				...oldCanvas,
				...newValues,
			};
			canvasDimensions.current = recenterCanvas(
				canvasDimensions.current,
				stageDimensions,
				MARGINS,
			);
			setLayersSize(true);
			updateNodeData(id, {
				canvasDimensions: canvasDimensions.current,
			});

			// Center and fit the canvas after updating dimensions
		},
		[id, updateNodeData, stageDimensions, setLayersSize, canvasDimensions],
	);

	// Focus on the container when loaded
	useEffect(() => {
		const timer = setTimeout(() => {
			if (compositorRef.current) {
				compositorRef.current.focus();
			}
		}, 800);

		return () => clearTimeout(timer);
	}, []);

	/// End of init

	const updateDimensions = () => {
		if (container === "node") return;
		if (containerRef.current) {
			setStageDimensions({
				width: containerRef.current.offsetWidth,
				height: containerRef.current.offsetHeight,
			});
			updateNodeData(id, {
				stageDimensions: {
					width: containerRef.current.offsetWidth,
					height: containerRef.current.offsetHeight,
				},
			});
		}
	};

	useEffect(() => {
		updateDimensions();
		loadImages();
		setStageDimensionsUpdated(true);

		if (container === "editor") {
			const handleKeyDown = (e) => {
				if (e.code === "Space" && !e.repeat) {
					setSpacePressed(true);
					e.preventDefault();
				}
				if ((e.ctrlKey || e.metaKey) && !e.repeat) {
					// todo - select layer on cmd press + click
					setCmdPressed(true);
					e.preventDefault();
				}
				if (
					(e.ctrlKey || e.metaKey) &&
					(e.code === "Digit0" || e.code === "Numpad0")
				) {
					// zoom to 100%
					handleZoomToPoint(1 / canvasDimensions.current.scale);
				}
				if (
					(e.ctrlKey || e.metaKey) &&
					(e.code === "Digit1" || e.code === "Numpad1")
				) {
					// zoom to fit
					resetViewport();
				}
			};

			const handleKeyUp = (e) => {
				if (e.code === "Space") {
					setSpacePressed(false);
				}
				if (
					e.code === "ControlLeft" ||
					e.code === "ControlRight" ||
					e.code === "MetaLeft" ||
					e.code === "MetaRight"
				) {
					setCmdPressed(false);
				}
			};

			// Add event listeners only if not in node container
			window.addEventListener("resize", updateDimensions);
			window.addEventListener("keydown", handleKeyDown);
			window.addEventListener("keyup", handleKeyUp);

			// Cleanup
			return () => {
				window.removeEventListener("resize", updateDimensions);
				window.removeEventListener("keydown", handleKeyDown);
				window.removeEventListener("keyup", handleKeyUp);
			};
		}
	}, []);

	/// END OF event listeners - resize / key strokes

	/// NAVIGATION
	const handleResetZoom = useCallback(() => {
		resetViewport();
	}, [resetViewport]);

	const handleZoom = useCallback(
		(zoom) => {
			handleZoomToPoint(zoom / canvasDimensions.current.scale);
		},
		[handleZoomToPoint, canvasDimensions],
	);

	useEffect(() => {
		if (
			stageRef.current &&
			canvasDimensions.current &&
			canvasDimensions.current.scale
		) {
			setStageZoom(
				stageRef.current?.scale().x * canvasDimensions.current.scale,
			);
		}
	}, [stageRef.current, canvasDimensions.current]);

	const updateLayerOrder = useCallback(
		(newOrder) => {
			updateNodeData(id, {
				layerOrder: newOrder,
			});
		},
		[id, updateNodeData],
	);

	const updateLayer = useCallback(
		(key, layer) => {
			updateNodeData(id, {
				layers: {
					...layers,
					[key]: layer,
				},
			});
		},
		[id, layers, updateNodeData],
	);

	const handleTransformUpdate = useCallback(
		(updatedLayer) => {
			setTempTransformedLayer(updatedLayer);
		},
		[updateLayer, layers],
	);

	const handleCommitTransformUpdate = useCallback(
		(layerKey, updatedLayer) => {
			updateLayer(layerKey, updatedLayer);
			setTempTransformedLayer(null);
		},
		[updateLayer, layers],
	);

	const handleSelectLayer = (layerKey) => {
		setSelectedLayer(layerKey);
	};

	const renderLayers = useCallback(() => {
		if (
			!layersImages ||
			Object.keys(layersImages).length === 0 ||
			!layerOrder
		) {
			return null;
		}

		return layerOrder.map((key) => {
			const layer = layers[key];
			if (!layer.transform || !layersImages[key]) return null;

			return (
				<Group
					key={key}
					visible={layer.visible}
					ref={(el) => (layerRefs.current[key] = el)}
				>
					<CompKonvaLayer
						layer={layer}
						image={layersImages[key]}
						isLocked={layer.locked}
						isSelected={selectedLayer === key}
						onSelect={() => handleSelectLayer(key)}
						onTransform={(updatedLayer) => handleTransformUpdate(updatedLayer)}
						onCommitTransform={(updatedLayer) =>
							handleCommitTransformUpdate(key, updatedLayer)
						}
						spacePressed={spacePressed}
					/>
				</Group>
			);
		});
	}, [
		layers,
		layerOrder,
		layersImages,
		selectedLayer,
		spacePressed,
		handleTransformUpdate,
	]);

	/// Close and save

	/// EXPORTING

	const handleExport = useCallback(() => {
		if (!canvasDimensions.current || !layerOrder || !layers || !layersImages) {
			return;
		}
		try {
			const imageData = ExportCompV2({
				canvasDimensions: canvasDimensions.current,
				layerOrder,
				layers,
				layersImages,
			});
			updateNodeData(id, {
				result: {
					...imageData,
					type: "image",
				},
				output: {
					[data.handles.output[0]]: {
						...imageData,
						type: "image",
					},
				},
			});
		} catch (error) {
			logger.error("Error exporting canvas:", error);
		}
	}, [
		layerOrder,
		layers,
		layersImages,
		canvasDimensions,
		isLoading,
		updateNodeData,
		data.handles,
		stageDimensionsUpdated,
	]);

	useEffect(() => {
		// export on connect / disconnect from the CompNodeV2
		handleExport();
	}, [layersImages]);

	useEffect(() => {
		// export on layer move (while container is node)
		if (container === "node") {
			handleExport();
		}
	}, [layers]);

	const handleClose = async (e) => {
		e?.preventDefault();
		handleExport();
		setTimeout(() => onClose(), 0);
	};

	// Ensure close button can't be clicked multiple times
	const [isClosing, setIsClosing] = useState(false);
	const safeHandleClose = async (e) => {
		if (isClosing) return;
		setIsClosing(true);
		await handleClose(e);
	};

	return (
		<Box sx={{ width: "100%", height: "100%", position: "relative" }}>
			<Box
				sx={{
					width: "100%",
					height: "100%",
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					p: container === "editor" ? 1 : 0,
					"&:focus": { outline: "none" },
					cursor: spacePressed ? "grab" : "default",
					position: "relative",
				}}
				tabIndex="0"
				ref={compositorRef}
			>
				<Box
					id="compositorv2-canvas-container"
					ref={containerRef}
					sx={{
						width: "100%",
						height: "100%",
						position: "relative",
						pointerEvents: !hasEditingPermissions(role, data) ? "none" : "",
					}}
				>
					{!isLoading && (
						<Stage
							ref={stageRef}
							width={stageDimensions.width}
							height={stageDimensions.height}
							x={stageOffsetX}
							y={stageOffsetY}
							scaleX={containerScale}
							scaleY={containerScale}
							draggable={spacePressed}
							id="compositorv2-canvas-stage"
						>
							<Layer ref={backgroundLayerRef}>
								{containerRef.current && renderBackground()}
								{layersImages && renderLayers()}
								{containerRef.current &&
									canvasDimensions.current &&
									(() => {
										const { x, y, width, height } = canvasDimensions.current;

										return (
											<Rect
												x={x - 1}
												y={y - 1}
												width={width + 1}
												height={height + 1}
												stroke="grey"
												strokeWidth={1}
												listening={false}
											/>
										);
									})()}
							</Layer>
						</Stage>
					)}
				</Box>
				{isLoading && (
					<Box
						sx={{
							zIndex: 1,
							opacity: ".7",
							background: color.Black100,
							display: "flex",
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: "100%",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<CircularProgress color="inherit" />
					</Box>
				)}
			</Box>
			{container === "editor" && (
				<>
					<CompLayersPanel
						layers={layers}
						selectedLayer={selectedLayer}
						setSelectedLayer={setSelectedLayer}
						updateLayer={updateLayer}
						layerOrder={layerOrder}
						updateLayerOrder={updateLayerOrder}
					/>
					<LayerPropertiesPanel
						canvas={canvasDimensions.current}
						layers={layers}
						selectedLayerKey={selectedLayer}
						updateLayer={updateLayer}
						tempTransformedLayer={tempTransformedLayer}
						setCanvas={setCanvasDimensions}
					/>
					<CompNavigationPanel
						handleResetZoom={handleResetZoom}
						handleZoom={handleZoom}
						zoom={stageZoom}
					/>
					<Button onClick={safeHandleClose} size="sm">
						<X />
					</Button>
				</>
			)}
			<Box id="temp-stage-container" style={{ display: "none" }} />
		</Box>
	);
}

export default CompositorV2;
