import { useNodeUI } from "@gatewai/node-sdk/browser";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	Button,
	DraggableNumberInput,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@gatewai/ui-kit";
import {
	ArrowLeftRight,
	ArrowUpDown,
	Lock,
	Maximize2,
	Unlock,
} from "lucide-react";
import { memo, useCallback } from "react";
import type { ResizeNodeConfig } from "@/shared/config.js";

function ResizeConfig({
	node,
	disabled,
}: {
	node: NodeEntityType;
	disabled?: boolean;
}) {
	const nodeConfig = node.config as ResizeNodeConfig;
	return (
		<div className="flex items-end gap-2">
			<ResizeWidthInput
				node={node}
				disabled={disabled}
				originalWidth={nodeConfig?.originalWidth ?? undefined}
				originalHeight={nodeConfig?.originalHeight ?? undefined}
				maintainAspect={nodeConfig?.maintainAspect ?? true}
			/>
			<ResizeHeightInput
				node={node}
				disabled={disabled}
				originalWidth={nodeConfig?.originalWidth ?? undefined}
				originalHeight={nodeConfig?.originalHeight ?? undefined}
				maintainAspect={nodeConfig?.maintainAspect ?? true}
			/>
			<AspectRatioSwitch
				node={node}
				disabled={disabled}
				originalWidth={nodeConfig?.originalWidth ?? undefined}
				originalHeight={nodeConfig?.originalHeight ?? undefined}
			/>
			<ResetButton node={node} disabled={disabled} />
		</div>
	);
}

const ResizeWidthInput = memo(
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
		const { onNodeConfigUpdate } = useNodeUI();

		const displayValue = config.width ?? originalWidth ?? 0;

		const handleChange = useCallback(
			(value: number) => {
				if (value < 1 || value > 4096) {
					return;
				}

				let updates: Partial<ResizeNodeConfig> = { width: value };

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
						updates = { ...config, ...updates, height: newHeight };
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
		const { onNodeConfigUpdate } = useNodeUI();

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

const AspectRatioSwitch = memo(
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
		const config = node?.config as ResizeNodeConfig;
		const maintainAspect = config.maintainAspect ?? true;
		const { onNodeConfigUpdate } = useNodeUI();

		const handleChange = useCallback(
			(checked: boolean) => {
				let updates: Partial<
					ResizeNodeConfig & { maintainAspect: boolean; aspectRatio?: number }
				> = {
					maintainAspect: checked,
				};

				if (checked) {
					let ratio: number | undefined;
					const w = config.width ?? originalWidth ?? 0;
					const h = config.height ?? originalHeight ?? 0;

					if (w > 0 && h > 0) {
						ratio = w / h;
						updates = { ...config, ...updates, aspectRatio: ratio };
					}
				} else {
					// Unlock: clear ratio
					updates = { ...config, ...updates, aspectRatio: undefined };
				}

				onNodeConfigUpdate({
					id: node.id,
					newConfig: updates,
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

function ResetButton({
	node,
	disabled,
}: {
	node: NodeEntityType;
	disabled?: boolean;
}) {
	const { onNodeConfigUpdate } = useNodeUI();
	const config = node.config as ResizeNodeConfig;
	const hasOriginals =
		config.originalWidth != null && config.originalHeight != null;

	const handleReset = () => {
		if (!hasOriginals) return;

		let updates: Partial<ResizeNodeConfig> = {
			width: config.originalWidth,
			height: config.originalHeight,
		};

		if (config.maintainAspect) {
			updates = {
				...updates,
				aspectRatio: config.originalWidth! / config.originalHeight!,
			};
		}

		onNodeConfigUpdate({
			id: node.id,
			newConfig: { ...config, ...updates },
		});
	};

	if (!hasOriginals) return null;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="outline"
					size="icon-sm"
					disabled={disabled}
					onClick={handleReset}
				>
					<Maximize2 className="h-4 w-4" />
				</Button>
			</TooltipTrigger>
			<TooltipContent>
				<p>Reset to Original Size</p>
			</TooltipContent>
		</Tooltip>
	);
}

export { ResizeConfig };
