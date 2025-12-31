import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { color } from "@/colors";
import { useIsHovered } from "@/hooks/useIsHovered";
import CompLayer from "./CompLayer";

function CompLayersPanel({
	layers,
	selectedLayer,
	setSelectedLayer,
	updateLayer,
	layerOrder,
	updateLayerOrder,
}) {
	const { isHovered, ...elementProps } = useIsHovered();
	const [isSelected, setIsSelected] = useState(false);
	const [draggedLayer, setDraggedLayer] = useState(null);
	const [targetLayer, setTargetLayer] = useState(null);

	useEffect(() => {
		setIsSelected(selectedLayer === "canvas");
	}, [selectedLayer]);

	const handleDragStart = (e, layerName) => {
		setDraggedLayer(layerName);
		e.dataTransfer.setData("text/plain", layerName);
	};

	const handleDragEnd = () => {
		setDraggedLayer(null);
		setTargetLayer(null);
	};

	const handleDragOver = (e, key) => {
		e.preventDefault();
		setTargetLayer(key);
	};

	const handleDrop = (e, targetLayerName) => {
		e.preventDefault();
		if (!draggedLayer || draggedLayer === targetLayerName) return;

		const newOrder = [...layerOrder];
		const draggedIndex = newOrder.indexOf(draggedLayer);
		const targetIndex = newOrder.indexOf(targetLayerName);

		// Remove dragged item and insert at new position
		newOrder.splice(draggedIndex, 1);
		newOrder.splice(targetIndex, 0, draggedLayer);

		updateLayerOrder(newOrder);
	};

	const reversedLayerOrder = [...layerOrder].reverse();

	const shouldShowTopIndicator = (targetLayerName, draggedLayerName) => {
		if (!targetLayerName || !draggedLayerName) return false;
		// In the reversed view, if target is visually above dragged layer,
		// it means target has a higher index in the reversed array
		const targetReversedIndex = reversedLayerOrder.indexOf(targetLayerName);
		const draggedReversedIndex = reversedLayerOrder.indexOf(draggedLayerName);
		return targetReversedIndex < draggedReversedIndex;
	};

	return (
		<Box
			id="compositor-layers-panel"
			className="compositor-panel"
			sx={{
				background: color.Black92,
				position: "absolute",
				top: 30,
				left: 30,
				borderRadius: 1,
				width: "200px",
				overflow: "hidden",
			}}
		>
			<Box
				id="compositor-layers-panel-header"
				sx={{
					width: "100%",
					background: color.Yambo_Black,
					px: 1,
					py: 0.4,
					display: "flex",
					alignItems: "center",
				}}
			>
				<Typography variant="body-sm-rg">Layers</Typography>
			</Box>
			<Box id="compositor-layers-panel-layers-container" sx={{ p: 0.1 }}>
				<Box
					sx={{
						display: "flex",
						flexDirection: "row",
						alignItems: "center",
						p: 0.2,
						px: 1,
						cursor: "pointer",
						boxShadow: isHovered
							? `inset 0 0 0 1px ${color.Yambo_Black_Stroke}`
							: "none",
						borderRadius: "2px",
						background: isSelected ? color.Yambo_Purple : "none",
					}}
					onClick={() => setSelectedLayer("canvas")}
					{...elementProps}
				>
					<i className="fa-light fa-frame fa-sm"></i>
					<Typography
						variant="body-sm-rg"
						sx={{
							ml: 1,
							fontWeight: isSelected ? "" : "500",
						}}
					>
						canvas
					</Typography>
				</Box>
				{layers &&
					reversedLayerOrder.map((key) => {
						const layer = layers[key];
						const showTopIndicator = shouldShowTopIndicator(key, draggedLayer);
						return (
							<Box
								id={`comp-layer-draggable-wrapper-${key}`}
								key={key}
								draggable
								onDragStart={(e) => handleDragStart(e, key)}
								onDragEnd={handleDragEnd}
								onDragOver={(e) => handleDragOver(e, key)}
								onDrop={(e) => handleDrop(e, key)}
								sx={{
									borderTop:
										targetLayer === key && showTopIndicator
											? `2px solid ${color.Yambo_Purple}`
											: "none",
									borderBottom:
										targetLayer === key && !showTopIndicator
											? `2px solid ${color.Yambo_Purple}`
											: "none",
									position: "relative",
									"&::before": {
										content: '""',
										position: "absolute",
										zIndex: 1,
										left: "0px",
										top: "-4px",
										width: "6px",
										height: "6px",
										borderRadius: "50%",
										backgroundColor: color.Yambo_Purple,
										display:
											targetLayer === key && showTopIndicator
												? "block"
												: "none",
									},
									"&::after": {
										content: '""',
										position: "absolute",
										zIndex: 1,
										left: "0px",
										bottom: "-4px",
										width: "6px",
										height: "6px",
										borderRadius: "50%",
										backgroundColor: color.Yambo_Purple,
										display:
											targetLayer === key && !showTopIndicator
												? "block"
												: "none",
									},
								}}
							>
								<CompLayer
									layer={layer}
									name={key}
									selectedLayer={selectedLayer}
									setSelectedLayer={setSelectedLayer}
									updateLayer={updateLayer}
									isDragged={draggedLayer === key}
								/>
							</Box>
						);
					})}
			</Box>
		</Box>
	);
}

export default CompLayersPanel;
