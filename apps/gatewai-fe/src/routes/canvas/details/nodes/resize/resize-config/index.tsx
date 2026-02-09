import type { ResizeNodeConfig } from "@gatewai/types";
import type { NodeEntityType } from "@/store/nodes";
import { AspectRatioSwitch } from "../../common/dimensions/aspect-ratio-switch";
import { ResizeHeightInput } from "../../common/dimensions/height-input";
import { ResizeWidthInput } from "../../common/dimensions/width-input";

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

import { Maximize2 } from "lucide-react";
import { Button } from "@gatewai/ui-kit";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@gatewai/ui-kit";
import { useCanvasCtx } from "../../../ctx/canvas-ctx";

function ResetButton({
	node,
	disabled,
}: {
	node: NodeEntityType;
	disabled?: boolean;
}) {
	const { onNodeConfigUpdate } = useCanvasCtx();
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
