import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { Link } from "react-router";
import { Button } from "@gatewai/ui-kit";
import { GatewaiLogo } from "@gatewai/ui-kit";

// Node connection animation component
const NodeCanvas = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const updateDimensions = () => {
			if (canvasRef.current) {
				const { width, height } =
					canvasRef.current.parentElement?.getBoundingClientRect() || {
						width: 0,
						height: 0,
					};
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

		// Define nodes in a workflow pattern
		const nodes = [
			{ x: 0.15, y: 0.3, radius: 4, connections: [1, 2] },
			{ x: 0.35, y: 0.2, radius: 5, connections: [3] },
			{ x: 0.35, y: 0.5, radius: 5, connections: [3] },
			{ x: 0.6, y: 0.35, radius: 6, connections: [4, 5] },
			{ x: 0.8, y: 0.25, radius: 4, connections: [] },
			{ x: 0.8, y: 0.55, radius: 4, connections: [] },
		];

		let animationFrame: number;
		let time = 0;

		const animate = () => {
			ctx.clearRect(0, 0, dimensions.width, dimensions.height);
			time += 0.01;

			// Draw connections with animated flow
			nodes.forEach((node, i) => {
				node.connections.forEach((targetIdx) => {
					const target = nodes[targetIdx];
					const startX = node.x * dimensions.width;
					const startY = node.y * dimensions.height;
					const endX = target.x * dimensions.width;
					const endY = target.y * dimensions.height;

					// Draw connection line
					ctx.strokeStyle = "rgba(183, 234, 72, 0.2)";
					ctx.lineWidth = 1.5;
					ctx.beginPath();
					ctx.moveTo(startX, startY);
					ctx.lineTo(endX, endY);
					ctx.stroke();

					// Animated flow particle
					const progress = (Math.sin(time + i * 0.5) + 1) / 2;
					const particleX = startX + (endX - startX) * progress;
					const particleY = startY + (endY - startY) * progress;

					ctx.fillStyle = "rgba(183, 234, 72, 0.8)";
					ctx.beginPath();
					ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
					ctx.fill();
				});
			});

			// Draw nodes with pulse effect
			nodes.forEach((node, i) => {
				const x = node.x * dimensions.width;
				const y = node.y * dimensions.height;
				const pulse = Math.sin(time * 2 + i) * 0.3 + 1;

				// Outer glow
				ctx.fillStyle = "rgba(183, 234, 72, 0.15)";
				ctx.beginPath();
				ctx.arc(x, y, node.radius * pulse * 2, 0, Math.PI * 2);
				ctx.fill();

				// Node core
				ctx.fillStyle = "rgba(183, 234, 72, 0.8)";
				ctx.shadowBlur = 10;
				ctx.shadowColor = "rgba(183, 234, 72, 0.5)";
				ctx.beginPath();
				ctx.arc(x, y, node.radius, 0, Math.PI * 2);
				ctx.fill();
				ctx.shadowBlur = 0;

				// Inner highlight
				ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
				ctx.beginPath();
				ctx.arc(x, y, node.radius * 0.4, 0, Math.PI * 2);
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
			className="absolute inset-0 w-full h-full opacity-60"
		/>
	);
};

const HomePage = () => {
	return (
		<main
			className="relative w-full bg-background text-foreground p-4 md:p-6 md:h-screen md:min-h-[800px] md:overflow-hidden"
			style={{ fontFamily: "'Outfit', sans-serif" }}
		>
			<Helmet>
				<title>Gatewai - AI Workflow Engine</title>
			</Helmet>
			{/* Google Fonts */}
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');
				@keyframes marquee {
					0% { transform: translateX(0); }
					100% { transform: translateX(-50%); }
				}
				.animate-marquee {
					animation: marquee 20s linear infinite;
				}
			`}</style>

			{/* Grid Container */}
			<div className="md:h-full w-full grid grid-cols-1 md:grid-cols-12 md:grid-rows-12 gap-4">
				{/* 1. Header / Nav (Top Row) */}
				<div className="md:col-span-12 md:row-span-1 flex items-center justify-between px-2">
					<div className="flex items-center gap-3">
						<GatewaiLogo className="size-48 h-18 text-primary" />
					</div>
				</div>

				{/* 2. Hero Block (Top-Left, Large) */}
				<div className="md:col-span-7 md:row-span-6 bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 md:p-10 flex flex-col justify-center relative shadow-sm overflow-hidden">
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
						className="space-y-8 z-10"
					>
						<h1
							className="text-5xl md:text-6xl font-extrabold tracking-tighter leading-[0.9] text-white"
							style={{ fontFamily: "'JetBrains Mono', monospace" }}
						>
							BUILD&nbsp;
							<span className="text-primary">WORKFLOWS</span> <br />
							VISUALLY
						</h1>
						<p className="text-xl text-neutral-400 max-w-lg font-light leading-relaxed">
							The node-based vibeflow platform for multi-modal AI. Connect
							models, chain operations, and orchestrate intelligence.
						</p>

						<div className="flex flex-col sm:flex-row gap-4 pt-2">
							<Link to="/canvas">
								<Button className="h-14 px-8 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-neutral-950 border-0 shadow-lg shadow-primary/20 transition-all duration-200">
									Launch Studio <ArrowRight className="ml-2 size-5" />
								</Button>
							</Link>
							<div className="flex gap-3">
								<a
									href="https://github.com/gatewai-dev/Gatewai"
									target="_blank"
									rel="noreferrer"
								>
									<Button
										variant="outline"
										className="h-14 w-14 rounded-xl border-neutral-700 bg-neutral-800/50 hover:bg-neutral-800 hover:text-white transition-colors p-0"
									>
										<FaGithub className="size-6" />
									</Button>
								</a>
								<a
									href="https://discord.gg/ha4A8UD7kn"
									target="_blank"
									rel="noreferrer"
								>
									<Button
										variant="outline"
										className="h-14 w-14 rounded-xl border-neutral-700 bg-neutral-800/50 hover:bg-neutral-800 hover:text-white transition-colors p-0 text-[#5865F2]"
									>
										<FaDiscord className="size-6" />
									</Button>
								</a>
							</div>
						</div>
					</motion.div>

					{/* Subtle Background pattern for Hero */}
					<div
						className="absolute inset-0 opacity-[0.03] pointer-events-none"
						style={{
							backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
							backgroundSize: "32px 32px",
						}}
					/>
				</div>

				{/* 3. Visual Engine Block (Right Side, Vertical) */}
				<div className="md:col-span-5 md:row-span-10 bg-[#0A0A0A] border border-white/5 rounded-3xl relative overflow-hidden flex flex-col shadow-2xl group">
					{/* Grid Background */}
					<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

					<div className="absolute top-6 left-6 z-10 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 shadow-lg ring-1 ring-white/5">
						<div className="flex items-center gap-2">
							<div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse w-full" />
							<span className="text-xs font-mono font-semibold text-primary/90 tracking-wide">
								VISUAL GRAPH ENGINE
							</span>
						</div>
					</div>

					{/* The Animation Canvas */}
					<div className="flex-1 w-full h-full relative">
						<NodeCanvas />
						{/* Gradient Fades for integration */}
						<div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-neutral-950/80 pointer-events-none" />
					</div>

					<div className="p-8 relative z-10 mt-auto">
						<div className="bg-neutral-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-xl transform transition-transform duration-300 group-hover:translate-y-[-4px]">
							<div className="space-y-2">
								<h3 className="text-2xl font-bold text-white tracking-tight font-mono flex items-center gap-2">
									Real-time Execution{" "}
									<ArrowUpRight className="w-4 h-4 text-neutral-500" />
								</h3>
								<p className="text-neutral-400 leading-snug">
									Watch data flow between nodes instantly. Debug logic visually
									with live execution tracing and output previews.
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* 4. Feature: Hybrid Runtime (Mid-Left) */}
				<div className="md:col-span-3 md:row-span-4 bg-neutral-900/20 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between group hover:border-neutral-700 transition-colors relative overflow-hidden">
					<div className="relative z-10 space-y-4">
						{/* Mock execution pill */}
						<div className="bg-neutral-950/50 rounded-lg p-3 border border-neutral-800/50 backdrop-blur-sm">
							<div className="flex items-center gap-2 mb-2">
								<div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
								<span className="text-[10px] font-mono text-neutral-400">
									EXECUTION_MODE
								</span>
							</div>
							<div className="space-y-1.5">
								<div className="flex justify-between text-[10px] font-mono">
									<span className="text-neutral-500">CLIENT</span>
									<span className="text-primary">ACTIVE</span>
								</div>
								<div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
									<div className="h-full w-2/3 bg-primary rounded-full"></div>
								</div>
								<div className="flex justify-between text-[10px] font-mono pt-1">
									<span className="text-neutral-500">CLOUD</span>
									<span className="text-neutral-600">IDLE</span>
								</div>
								<div className="h-1 w-full bg-neutral-800 rounded-full overflow-hidden">
									<div className="h-full w-0 bg-neutral-700 rounded-full"></div>
								</div>
							</div>
						</div>
					</div>
					<div>
						<h3 className="text-lg font-bold text-white mb-2 font-mono">
							Hybrid Runtime
						</h3>
						<p className="text-sm text-neutral-500 leading-relaxed">
							Execute lightweight logic in-browser. Offload heavy generation
							tasks to the cloud seamlessly.
						</p>
					</div>
				</div>

				{/* 5. Feature: Agent (Mid-Center) */}
				<div className="md:col-span-4 md:row-span-4 bg-neutral-900/20 border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between group hover:border-neutral-700 transition-colors relative overflow-hidden">
					<div className="relative z-10 flex flex-col gap-3">
						{/* Chat Interface */}
						<div className="space-y-3 font-mono text-[10px] leading-tight">
							{/* User Message */}
							<div className="bg-neutral-800/50 self-end rounded-2xl rounded-tr-sm p-3 ml-8 border border-neutral-700/50">
								<p className="text-neutral-300">
									Create a parfume advertisement generator workflow.
								</p>
							</div>

							{/* AI Response with Typing Effect */}
							<div className="bg-primary/10 self-start rounded-2xl rounded-tl-sm p-3 mr-8 border border-primary/20">
								<p className="text-primary typing-effect">
									Sure! compiling nodes...
								</p>
							</div>
						</div>
					</div>
					<div>
						<h3 className="text-lg font-bold text-white mb-2 font-mono">
							Workflow Agent
						</h3>
						<p className="text-sm text-neutral-500 leading-relaxed">
							Don't just drag nodes. Describe your intent and let the Workflow
							Agent architect the perfect workflow for you.
						</p>
					</div>

					{/* CSS for typing effect */}
					<style>{`
						.typing-effect {
							overflow: hidden;
							white-space: nowrap;
							border-right: 2px solid transparent;
							width: 0;
							animation: typing 2.5s steps(30, end) forwards infinite alternate, blink .75s step-end infinite;
							animation-delay: 1s;
						}
						@keyframes typing {
							0% { width: 0 }
							30% { width: 0 } /* Pause before typing */
							100% { width: 100% }
						}
					`}</style>
				</div>

				{/* 6. Tech Stack Ticker (Bottom Row, Left) */}
				<div className="md:col-span-7 md:row-span-1 flex items-center px-4 overflow-hidden border-t md:border-t-0 border-neutral-800/50 pt-4 md:pt-0">
					<div className="flex items-center gap-2 text-xs font-mono text-neutral-600 mr-6 whitespace-nowrap z-10 bg-background/95 pr-2">
						<Terminal className="size-3" /> POWERED BY
					</div>
					{/* Marquee Wrapper with masking */}
					<div className="flex-1 overflow-hidden relative mask-linear-fade">
						<div className="flex items-center gap-8 animate-marquee whitespace-nowrap opacity-40 hover:opacity-100 transition-opacity duration-300">
							<span className="font-semibold text-lg">Gemini 3</span>
							<span className="font-semibold text-lg">Veo</span>
							<span className="font-semibold text-lg">React Flow</span>
							<span className="font-semibold text-lg">PixiJS</span>
							<span className="font-semibold text-lg">Hono</span>
							<span className="font-semibold text-lg">Nano Banana</span>
							<span className="font-semibold text-lg">Veo</span>
							<span className="font-semibold text-lg">Remotion</span>
							<span className="font-semibold text-lg">Konva</span>
							{/* Duplicate for seamless loop */}
							<span className="font-semibold text-lg">Gemini 3</span>
							<span className="font-semibold text-lg">Veo</span>
							<span className="font-semibold text-lg">React Flow</span>
							<span className="font-semibold text-lg">PixiJS</span>
							<span className="font-semibold text-lg">Hono</span>
							<span className="font-semibold text-lg">Nano Banana</span>
							<span className="font-semibold text-lg">Veo</span>
							<span className="font-semibold text-lg">Remotion</span>
							<span className="font-semibold text-lg">Konva</span>
						</div>
					</div>
				</div>

				{/* 7. Footer (Bottom Row, Right) */}
				<div className="md:col-span-5 md:row-span-1 flex items-center justify-between px-6 border-t border-neutral-800 text-xs text-neutral-600 font-mono">
					<span>© 2026 GATEWAI STUDIO</span>
					<div className="flex gap-4">
						<a href="#" className="hover:text-primary transition-colors">
							TERMS
						</a>
						<a href="#" className="hover:text-primary transition-colors">
							PRIVACY
						</a>
					</div>
				</div>
			</div>
		</main>
	);
};

export { HomePage };
