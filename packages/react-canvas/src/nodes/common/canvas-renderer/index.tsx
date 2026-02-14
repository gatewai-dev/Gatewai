import { useDrawToCanvas } from "@gatewai/media";
import { forwardRef, memo, useImperativeHandle, useRef } from "react";

interface CanvasRendererProps {
	imageUrl?: string;
}

const CanvasRenderer = memo(
	forwardRef<HTMLCanvasElement, CanvasRendererProps>(({ imageUrl }, ref) => {
		const internalRef = useRef<HTMLCanvasElement | null>(null);
		// Sync the forwarded ref with our internal ref
		// biome-ignore lint/style/noNonNullAssertion: Not important
		useImperativeHandle(ref, () => internalRef.current!);
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
