import { forwardRef, memo, useImperativeHandle, useRef } from "react";
import { useDrawToCanvas } from "../../../hooks/use-draw-to-canvas";

interface CanvasRendererProps {
	imageUrl: string;
}

const CanvasRenderer = memo(
	forwardRef<HTMLCanvasElement, CanvasRendererProps>(({ imageUrl }, ref) => {
		const internalRef = useRef<HTMLCanvasElement | null>(null);

		// Sync the forwarded ref with our internal ref
		useImperativeHandle(ref, () => internalRef.current!);
		// Get the calculated height from the hook
		const { renderHeight } = useDrawToCanvas(internalRef, imageUrl);

		return (
			<canvas
				ref={internalRef}
				className="w-full flex"
				height={renderHeight}
				style={{
					height: renderHeight ? `${renderHeight}px` : "auto",
				}}
			/>
		);
	}),
);

CanvasRenderer.displayName = "CanvasRenderer";

export { CanvasRenderer };
