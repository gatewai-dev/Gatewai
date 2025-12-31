export const ExportCompV2 = ({
	canvasDimensions,
	layerOrder,
	layers,
	layersImages,
}) => {
	// Calculate final dimensions

	const finalWidth = canvasDimensions.width / canvasDimensions.scale;
	const finalHeight = canvasDimensions.height / canvasDimensions.scale;

	// Create a temporary stage for rendering
	const tempStage = new window.Konva.Stage({
		container: "temp-stage-container",
		width: finalWidth,
		height: finalHeight,
	});

	// Create a single layer for all content
	const tempLayer = new window.Konva.Layer();
	tempStage.add(tempLayer);

	// Calculate the offset to center the content
	const offsetX = -canvasDimensions.x;
	const offsetY = -canvasDimensions.y;

	// Render each visible layer in order
	for (const key of layerOrder) {
		const layer = layers[key];
		if (!layer.visible || !layersImages[key]) continue;

		const image = new window.Konva.Image({
			image: layersImages[key],
			x: (layer.transform.x + offsetX) / canvasDimensions.scale,
			y: (layer.transform.y + offsetY) / canvasDimensions.scale,
			width:
				(layer.transform.width * layer.transform.scaleX) /
				canvasDimensions.scale,
			height:
				(layer.transform.height * layer.transform.scaleY) /
				canvasDimensions.scale,
			rotation: layer.transform.rotation,
			globalCompositeOperation: layer.blend_mode,
		});

		tempLayer.add(image);
	}

	// Render the stage
	tempStage.batchDraw();

	const dataURL = tempStage.toDataURL({
		mimeType: "image/png",
		quality: 1,
		pixelRatio: 1,
	});

	// Clean up
	tempStage.destroy();

	return {
		url: dataURL,
		width: Math.round(finalWidth),
		height: Math.round(finalHeight),
	};
};
