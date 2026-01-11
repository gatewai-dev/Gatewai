import { forwardRef, type SVGProps } from "react";

// 1. Define the interface for your custom props
export interface YodesLogoProps extends SVGProps<SVGSVGElement> {
	color?: string;
	size?: string | number;
	strokeWidth?: string | number;
	className?: string;
}

const YodesLogo = forwardRef<SVGSVGElement, YodesLogoProps>(
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
		return (
			<svg
				ref={ref}
				xmlns="http://www.w3.org/2000/svg"
				width={size}
				role="img"
				aria-label="Yodes Logo"
				height={size}
				viewBox="0 0 24 24"
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				className={`lucide lucide-yodes-logo ${className}`}
				{...props}
			>
				{/* Top Left Square */}
				<rect
					x="3"
					y="3"
					width="4"
					height="4"
					rx="1"
					fill="currentColor"
					stroke="none"
				/>

				{/* Top Right Square */}
				<rect
					x="17"
					y="3"
					width="4"
					height="4"
					rx="1"
					fill="currentColor"
					stroke="none"
				/>

				{/* Bottom Center Square */}
				<rect
					x="10"
					y="17"
					width="4"
					height="4"
					rx="1"
					fill="currentColor"
					stroke="none"
				/>

				{/* "Y" Workflow Paths */}
				<path d="M6 6 L12 12" />
				<path d="M18 6 L12 12" />
				<path d="M12 12 L12 18" />

				{/* Central AI Node Accent */}
				<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
			</svg>
		);
	},
);

YodesLogo.displayName = "YodesLogo";

export { YodesLogo };
