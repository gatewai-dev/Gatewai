import type { ResizeNodeConfig } from "@gatewai/types";
import { Lock, Unlock } from "lucide-react";
import { memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NodeEntityType } from "@/store/nodes";
import { useCanvasCtx } from "../../../ctx/canvas-ctx";

const AspectRatioSwitch = memo(
	({
		node,
		originalWidth,
		originalHeight,
	}: {
		node: NodeEntityType;
		originalWidth: number | null;
		originalHeight: number | null;
	}) => {
		const config = node?.config as ResizeNodeConfig;
		const maintainAspect = config.maintainAspect ?? true;
		const { onNodeConfigUpdate } = useCanvasCtx();

		const handleChange = useCallback(
			(checked: boolean) => {
				let updates: Partial<ResizeNodeConfig & { maintainAspect: boolean }> = {
					maintainAspect: checked,
				};
				if (checked && originalWidth && originalHeight) {
					const currentWidth = config.width ?? originalWidth;
					const newHeight = Math.round(
						(originalHeight / originalWidth) * currentWidth,
					);
					updates = { ...config, ...updates, height: newHeight };
				}

				onNodeConfigUpdate({
					id: node.id,
					newConfig: updates,
				});
			},
			[originalWidth, originalHeight, onNodeConfigUpdate, node.id, config],
		);

		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
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
			</TooltipProvider>
		);
	},
);

export { AspectRatioSwitch };
