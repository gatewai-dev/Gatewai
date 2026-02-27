import { forwardRef, memo } from "react";

interface SVGRendererProps {
	imageUrl?: string;
	width?: number;
	height?: number;
}

const SVGRenderer = memo(
	forwardRef<HTMLImageElement, SVGRendererProps>(
		({ imageUrl, width, height }, ref) => {
			if (!imageUrl) return null;

			return (
				<img
					ref={ref}
					src={imageUrl}
					className="w-full flex pointer-events-none"
					style={{
						height: height ? `${height}px` : "auto",
						objectFit: "contain",
					}}
					alt="SVG Layer"
				/>
			);
		},
	),
);

export { SVGRenderer };
