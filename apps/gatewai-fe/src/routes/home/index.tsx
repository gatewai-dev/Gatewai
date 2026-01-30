import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, GitBranch, Sparkles, Workflow } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SiDiscord, SiGithub } from "react-icons/si";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { GatewaiLogo } from "@/components/ui/gatewai-logo";

// Node connection animation component
const NodeCanvas = () => {
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
				ctx.fillStyle = "rgba(183, 234, 72, 0.6)";
				ctx.beginPath();
				ctx.arc(x, y, node.radius, 0, Math.PI * 2);
				ctx.fill();

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
			className="absolute inset-0 w-full h-full opacity-40"
			style={{ width: "100%", height: "100%" }}
		/>
	);
};

const HomePage = () => {
	const targetRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: targetRef,
		offset: ["start start", "end start"],
	});

	const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);

	return (
		<main
			ref={targetRef}
			className="relative min-h-screen w-full overflow-x-hidden bg-[#0a0a0f] text-white selection:bg-violet-500/30"
			style={{ fontFamily: "'Outfit', sans-serif" }}
		>
			{/* Google Fonts */}
			<style>{`
				@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700;800&family=Outfit:wght@300;400;600;700&display=swap');
			`}</style>

			{/* Navbar */}
			<nav className="fixed top-0 left-0 right-0 z-50 flex h-20 items-center justify-between border-b border-primary/10 bg-[#0a0a0f]/90 px-8 backdrop-blur-xl">
				<div className="flex items-center gap-3">
					<GatewaiLogo className="size-20 text-primary" />
				</div>
				<div className="flex items-center gap-4">
					<a
						href="https://github.com/gatewai-dev/Gatewai"
						target="_blank"
						rel="noreferrer"
						className="text-zinc-400 hover:text-primary transition-colors"
					>
						<SiGithub className="h-5 w-5" />
					</a>
					<a
						href="https://discord.gg/ha4A8UD7kn"
						target="_blank"
						rel="noreferrer"
						className="text-zinc-400 hover:text-primary transition-colors"
					>
						<SiDiscord className="h-5 w-5" />
					</a>
					<Link to="/auth/signin">
						<Button
							variant="ghost"
							className="text-primary/80 hover:text-primary hover:bg-primary/10"
						>
							Sign In
						</Button>
					</Link>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20">
				{/* Animated Canvas Background */}
				<motion.div
					style={{ y }}
					className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
				>
					<NodeCanvas />
					<div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/20 blur-[150px]" />
					<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
				</motion.div>

				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 1 }}
					className="relative z-10 flex flex-col items-center max-w-6xl text-center space-y-10"
				>
					{/* Badge */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2, duration: 0.6 }}
						className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-5 py-2 backdrop-blur-sm"
					>
						<Sparkles className="h-4 w-4 text-primary" />
						<span
							className="text-xs font-bold uppercase tracking-[0.2em] text-primary/80"
							style={{ fontFamily: "'JetBrains Mono', monospace" }}
						>
							Alpha v0.0
						</span>
					</motion.div>

					{/* Main Title */}
					<motion.h1
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
						className="text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter leading-[0.9]"
						style={{ fontFamily: "'JetBrains Mono', monospace" }}
					>
						BUILD
						<br />
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary">
							WORKFLOWS
						</span>
						<br />
						VISUALLY
					</motion.h1>

					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.6, duration: 0.6 }}
						className="text-xl md:text-2xl text-zinc-400 max-w-3xl font-light leading-relaxed"
					>
						Node-based canvas for multi-modal AI. Connect models, chain
						operations, and orchestrate intelligence with precision.
					</motion.p>

					{/* CTA Buttons */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.8, duration: 0.6 }}
						className="flex flex-col sm:flex-row items-center gap-5 pt-6"
					>
						<Link to="/canvas">
							<Button
								size="lg"
								className="h-16 px-10 text-lg font-semibold rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-2xl shadow-primary/40 hover:shadow-primary/60 transition-all duration-300 group border-0"
							>
								Launch Studio
								<ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
							</Button>
						</Link>
					</motion.div>
				</motion.div>
			</section>

			{/* Features Grid */}
			<section className="relative z-10 py-32 px-6 md:px-12 max-w-7xl mx-auto">
				<motion.div
					initial={{ opacity: 0, y: 40 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-100px" }}
					transition={{ duration: 0.8 }}
					className="text-center mb-20"
				>
					<h2
						className="text-5xl md:text-6xl font-bold tracking-tighter mb-4"
						style={{ fontFamily: "'JetBrains Mono', monospace" }}
					>
						WORKFLOW ENGINE
					</h2>
					<p className="text-xl text-zinc-500">
						Designed for the next generation of AI builders
					</p>
				</motion.div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					<FeatureCard
						icon={<Workflow className="h-8 w-8" />}
						title="Visual Graph"
						description="Drag, drop, connect. Build complex AI pipelines without writing boilerplate code."
						delay={0.1}
						color="violet"
					/>
					<FeatureCard
						icon={<GitBranch className="h-8 w-8" />}
						title="Hybrid Runtime"
						description="Gatewai has an headless backend. Run workflows wherever you want - in browser or backend only."
						delay={0.2}
						color="fuchsia"
					/>
					<FeatureCard
						icon={<Sparkles className="h-8 w-8" />}
						title="Live Preview"
						description="See outputs in real-time. Iterate faster with instant visual feedback loops."
						delay={0.3}
						color="purple"
					/>
				</div>
			</section>

			{/* Footer */}
			<footer className="relative z-10 py-16 text-center text-sm text-zinc-600 border-t border-violet-500/10">
				<p
					className="font-semibold tracking-wider"
					style={{ fontFamily: "'JetBrains Mono', monospace" }}
				>
					© 2026 GATEWAI STUDIO
				</p>
			</footer>
		</main>
	);
};

const FeatureCard = ({
	icon,
	title,
	description,
	delay,
	color,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
	delay: number;
	color: "violet" | "fuchsia" | "purple";
}) => {
	const colorMap = {
		violet: "from-primary/20 to-primary/5",
		fuchsia: "from-secondary/20 to-secondary/5",
		purple: "from-purple-600/20 to-purple-600/5",
	};

	const iconColorMap = {
		violet: "text-primary",
		fuchsia: "text-secondary",
		purple: "text-purple-400",
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 30 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-50px" }}
			transition={{ duration: 0.6, delay }}
			whileHover={{ y: -8, transition: { duration: 0.2 } }}
			className="group relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent p-10 backdrop-blur-sm"
		>
			<div
				className={`absolute inset-0 bg-gradient-to-br ${colorMap[color]} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
			/>
			<div className="relative z-10">
				<div
					className={`mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 group-hover:ring-white/20 transition-all ${iconColorMap[color]}`}
				>
					{icon}
				</div>
				<h3
					className="mb-3 text-2xl font-bold text-white tracking-tight"
					style={{ fontFamily: "'JetBrains Mono', monospace" }}
				>
					{title}
				</h3>
				<p className="text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
					{description}
				</p>
			</div>
		</motion.div>
	);
};

export { HomePage };
