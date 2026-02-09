import { forwardRef, type SVGProps } from "react";

export interface GatewaiIconProps extends SVGProps<SVGSVGElement> {
	color?: string;
	size?: string | number;
	strokeWidth?: string | number;
	className?: string;
}

const GatewaiIcon = forwardRef<SVGSVGElement, GatewaiIconProps>(
	(
		{
			color = "currentColor",
			size = 24,
			strokeWidth = 2,
			className = "",
			...props
		},
		ref,
	) => {
		const nodeRadius = 1.5;

		return (
			<svg
				ref={ref}
				xmlns="http://www.w3.org/2000/svg"
				width={size}
				role="img"
				aria-label="Gatewai Logo"
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="square"
				strokeLinejoin="miter"
				className={`lucide lucide-gatewai-logo ${className}`}
				{...props}
			>
				{/* G-shaped path structure */}
				{/* Top horizontal */}
				<path d="M 6 6 L 18 6" />

				{/* Left vertical */}
				<path d="M 6 6 L 6 18" />

				{/* Bottom horizontal */}
				<path d="M 6 18 L 18 18" />

				{/* Right vertical (partial - creating the G) */}
				<path d="M 18 18 L 18 12" />

				{/* Inner horizontal bar of G */}
				<path d="M 12 12 L 18 12" />

				{/* Connection nodes at corners and key points */}
				{/* Top left */}
				<circle cx="6" cy="6" r={nodeRadius} fill={color} stroke="none" />

				{/* Top right */}
				<circle cx="18" cy="6" r={nodeRadius} fill={color} stroke="none" />

				{/* Bottom left */}
				<circle cx="6" cy="18" r={nodeRadius} fill={color} stroke="none" />

				{/* Bottom right */}
				<circle cx="18" cy="18" r={nodeRadius} fill={color} stroke="none" />

				{/* Middle right (G opening) */}
				<circle cx="18" cy="12" r={nodeRadius} fill={color} stroke="none" />

				{/* Middle center (G bar connection) */}
				<circle cx="12" cy="12" r={nodeRadius} fill={color} stroke="none" />
			</svg>
		);
	},
);

GatewaiIcon.displayName = "GatewaiIcon";

export { GatewaiIcon };
