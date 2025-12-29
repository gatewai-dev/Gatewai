import type { ResizeNodeConfig } from "@gatewai/types";
import { memo, useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NodeEntityType } from "@/store/nodes";
import { useCanvasCtx } from "../../../ctx/canvas-ctx";

const ResizeWidthInput = memo(
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

		const displayValue = config.width ?? originalWidth ?? 0;
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

			let updates: Partial<ResizeNodeConfig> = { width: value };
			if (maintainAspect && originalWidth && originalHeight) {
				const newHeight = Math.round((originalHeight / originalWidth) * value);
				updates = { ...config, ...updates, height: newHeight };
			}

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
				<Label className="text-xs text-gray-600">Width</Label>
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

export { ResizeWidthInput };
