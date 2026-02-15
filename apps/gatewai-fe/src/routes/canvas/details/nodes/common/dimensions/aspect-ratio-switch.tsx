import type { ResizeNodeConfig } from "@gatewai/core/types";
import type { NodeEntityType } from "@gatewai/react-store";
import {
	Button,
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@gatewai/ui-kit";
import { Lock, Unlock } from "lucide-react";
import { memo, useCallback } from "react";
import { useCanvasCtx } from "../../../../../../../../../packages/react-canvas/src/canvas-ctx";

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
		const { onNodeConfigUpdate } = useCanvasCtx();

		// In types.ts, we need to extend config to include aspectRatio. The component doesn't need to import the updated type explicitly if it relies on generic access, but we should be aware.
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

export { AspectRatioSwitch };
