import { HiOutlineSparkles } from "react-icons/hi2";
import { cn } from "../lib/utils";

interface SparklesIconProps {
	className?: string;
	iconClassName?: string;
	size?: "sm" | "md" | "lg";
}

const PARTICLES = [
	{ top: "-8%", left: "60%", delay: "0s", dur: "2.4s", size: "2px" },
	{ top: "60%", left: "-8%", delay: "0.4s", dur: "2.8s", size: "1.5px" },
	{ top: "-6%", left: "20%", delay: "0.8s", dur: "2.2s", size: "1.5px" },
	{ top: "70%", left: "85%", delay: "1.2s", dur: "3s", size: "2px" },
	{ top: "20%", left: "95%", delay: "0.6s", dur: "2.6s", size: "1px" },
	{ top: "85%", left: "30%", delay: "1.6s", dur: "2s", size: "1px" },
];

export function SparklesIcon({
	className,
	iconClassName,
	size = "md",
}: SparklesIconProps) {
	const sizeMap = {
		sm: { wrap: "size-5", icon: "size-3", blur: "6px", spread: "4px" },
		md: { wrap: "size-7", icon: "size-4", blur: "10px", spread: "6px" },
		lg: { wrap: "size-10", icon: "size-5.5", blur: "14px", spread: "8px" },
	};

	const s = sizeMap[size];

	return (
		<>
			<style>{`
                @keyframes aurora-spin {
                    0%   { transform: rotate(0deg) scale(1.1); }
                    100% { transform: rotate(360deg) scale(1.1); }
                }
                @keyframes shimmer-sweep {
                    0%   { transform: translateX(-120%) skewX(-15deg); opacity: 0; }
                    40%  { opacity: 0.6; }
                    100% { transform: translateX(220%) skewX(-15deg); opacity: 0; }
                }
                @keyframes icon-breathe {
                    0%, 100% { opacity: 0.92; transform: scale(1) rotate(-4deg); }
                    50%      { opacity: 1;    transform: scale(1.1) rotate(4deg); }
                }
                @keyframes particle-rise {
                    0%   { transform: translateY(0)   scale(1);    opacity: 0; }
                    20%  { opacity: 1; }
                    80%  { opacity: 0.7; }
                    100% { transform: translateY(-28px) scale(0.2); opacity: 0; }
                }
                @keyframes outer-glow-pulse {
                    0%, 100% { opacity: 0.4; }
                    50%      { opacity: 0.65; }
                }
            `}</style>

			<div
				className={cn(
					"relative inline-flex items-center justify-center",
					className,
				)}
			>
				{/* Outer soft glow halo */}
				<div
					className="absolute inset-0 rounded-full pointer-events-none"
					style={{
						background:
							"radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, hsl(var(--primary) / 0.08) 55%, transparent 75%)",
						transform: "scale(1.2)",
						animation: "outer-glow-pulse 3s ease-in-out infinite",
					}}
				/>

				{/* Floating particles */}
				{PARTICLES.map((p, i) => (
					<span
						key={i}
						className="absolute rounded-full pointer-events-none"
						style={{
							top: p.top,
							left: p.left,
							width: p.size,
							height: p.size,
							background: `hsl(var(--primary) / ${i % 2 === 0 ? "0.9" : "0.6"})`,
							boxShadow: `0 0 3px 1px hsl(var(--primary) / 0.4)`,
							animation: `particle-rise ${p.dur} ${p.delay} ease-out infinite`,
						}}
					/>
				))}

				{/* Main pill */}
				<div
					className={cn(
						"relative flex items-center justify-center rounded-full overflow-hidden",
						s.wrap,
					)}
					style={{
						background: "hsl(var(--background))",
						boxShadow: `0 0 0 1px hsl(var(--primary) / 0.2), 0 0 ${s.spread} ${s.blur} hsl(var(--primary) / 0.2), inset 0 1px 0 rgba(255,255,255,0.06)`,
					}}
				>
					{/* Subtle aurora ring — reduced opacity */}
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							background:
								"conic-gradient(from 0deg, hsl(var(--primary) / 0.35), hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.35))",
							animation: "aurora-spin 5s linear infinite",
							transformOrigin: "center",
							opacity: 0.5,
						}}
					/>

					{/* Frosted inner circle */}
					<div
						className="absolute inset-[1.5px] rounded-full pointer-events-none bg-background"
						style={{ backdropFilter: "blur(2px)" }}
					/>

					{/* Shimmer sweep */}
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							background:
								"linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)",
							animation: "shimmer-sweep 4s ease-in-out infinite",
						}}
					/>

					{/* Icon */}
					<HiOutlineSparkles
						className={cn("relative z-10 text-primary", s.icon, iconClassName)}
						style={{
							filter: "drop-shadow(0 0 3px hsl(var(--primary) / 0.6))",
							animation: "icon-breathe 3s ease-in-out infinite",
						}}
					/>
				</div>
			</div>
		</>
	);
}
