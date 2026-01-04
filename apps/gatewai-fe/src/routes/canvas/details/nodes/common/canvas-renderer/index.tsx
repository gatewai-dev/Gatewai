import { forwardRef, memo, useImperativeHandle, useRef } from "react";
import { useDrawToCanvas } from "../../../hooks/use-draw-to-canvas";
import { imageStore } from "../../../processor/image-store";

interface CanvasRendererProps {
	resultHash?: string;
	imageUrl?: string;
}

const CanvasRenderer = memo(
	forwardRef<HTMLCanvasElement, CanvasRendererProps>(
		({ resultHash, imageUrl }, ref) => {
			const internalRef = useRef<HTMLCanvasElement | null>(null);
			// Sync the forwarded ref with our internal ref
			useImperativeHandle(ref, () => internalRef.current!);
			// Get the calculated height from the hook
			const imageUrlToRender =
				imageUrl ??
				(resultHash ? imageStore.getDataUrlForHash(resultHash) : null);
			const { renderHeight } = useDrawToCanvas(internalRef, imageUrlToRender);

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
		},
	),
);

CanvasRenderer.displayName = "CanvasRenderer";

export { CanvasRenderer };
