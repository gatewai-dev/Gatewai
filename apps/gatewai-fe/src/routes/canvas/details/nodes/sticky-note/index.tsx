import type { NoteNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { useCanvasCtx } from "../../ctx/canvas-ctx";
import type { NoteNode } from "../node-props";

const NoteNodeComponent = memo((props: NodeProps<NoteNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const { onNodeConfigUpdate } = useCanvasCtx();
	const nodeConfig = node?.config as unknown as NoteNodeConfig;
	const text = nodeConfig.content ?? "";
	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onNodeConfigUpdate({
			id: props.id,
			newConfig: { ...nodeConfig, content: e.target.value },
		});
	};

	return (
		<>
			<Textarea
				value={text}
				onChange={handleChange}
				style={{
					color: nodeConfig?.textColor,
					backgroundColor: nodeConfig?.backgroundColor,
				}}
				className="w-full h-full"
				placeholder="Enter your notes"
			/>
		</>
	);
});
NoteNodeComponent.displayName = "NoteNode";

export { NoteNodeComponent };
