import { useNodeUI } from "@gatewai/node-sdk/browser";
import {
	AspectRatioSwitch,
	ResizeHeightInput,
	ResizeWidthInput,
} from "@gatewai/react-canvas";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	Button,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@gatewai/ui-kit";
import { Maximize2 } from "lucide-react";
import { memo } from "react";
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
