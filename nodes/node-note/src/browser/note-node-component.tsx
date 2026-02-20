import { useCanvasCtx } from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { Textarea } from "@gatewai/ui-kit";
import { NodeResizer } from "@xyflow/react";
import { memo, useCallback } from "react";
import type { NoteNodeConfig } from "@/shared/config.js";

const NoteNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const node = useAppSelector(makeSelectNodeById(props.id));
		const { onNodeConfigUpdate } = useCanvasCtx();
		const nodeConfig = (node?.config as NoteNodeConfig) ?? {};
		const text = nodeConfig?.content ?? "";

		const handleChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				onNodeConfigUpdate({
					id: props.id,
					newConfig: { ...nodeConfig, content: e.target.value },
				});
			},
			[onNodeConfigUpdate, props.id, nodeConfig],
		);

		// Default colors
		const backgroundColor = nodeConfig?.backgroundColor || "#ffff99";
		const textColor = nodeConfig?.textColor || "#000000";

		return (
			<div
				className="h-full w-full flex flex-col shadow-md rounded-sm overflow-hidden"
				style={{ backgroundColor }}
			>
				<NodeResizer
					isVisible={props.selected}
					minWidth={100}
					minHeight={80}
					lineClassName="border border-gray-300"
					handleClassName="h-3 w-3 bg-white border-2 rounded border-blue-400"
				/>

				<div className="custom-drag-handle h-6 w-full cursor-move bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors">
					<div className="w-8 h-1 rounded-full bg-black/20" />
				</div>

				<Textarea
					value={text}
					onChange={handleChange}
					style={{
						color: textColor,
						backgroundColor: "transparent",
					}}
					className="nodrag nopan w-full flex-1 resize-none border-none outline-none focus:outline-none focus:ring-0 p-2 text-sm font-sans"
					placeholder="Enter your notes here..."
				/>
			</div>
		);
	},
);

export { NoteNodeComponent };
