import { GatewaiLogo } from "@gatewai/ui-kit";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

interface AuthLayoutProps {
	children: ReactNode;
	title: string;
	subtitle: string;
}

const GridCanvas = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrame: number;
		let time = 0;

		const resize = () => {
			canvas.width = canvas.offsetWidth;
			canvas.height = canvas.offsetHeight;
		};

		resize();
		window.addEventListener("resize", resize);

		const animate = () => {
			const { width, height } = canvas;
			ctx.clearRect(0, 0, width, height);
			time += 0.004;

			const cols = 8;
			const rows = 12;
			const cellW = width / cols;
			const cellH = height / rows;

			for (let r = 0; r <= rows; r++) {
				for (let c = 0; c <= cols; c++) {
					const x = c * cellW;
					const y = r * cellH;

					// Subtle wave distortion per intersection
					const wave = Math.sin(time + c * 0.6 + r * 0.4) * 0.5 + 0.5;
					const alpha = wave * 0.12 + 0.03;

					// Dot at intersection
					ctx.beginPath();
					ctx.arc(x, y, 1.2, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(183, 234, 72, ${alpha})`;
					ctx.fill();
				}
			}

			// Horizontal lines
			for (let r = 0; r <= rows; r++) {
				const y = r * cellH;
				const wave = Math.sin(time * 0.7 + r * 0.5) * 0.5 + 0.5;
				ctx.strokeStyle = `rgba(183, 234, 72, ${wave * 0.06 + 0.02})`;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(0, y);
				ctx.lineTo(width, y);
				ctx.stroke();
			}

			// Vertical lines
			for (let c = 0; c <= cols; c++) {
				const x = c * cellW;
				const wave = Math.sin(time * 0.9 + c * 0.6) * 0.5 + 0.5;
				ctx.strokeStyle = `rgba(183, 234, 72, ${wave * 0.06 + 0.02})`;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.moveTo(x, 0);
				ctx.lineTo(x, height);
				ctx.stroke();
			}

			// Single traveling highlight dot
			const tx = (Math.sin(time * 0.8) * 0.5 + 0.5) * width;
			const ty = (Math.sin(time * 0.5 + 1.2) * 0.5 + 0.5) * height;
			const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, 160);
			grad.addColorStop(0, "rgba(183, 234, 72, 0.12)");
			grad.addColorStop(1, "rgba(183, 234, 72, 0)");
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, width, height);

			animationFrame = requestAnimationFrame(animate);
		};

		animate();

		return () => {
			window.removeEventListener("resize", resize);
			cancelAnimationFrame(animationFrame);
		};
	}, []);

	return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
	return (
		<div
			className="min-h-screen flex bg-[#09090c] text-white overflow-hidden"
			style={{ fontFamily: "'Outfit', sans-serif" }}
		>
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Outfit:wght@300;400;500&display=swap');
			`}</style>

			{/* ── Left panel ── */}
			<div className="relative hidden lg:flex lg:w-[46%] flex-col justify-between p-14 border-r border-white/[0.06] overflow-hidden">
				<GridCanvas />

				{/* Vignette bottom-left */}
				<div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#09090c] to-transparent pointer-events-none" />

				{/* Logo */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 1 }}
					className="relative z-10"
				>
					<GatewaiLogo className="h-7 w-auto text-white" />
				</motion.div>

				{/* Bottom copy */}
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
					className="relative z-10 space-y-5"
				>
					<p className="text-[11px] tracking-[0.2em] uppercase text-white/25 font-medium">
						Unleash your creativity
					</p>

					<h2 className="text-[2.6rem] font-bold leading-[1.1] tracking-tight">
						Multi-modal & Agentic
						<br />
						<span className="text-[#b7ea48]">infinite canvas.</span>
					</h2>

					<p className="text-sm text-white/35 leading-relaxed max-w-[260px] font-light">
						Connect nodes, chain operations, and create living canvases using
						the help of AI.
					</p>
				</motion.div>
			</div>

			{/* ── Right panel ── */}
			<div className="relative flex flex-1 flex-col items-center justify-center px-8 py-16">
				{/* Radial glow */}
				<div className="absolute top-0 right-0 w-[480px] h-[480px] bg-[#b7ea48]/[0.04] rounded-full blur-[100px] pointer-events-none -translate-y-1/3 translate-x-1/3" />

				<Link
					to="/"
					className="absolute top-8 left-8 text-[11px] tracking-widest uppercase text-white/25 hover:text-white/60 transition-colors duration-300"
				>
					← Home
				</Link>

				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.7, ease: "easeOut" }}
					className="w-full max-w-[360px] space-y-10"
				>
					{/* Heading */}
					<div className="space-y-2">
						<h1
							className="text-3xl font-bold tracking-tight text-white"
							style={{ fontFamily: "'JetBrains Mono', monospace" }}
						>
							{title}
						</h1>
						<p className="text-sm text-white/35 font-light">{subtitle}</p>
					</div>

					{/* Divider */}
					<div className="h-px w-full bg-white/[0.06]" />

					{/* Form slot */}
					{children}
				</motion.div>
			</div>
		</div>
	);
}
