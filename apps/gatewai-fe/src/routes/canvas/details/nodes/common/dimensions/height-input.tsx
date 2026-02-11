import type { NodeEntityType } from "@gatewai/react-store";
import type { ResizeNodeConfig } from "@gatewai/types";
import { DraggableNumberInput } from "@gatewai/ui-kit";
import { ArrowUpDown } from "lucide-react";
import { memo, useCallback } from "react";
import { useCanvasCtx } from "../../../ctx/canvas-ctx";

const ResizeHeightInput = memo(
	({
		node,
		originalWidth,
		originalHeight,
		maintainAspect,
		disabled,
	}: {
		node: NodeEntityType;
		originalWidth?: number;
		originalHeight?: number;
		maintainAspect: boolean;
		disabled?: boolean;
	}) => {
		const config: ResizeNodeConfig = node?.config as ResizeNodeConfig;
		const { onNodeConfigUpdate } = useCanvasCtx();

		const displayValue = config.height ?? originalHeight ?? 0;

		const handleChange = useCallback(
			(value: number) => {
				if (value < 1 || value > 4096) {
					return;
				}

				let updates: Partial<ResizeNodeConfig> = { height: value };

				if (maintainAspect) {
					// Use stored aspect ratio if available
					let ratio = config.aspectRatio;

					// Fallback 1: Original dimensions (Resize Node)
					if (!ratio && originalWidth && originalHeight) {
						ratio = originalWidth / originalHeight;
					}

					// Fallback 2: Current dimensions (Paint Node default)
					if (!ratio && config.width && config.height) {
						ratio = config.width / config.height;
					}

					if (ratio) {
						const newWidth = Math.round(value * ratio);
						updates = { ...config, ...updates, width: newWidth };
					}
				}

				onNodeConfigUpdate({
					id: node.id,
					newConfig: updates,
				});
			},
			[
				maintainAspect,
				originalWidth,
				originalHeight,
				onNodeConfigUpdate,
				node.id,
				config,
			],
		);

		return (
			<DraggableNumberInput
				label="Height"
				value={displayValue}
				onChange={handleChange}
				min={1}
				max={4096}
				disabled={disabled}
				icon={ArrowUpDown}
				className="flex-1"
			/>
		);
	},
);

export { ResizeHeightInput };
