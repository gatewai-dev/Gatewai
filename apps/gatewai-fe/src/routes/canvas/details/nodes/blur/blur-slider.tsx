import {
	type BlurNodeConfig,
	BlurNodeConfigSchema,
} from "@gatewai/nodes/configs";
import type { NodeEntityType } from "@gatewai/react-store";
import { Label, Slider } from "@gatewai/ui-kit";
import { memo, useCallback, useEffect, useState } from "react";
import { useCanvasCtx } from "../../../../../../../../packages/react-canvas/src/canvas-ctx";

const BlurValueSlider = memo(({ node }: { node: NodeEntityType }) => {
	const config: BlurNodeConfig = node.config as BlurNodeConfig;
	const [localSize, setLocalSize] = useState(config.size ?? 0);
	const { onNodeConfigUpdate } = useCanvasCtx();

	useEffect(() => {
		setLocalSize(config.size ?? 0);
	}, [config.size]);

	const handleChange = useCallback(
		(value: number[]) => {
			setLocalSize(value[0]);
			onNodeConfigUpdate({
				id: node.id,
				newConfig: { size: value[0] },
			});
		},
		[node.id, onNodeConfigUpdate],
	);

	const onValueCommit = useCallback(() => {
		onNodeConfigUpdate({
			id: node.id,
			newConfig: { size: localSize },
			appendHistory: true,
		});
	}, [localSize, node.id, onNodeConfigUpdate]);

	return (
		<div className="flex flex-col gap-1 flex-1">
			<Label className="text-xs text-gray-600">Size: {localSize}</Label>
			<Slider
				value={[localSize]}
				max={100}
				min={1}
				step={1}
				onValueCommit={onValueCommit}
				onValueChange={handleChange}
			/>
		</div>
	);
});

export { BlurValueSlider };
