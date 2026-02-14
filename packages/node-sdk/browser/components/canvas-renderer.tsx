import type React from "react";
import { useNodeUI } from "../ui.js";

export interface CanvasRendererProps {
	imageUrl: string;
}

export const CanvasRenderer = (props: CanvasRendererProps) => {
	const { CanvasRenderer: HostCanvasRenderer } = useNodeUI();
	return <HostCanvasRenderer {...props} />;
};
