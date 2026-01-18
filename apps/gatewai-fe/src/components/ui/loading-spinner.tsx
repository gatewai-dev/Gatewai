import { forwardRef, type SVGProps } from "react";

export interface LoadingSpinnerProps extends SVGProps<SVGSVGElement> {
	color?: string;
	size?: string | number;
	className?: string;
}

const LoadingSpinner = forwardRef<SVGSVGElement, LoadingSpinnerProps>(
	(
		{
			color = "#444", // Default gray color
			size = 24,
			className = "",
			...props
		},
		ref,
	) => {
		const duration = "3s";
		const activeColor = "oklch(89.992% 0.16568 110.075)";

		// The values now transition from the base color to active, then back.
		const colorValues = `${color}; ${activeColor}; ${color}; ${color}`;
		const keyTimes = "0; 0.15; 0.3; 1";
		const step = 0.2;

		const BlinkingCircle = ({
			cx,
			cy,
			index,
		}: {
			cx: string;
			cy: string;
			index: number;
		}) => (
			<circle cx={cx} cy={cy} r="2.5" fill={color}>
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
				aria-label="Gatewai Sequential Blinking Logo"
				className={`gatewai-logo ${className}`}
				{...props}
			>
				<BlinkingCircle cx="19" cy="5" index={0} />
				<BlinkingCircle cx="12" cy="5" index={1} />
				<BlinkingCircle cx="5" cy="5" index={2} />
				<BlinkingCircle cx="5" cy="12" index={3} />
				<BlinkingCircle cx="5" cy="19" index={4} />
				<BlinkingCircle cx="12" cy="19" index={5} />
				<BlinkingCircle cx="19" cy="19" index={6} />
				<BlinkingCircle cx="19" cy="12" index={7} />
				<BlinkingCircle cx="12" cy="12" index={8} />
			</svg>
		);
	},
);

LoadingSpinner.displayName = "LoadingSpinner";

export { LoadingSpinner };
