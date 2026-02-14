import type React from "react";
import { useNodeUI } from "../ui.js";

export interface NodeFrameProps {
	id: string;
	children?: React.ReactNode;
	className?: string;
	selected?: boolean;
	dragging?: boolean;
}

export const NodeFrame = ({ id, children, ...props }: NodeFrameProps) => {
	const { BaseNode: HostBaseNode } = useNodeUI();
	return (
		<HostBaseNode id={id} {...props}>
			{children}
		</HostBaseNode>
	);
};
