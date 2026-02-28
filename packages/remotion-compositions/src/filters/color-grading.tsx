import React from "react";

interface ColorGradingProps {
	brightness?: number;
	contrast?: number;
	saturation?: number;
	hueRotate?: number;
	children: React.ReactNode;
}

/**
 * Advanced color grading using SVG filters.
 * Values are expected as percentages (e.g., 100 for 1.0).
 */
export const ColorGrading: React.FC<ColorGradingProps> = ({
	brightness = 100,
	contrast = 100,
	saturation = 100,
	hueRotate = 0,
	children,
}) => {
	const id = React.useId();

	// Saturation matrix
	const s = saturation / 100;
	const lumR = 0.2126;
	const lumG = 0.7152;
	const lumB = 0.0722;
	const satMat = [
		lumR * (1 - s) + s,
		lumG * (1 - s),
		lumB * (1 - s),
		0,
		0,
		lumR * (1 - s),
		lumG * (1 - s) + s,
		lumB * (1 - s),
		0,
		0,
		lumR * (1 - s),
		lumG * (1 - s),
		lumB * (1 - s) + s,
		0,
		0,
		0,
		0,
		0,
		1,
		0,
	].join(" ");

	return (
		<div style={{ position: "relative", width: "100%", height: "100%" }}>
			<svg style={{ position: "absolute", width: 0, height: 0 }}>
				<filter id={id}>
					<feColorMatrix type="hueRotate" values={hueRotate.toString()} />
					<feColorMatrix type="matrix" values={satMat} />
					<feComponentTransfer>
						<feFuncR
							type="linear"
							slope={contrast / 100}
							intercept={
								-((0.5 * contrast) / 100) + 0.5 + (brightness - 100) / 100
							}
						/>
						<feFuncG
							type="linear"
							slope={contrast / 100}
							intercept={
								-((0.5 * contrast) / 100) + 0.5 + (brightness - 100) / 100
							}
						/>
						<feFuncB
							type="linear"
							slope={contrast / 100}
							intercept={
								-((0.5 * contrast) / 100) + 0.5 + (brightness - 100) / 100
							}
						/>
					</feComponentTransfer>
				</filter>
			</svg>
			<div style={{ filter: `url(#${id})`, width: "100%", height: "100%" }}>
				{children}
			</div>
		</div>
	);
};
