import type { NodeProps } from "@xyflow/react";
import { ForwardIcon } from "lucide-react";
import { memo } from "react";
import { AiOutlineStop } from "react-icons/ai";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { useNodeTaskRunning } from "../ctx/task-manager-ctx";
import type { AnyNode } from "../nodes/node-props";
import { useNodeValidation } from "../processor/processor-ctx";

export type RunNodeButtonProps = ButtonProps & {
	nodeProps: NodeProps<AnyNode>;
};

const RunNodeButton = memo(
	({ nodeProps, ...buttonProps }: RunNodeButtonProps) => {
		const { runNodes } = useCanvasCtx();

		const isNodeRunning = useNodeTaskRunning(nodeProps.id);

		const validation = useNodeValidation(nodeProps.id);
		const isInvalid = Object.keys(validation).length > 0;

		return (
			<Button
				{...buttonProps}
				disabled={isNodeRunning || isInvalid}
				onClick={() => runNodes([nodeProps.id])}
				size="sm"
			>
				{!isNodeRunning && !isInvalid && (
					<>
						<ForwardIcon />
						<span className="text-xs">Run Node</span>
					</>
				)}
				{isNodeRunning && (
					<>
						<Spinner className="size-3" />
						<span className="text-xs">Running...</span>
					</>
				)}
				{isInvalid && (
					<>
						<AiOutlineStop className="size-3" />
						<span className="text-xs">Invalid Inputs</span>
					</>
				)}
			</Button>
		);
	},
);

export { RunNodeButton };
