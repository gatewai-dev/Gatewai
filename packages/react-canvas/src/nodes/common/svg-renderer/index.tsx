import { forwardRef, memo } from "react";

interface SVGRendererProps {
	imageUrl?: string;
}

const SVGRenderer = memo(
	forwardRef<HTMLImageElement, SVGRendererProps>(({ imageUrl }, ref) => {
		if (!imageUrl) return null;

		return (
			<img
				ref={ref}
				src={imageUrl}
				className="w-full flex pointer-events-none"
				style={{
					objectFit: "contain",
				}}
				alt="SVG Layer"
			/>
		);
	}),
);

export { SVGRenderer };
