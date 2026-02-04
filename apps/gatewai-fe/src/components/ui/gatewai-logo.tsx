import { forwardRef, type SVGProps } from "react";

export interface GatewaiLogoProps extends SVGProps<SVGSVGElement> {
	color?: string;
	size?: string | number;
	strokeWidth?: string | number;
	className?: string;
}

const GatewaiLogo = forwardRef<SVGSVGElement, GatewaiLogoProps>(
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
		const nodeRadius = 1.4;

		// Internal helper for circuit nodes
		const Node = (cx: number, cy: number) => (
			<circle cx={cx} cy={cy} r={nodeRadius} fill={color} stroke="none" />
		);

		// Letter G (0-14)
		const g = {
			outer: { left: 2, right: 14, top: 6, bottom: 18 },
			inner: { mid: 12, hinge: 8 },
		};

		// Letter A (18-30)
		const a1 = {
			base: { left: 18, right: 30, y: 18 },
			apex: { x: 24, y: 6 },
			crossbar: { y: 13, inset: 2 },
		};

		// Letter T (34-44)
		const t = {
			top: { left: 29, right: 41, y: 6 },
			stem: { x: 36, bottom: 18 },
		};

		// Letter E (48-58)
		const e = {
			spine: { x: 45, top: 6, bottom: 18 },
			bars: { right: 57, midY: 12 },
		};

		// Letter W (62-76)
		const w = {
			left: 61,
			right: 75,
			top: 6,
			bottom: 18,
			v: { left: 63, mid: 68, right: 71, peak: 13 },
		};

		// Letter A (80-92)
		const a2 = {
			base: { left: 79, right: 91, y: 18 },
			apex: { x: 83, y: 6 },
			crossbar: { y: 13, inset: 2 },
		};

		// Letter I (96-98)
		const i = {
			x: 96,
			top: 7,
			bottom: 18,
			dot: 2,
		};

		return (
			<svg
				ref={ref}
				xmlns="http://www.w3.org/2000/svg"
				width={size}
				height={typeof size === "number" ? size * 0.2 : size}
				viewBox="0 0 100 24"
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				strokeLinecap="round"
				strokeLinejoin="round"
				role="img"
				aria-label="Gatewai Logo"
				className={`gatewai-logo ${className}`}
				style={{ display: "block", maxWidth: "100%" }}
				{...props}
			>
				{/* G */}
				<path
					d={`M ${g.outer.right} ${g.outer.top} H ${g.outer.left} V ${g.outer.bottom} H ${g.outer.right} V ${g.inner.mid} H ${g.inner.hinge}`}
				/>
				{Node(g.outer.right, g.outer.top)}
				{Node(g.outer.left, g.outer.top)}
				{Node(g.outer.left, g.outer.bottom)}
				{Node(g.outer.right, g.outer.bottom)}
				{Node(g.outer.right, g.inner.mid)}
				{Node(g.inner.hinge, g.inner.mid)}

				{/* A1 */}
				<path
					d={`M ${a1.base.left} ${a1.base.y} L ${a1.apex.x} ${a1.apex.y} L ${a1.base.right} ${a1.base.y}`}
				/>
				<path
					d={`M ${a1.base.left + a1.crossbar.inset} ${a1.crossbar.y} H ${a1.base.right - a1.crossbar.inset}`}
				/>
				{Node(a1.base.left, a1.base.y)}
				{Node(a1.apex.x, a1.apex.y)}
				{Node(a1.base.right, a1.base.y)}
				{Node(a1.base.left + a1.crossbar.inset, a1.crossbar.y)}
				{Node(a1.base.right - a1.crossbar.inset, a1.crossbar.y)}

				{/* T */}
				<path
					d={`M ${t.top.left} ${t.top.y} H ${t.top.right} M ${t.stem.x} ${t.top.y} V ${t.stem.bottom}`}
				/>
				{Node(t.top.left, t.top.y)}
				{Node(t.top.right, t.top.y)}
				{Node(t.stem.x, t.top.y)}
				{Node(t.stem.x, t.stem.bottom)}

				{/* E */}
				<path
					d={`M ${e.bars.right} ${e.spine.top} H ${e.spine.x} V ${e.spine.bottom} H ${e.bars.right} M ${e.spine.x} ${e.bars.midY} H ${e.bars.right}`}
				/>
				{Node(e.spine.x, e.spine.top)}
				{Node(e.bars.right, e.spine.top)}
				{Node(e.spine.x, e.bars.midY)}
				{Node(e.bars.right, e.bars.midY)}
				{Node(e.spine.x, e.spine.bottom)}
				{Node(e.bars.right, e.spine.bottom)}

				{/* W */}
				<path
					d={`M ${w.left} ${w.top} L ${w.v.left} ${w.bottom} L ${w.v.mid} ${w.v.peak} L ${w.v.right} ${w.bottom} L ${w.right} ${w.top}`}
				/>
				{Node(w.left, w.top)}
				{Node(w.v.left, w.bottom)}
				{Node(w.v.mid, w.v.peak)}
				{Node(w.v.right, w.bottom)}
				{Node(w.right, w.top)}

				{/* A2 */}
				<path
					d={`M ${a2.base.left} ${a2.base.y} L ${a2.apex.x} ${a2.apex.y} L ${a2.base.right} ${a2.base.y}`}
				/>
				<path
					d={`M ${a2.base.left + a2.crossbar.inset} ${a2.crossbar.y} H ${a2.base.right - a2.crossbar.inset}`}
				/>
				{Node(a2.base.left, a2.base.y)}
				{Node(a2.apex.x, a2.apex.y)}
				{Node(a2.base.right, a2.base.y)}
				{Node(a2.base.left + a2.crossbar.inset, a2.crossbar.y)}
				{Node(a2.base.right - a2.crossbar.inset, a2.crossbar.y)}

				{/* I */}
				<path d={`M ${i.x} ${i.top} V ${i.bottom}`} />
				{Node(i.x, i.dot)}
				{Node(i.x, i.top)}
				{Node(i.x, i.bottom)}
			</svg>
		);
	},
);

GatewaiLogo.displayName = "GatewaiLogo";

export { GatewaiLogo };
