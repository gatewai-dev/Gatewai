import { forwardRef, type SVGProps } from "react";

export interface LoadingSpinnerProps extends SVGProps<SVGSVGElement> {
	color?: string;
	size?: string | number;
	className?: string;
}

const LoadingSpinner = forwardRef<SVGSVGElement, LoadingSpinnerProps>(
	({ color = "#444", size = 24, className = "", ...props }, ref) => {
		const duration = "2.5s"; // Slightly faster for better "flow"
		const activeColor = "oklch(89.992% 0.16568 110.075)";
		const colorValues = `${color}; ${activeColor}; ${color}; ${color}`;
		const keyTimes = "0; 0.15; 0.3; 1";
		const step = 0.15; // Delay between each node

		const BlinkingCircle = ({
			cx,
			cy,
			index,
		}: {
			cx: number | string;
			cy: number | string;
			index: number;
		}) => (
			<circle cx={cx} cy={cy} r="1.5" fill={color}>
				<animate
					attributeName="fill"
					values={colorValues}
					keyTimes={keyTimes}
					dur={duration}
					begin={`${index * step}s`}
					repeatCount="indefinite"
					calcMode="linear"
				/>
			</circle>
		);

		return (
			<svg
				ref={ref}
				xmlns="http://www.w3.org/2000/svg"
				width={size}
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				role="img"
				aria-label="Gatewai Loading Spinner"
				className={`gatewai-loading-spinner ${className}`}
				{...props}
			>
				{/* The "G" Path Outline (Optional: keep low opacity or remove) */}
				<g stroke={color} strokeWidth="1" strokeOpacity="0.1" fill="none">
					<path
						d="M 18 6 L 6 6 L 6 18 L 18 18 L 18 12 L 12 12"
						strokeLinecap="square"
					/>
				</g>
				{/* Sequential Nodes following the G-shape path */}
				<BlinkingCircle cx="18" cy="6" index={0} /> {/* Top Right */}
				<BlinkingCircle cx="12" cy="6" index={1} /> {/* Top Middle */}
				<BlinkingCircle cx="6" cy="6" index={2} /> {/* Top Left */}
				<BlinkingCircle cx="6" cy="12" index={3} /> {/* Middle Left */}
				<BlinkingCircle cx="6" cy="18" index={4} /> {/* Bottom Left */}
				<BlinkingCircle cx="12" cy="18" index={5} /> {/* Bottom Middle */}
				<BlinkingCircle cx="18" cy="18" index={6} /> {/* Bottom Right */}
				<BlinkingCircle cx="18" cy="12" index={7} /> {/* Middle Right */}
				<BlinkingCircle cx="12" cy="12" index={8} /> {/* Center (End of G) */}
			</svg>
		);
	},
);

LoadingSpinner.displayName = "LoadingSpinner";

export { LoadingSpinner };
