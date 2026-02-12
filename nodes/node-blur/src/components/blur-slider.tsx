import { useNodeUI } from "@gatewai/node-sdk";
import { Label, Slider } from "@gatewai/ui-kit";
import React, { memo, useCallback, useEffect, useState } from "react";

export const BlurValueSlider = memo(({ node }: { node: any }) => {
	const { onNodeConfigUpdate } = useNodeUI();
	const config = node.config || {};
	const [localSize, setLocalSize] = useState(config.size ?? 0);

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

BlurValueSlider.displayName = "BlurValueSlider";
