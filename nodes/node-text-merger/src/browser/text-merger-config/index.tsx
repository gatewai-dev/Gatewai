import type { TextMergerNodeConfig } from "@gatewai/node-text-merger";
import { useCanvasCtx } from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { Textarea } from "@gatewai/ui-kit";
import { memo, useCallback } from "react";

const TextMergerNodeConfigComponent = memo(({ node }: { node: any }) => {
	const { onNodeConfigUpdate } = useCanvasCtx();
	const nodeConfig = node.config as TextMergerNodeConfig;

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			onNodeConfigUpdate({
				id: node.id,
				newConfig: { ...nodeConfig, template: e.target.value },
			});
		},
		[onNodeConfigUpdate, node.id, nodeConfig],
	);

	return (
		<div className="flex flex-col gap-2">
			<Textarea
				className="min-h-[100px] text-xs font-mono"
				placeholder="Enter template here... e.g. Hello {name}"
				value={nodeConfig?.template ?? ""}
				onChange={handleChange}
			/>
			<p className="text-[10px] text-muted-foreground">
				Use {"{handle_name}"} to inject values from input handles.
			</p>
		</div>
	);
});

export { TextMergerNodeConfigComponent };
