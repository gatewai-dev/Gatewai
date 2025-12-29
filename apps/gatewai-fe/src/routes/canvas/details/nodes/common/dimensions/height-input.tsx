import type { ResizeNodeConfig } from "@gatewai/types";
import { memo, useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import type { NodeEntityType } from "@/store/nodes";
import { useCanvasCtx } from "../../../ctx/canvas-ctx";
import { Label } from "@/components/ui/label";

const ResizeHeightInput = memo(
	({
		node,
		originalWidth,
		originalHeight,
		maintainAspect,
	}: {
		node: NodeEntityType;
		originalWidth: number | null;
		originalHeight: number | null;
		maintainAspect: boolean;
	}) => {
		const config: ResizeNodeConfig = node?.config as ResizeNodeConfig;
		const { onNodeConfigUpdate } = useCanvasCtx();

		const displayValue = config.height ?? originalHeight ?? 0;
		const [inputValue, setInputValue] = useState(displayValue.toString());

		useEffect(() => {
			setInputValue(displayValue.toString());
		}, [displayValue]);

		const handleChange = useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				setInputValue(e.target.value);
			},
			[],
		);

		const handleBlur = useCallback(() => {
			if (inputValue === "") {
				setInputValue(displayValue.toString());
				return;
			}
			const value = parseInt(inputValue, 10);
			if (Number.isNaN(value) || value < 1 || value > 2000) {
				setInputValue(displayValue.toString());
				return;
			}

			let updates: Partial<ResizeNodeConfig> = { height: value };
			console.log({ maintainAspect });
			if (maintainAspect && originalWidth && originalHeight) {
				const newWidth = Math.round((originalWidth / originalHeight) * value);
				updates = { ...config, ...updates, width: newWidth };
			}
			console.log({ updates });
			onNodeConfigUpdate({
				id: node.id,
				newConfig: updates,
			});
		}, [
			inputValue,
			maintainAspect,
			originalWidth,
			originalHeight,
			onNodeConfigUpdate,
			node.id,
			displayValue,
			config,
		]);

		return (
			<div className="flex items-center gap-1 flex-1">
				<Label className="text-xs text-gray-600">Height</Label>
				<Input
					type="text"
					inputMode="numeric"
					pattern="[0-9]*"
					value={inputValue}
					onChange={handleChange}
					onBlur={handleBlur}
				/>
			</div>
		);
	},
);

export { ResizeHeightInput };
