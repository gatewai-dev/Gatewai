import { motion } from "framer-motion";
import { Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { GatewaiLogo } from "@/components/ui/gatewai-logo";

interface AuthLayoutProps {
	children: ReactNode;
	title: string;
	subtitle: string;
}

// Workflow canvas animation for auth pages
const WorkflowCanvas = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const updateDimensions = () => {
			if (canvasRef.current) {
				const { width, height } = canvasRef.current.getBoundingClientRect();
				setDimensions({ width, height });
				canvasRef.current.width = width;
				canvasRef.current.height = height;
			}
		};

		updateDimensions();
		window.addEventListener("resize", updateDimensions);
		return () => window.removeEventListener("resize", updateDimensions);
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Vertical workflow nodes
		const nodes = [
			{ x: 0.5, y: 0.15, radius: 6, connections: [1] },
			{ x: 0.3, y: 0.35, radius: 5, connections: [2] },
			{ x: 0.7, y: 0.35, radius: 5, connections: [2] },
			{ x: 0.5, y: 0.55, radius: 7, connections: [3, 4] },
			{ x: 0.35, y: 0.75, radius: 5, connections: [] },
			{ x: 0.65, y: 0.75, radius: 5, connections: [] },
		];

		let animationFrame: number;
		let time = 0;

		const animate = () => {
			ctx.clearRect(0, 0, dimensions.width, dimensions.height);
			time += 0.008;

			// Draw connections
			nodes.forEach((node, i) => {
				node.connections.forEach((targetIdx) => {
					const target = nodes[targetIdx];
					const startX = node.x * dimensions.width;
					const startY = node.y * dimensions.height;
					const endX = target.x * dimensions.width;
					const endY = target.y * dimensions.height;

					// Connection line
					ctx.strokeStyle = "rgba(183, 234, 72, 0.15)";
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.moveTo(startX, startY);
					ctx.lineTo(endX, endY);
					ctx.stroke();

					// Flow particle
					const progress = (Math.sin(time + i * 0.7) + 1) / 2;
					const particleX = startX + (endX - startX) * progress;
					const particleY = startY + (endY - startY) * progress;

					ctx.fillStyle = "rgba(183, 234, 72, 0.7)";
					ctx.beginPath();
					ctx.arc(particleX, particleY, 2.5, 0, Math.PI * 2);
					ctx.fill();
				});
			});

			// Draw nodes
			nodes.forEach((node, i) => {
				const x = node.x * dimensions.width;
				const y = node.y * dimensions.height;
				const pulse = Math.sin(time * 2 + i * 0.5) * 0.2 + 1;

				// Glow
				ctx.fillStyle = "rgba(183, 234, 72, 0.1)";
				ctx.beginPath();
				ctx.arc(x, y, node.radius * pulse * 2.5, 0, Math.PI * 2);
				ctx.fill();

				// Node
				ctx.fillStyle = "rgba(183, 234, 72, 0.5)";
				ctx.beginPath();
				ctx.arc(x, y, node.radius, 0, Math.PI * 2);
				ctx.fill();

				// Highlight
				ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
				ctx.beginPath();
				ctx.arc(x, y, node.radius * 0.35, 0, Math.PI * 2);
				ctx.fill();
			});

			animationFrame = requestAnimationFrame(animate);
		};

		animate();

		return () => {
			if (animationFrame) cancelAnimationFrame(animationFrame);
		};
	}, [dimensions]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 w-full h-full"
			style={{ width: "100%", height: "100%" }}
		/>
	);
};

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
	return (
		<div
			className="relative min-h-screen flex-col items-center justify-center lg:grid lg:max-w-none lg:grid-cols-2 lg:px-0 bg-[#0a0a0f] text-white overflow-hidden"
			style={{ fontFamily: "'Outfit', sans-serif" }}
		>
			{/* Google Fonts */}
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600;700;800&family=Outfit:wght@300;400;600;700&display=swap');
			`}</style>

			{/* Left Side - Workflow Visualization */}
			<div className="relative hidden h-full flex-col bg-[#0f0a15] p-12 lg:flex border-r border-primary/10">
				{/* Animated Background */}
				<div className="absolute inset-0 overflow-hidden">
					<WorkflowCanvas />
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
				</div>

				{/* Logo */}
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6 }}
					className="relative z-20 flex items-center gap-3"
				>
					<GatewaiLogo className="size-22 text-primary" />
				</motion.div>

				{/* Content */}
				<div className="relative z-20 mt-auto space-y-6">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3, duration: 0.6 }}
					>
						<Workflow className="h-12 w-12 text-primary mb-6" />
						<h2
							className="text-4xl font-bold tracking-tight mb-4 leading-tight"
							style={{ fontFamily: "'JetBrains Mono', monospace" }}
						>
							BUILD AI
							<br />
							WORKFLOWS
							<br />
							<span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-secondary">
								VISUALLY
							</span>
						</h2>
						<p className="text-lg text-zinc-400 leading-relaxed max-w-md">
							Connect nodes. Chain operations. Deploy intelligence. The
							next-generation platform for multi-modal AI.
						</p>
					</motion.div>
				</div>
			</div>

			{/* Right Side - Form */}
			<div className="relative flex h-full min-h-screen items-center p-8 lg:p-12 bg-[#0a0a0f]">
				{/* Subtle gradient */}
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />

				{/* Back to home link */}
				<Link
					to="/"
					className="absolute top-8 left-8 text-sm text-zinc-500 hover:text-primary transition-colors flex items-center gap-2"
				>
					← Back to home
				</Link>

				<motion.div
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.7, ease: "easeOut" }}
					className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[420px]"
				>
					<div className="flex flex-col space-y-3 text-center">
						<h1
							className="text-4xl font-bold tracking-tighter text-white"
							style={{ fontFamily: "'JetBrains Mono', monospace" }}
						>
							{title}
						</h1>
						<p className="text-base text-zinc-400">{subtitle}</p>
					</div>

					{children}
				</motion.div>
			</div>
		</div>
	);
}
