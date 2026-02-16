import { useNodeUI } from "@gatewai/node-sdk/browser";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	Button,
	DraggableNumberInput,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@gatewai/ui-kit";
import { ArrowLeftRight, ArrowUpDown, Lock, Unlock } from "lucide-react";
import { memo, useCallback } from "react";

/**
 * Generic interface for a node config that has dimensions and aspect ratio control.
 */
interface DimensionConfig {
	width?: number;
	height?: number;
	maintainAspect?: boolean;
	aspectRatio?: number;
	[key: string]: any;
}

export const ResizeWidthInput = memo(
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
		const config = node?.config as DimensionConfig;
		const { onNodeConfigUpdate } = useNodeUI();

		const displayValue = config.width ?? originalWidth ?? 0;

		const handleChange = useCallback(
			(value: number) => {
				if (value < 1 || value > 4096) {
					return;
				}

				let updates: Partial<DimensionConfig> = { width: value };

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
						const newHeight = Math.round(value / ratio);
						updates = { ...updates, height: newHeight };
					}
				}

				onNodeConfigUpdate({
					id: node.id,
					newConfig: { ...config, ...updates },
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
				label="Width"
				value={displayValue}
				onChange={handleChange}
				min={1}
				max={4096}
				disabled={disabled}
				icon={ArrowLeftRight}
				className="flex-1"
			/>
		);
	},
);

export const ResizeHeightInput = memo(
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
		const config = node?.config as DimensionConfig;
		const { onNodeConfigUpdate } = useNodeUI();

		const displayValue = config.height ?? originalHeight ?? 0;

		const handleChange = useCallback(
			(value: number) => {
				if (value < 1 || value > 4096) {
					return;
				}

				let updates: Partial<DimensionConfig> = { height: value };

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
						updates = { ...updates, width: newWidth };
					}
				}

				onNodeConfigUpdate({
					id: node.id,
					newConfig: { ...config, ...updates },
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

export const AspectRatioSwitch = memo(
	({
		node,
		originalWidth,
		originalHeight,
		disabled,
	}: {
		node: NodeEntityType;
		originalWidth?: number;
		originalHeight?: number;
		disabled?: boolean;
	}) => {
		const config = node?.config as DimensionConfig;
		const maintainAspect = config.maintainAspect ?? true;
		const { onNodeConfigUpdate } = useNodeUI();

		const handleChange = useCallback(
			(checked: boolean) => {
				let updates: Partial<DimensionConfig> = {
					maintainAspect: checked,
				};

				if (checked) {
					let ratio: number | undefined;
					const w = config.width ?? originalWidth ?? 0;
					const h = config.height ?? originalHeight ?? 0;

					if (w > 0 && h > 0) {
						ratio = w / h;
						updates = { ...updates, aspectRatio: ratio };
					}
				} else {
					// Unlock: clear ratio
					updates = { ...updates, aspectRatio: undefined };
				}

				onNodeConfigUpdate({
					id: node.id,
					newConfig: { ...config, ...updates },
				});
			},
			[originalWidth, originalHeight, onNodeConfigUpdate, node.id, config],
		);

		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						disabled={disabled}
						size="icon-sm"
						onClick={() => handleChange(!maintainAspect)}
					>
						{maintainAspect ? (
							<Lock className="h-4 w-4" />
						) : (
							<Unlock className="h-4 w-4" />
						)}
					</Button>
				</TooltipTrigger>
				<TooltipContent>
					<p>Lock Aspect Ratio</p>
				</TooltipContent>
			</Tooltip>
		);
	},
);
