import type { NodeProps } from "@xyflow/react";
import { ForwardIcon } from "lucide-react";
import { memo } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { useNodeTaskRunning } from "../ctx/task-manager-ctx";
import type { AnyNode } from "../nodes/node-props";

export type RunNodeButtonProps = ButtonProps & {
	nodeProps: NodeProps<AnyNode>;
};

const RunNodeButton = memo(
	({ nodeProps, ...buttonProps }: RunNodeButtonProps) => {
		const { runNodes } = useCanvasCtx();

		const isNodeRunning = useNodeTaskRunning(nodeProps.id);

		return (
			<Button
				{...buttonProps}
				disabled={isNodeRunning}
				onClick={() => runNodes([nodeProps.id])}
				size="sm"
			>
				{!isNodeRunning && (
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
			</Button>
		);
	},
);

export { RunNodeButton };
