import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Cpu, Network, Zap } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { GatewaiLogo } from "@/components/ui/gatewai-logo";

// Animation variants
const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.1,
			delayChildren: 0.3,
		},
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.5,
			ease: [0.215, 0.61, 0.355, 1],
		},
	},
};

const HomePage = () => {
	// Parallax effect for the hero background
	const targetRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: targetRef,
		offset: ["start start", "end start"],
	});

	const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
	const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

	return (
		<main
			ref={targetRef}
			className="relative min-h-screen w-full overflow-x-hidden bg-background text-foreground selection:bg-primary/30"
		>
			{/* Navbar */}
			<nav className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-border/40 bg-background/80 px-6 backdrop-blur-md">
				<div className="flex items-center gap-2">
					<GatewaiLogo className="h-6 w-6 text-primary" />
					<span className="text-lg font-bold tracking-tight">Gatewai</span>
				</div>
				<div className="flex items-center gap-4">
					<Link to="/auth/signin">
						<Button variant="ghost" className="text-sm font-medium">
							Log in
						</Button>
					</Link>
					<Link to="/auth/signup">
						<Button
							size="sm"
							className="font-medium shadow-lg shadow-primary/20"
						>
							Sign up
						</Button>
					</Link>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="relative flex min-h-[90vh] flex-col items-center justify-center px-6 pt-16">
				{/* Ambient Background */}
				<motion.div
					style={{ y, opacity }}
					className="absolute inset-0 z-0 pointer-events-none"
				>
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
					<div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
				</motion.div>

				<motion.div
					variants={containerVariants}
					initial="hidden"
					animate="visible"
					className="relative z-10 flex flex-col items-center max-w-4xl text-center space-y-8"
				>
					{/* Logo/Badge */}
					<motion.div variants={itemVariants} className="mb-4">
						<div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 backdrop-blur-sm">
							<span className="relative flex h-2 w-2">
								<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
								<span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
							</span>
							<span className="text-xs font-semibold uppercase tracking-widest text-primary">
								v1.0 Alpha
							</span>
						</div>
					</motion.div>

					{/* Main Title */}
					<motion.h1
						variants={itemVariants}
						className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-foreground"
					>
						Architect{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-blue-500">
							Intelligence
						</span>
					</motion.h1>

					<motion.p
						variants={itemVariants}
						className="text-lg md:text-xl text-muted-foreground max-w-2xl font-light leading-relaxed"
					>
						The node-based workspace for the next generation of generative AI.
						Design, prototype, and deploy multi-modal workflows with
						unparalleled control.
					</motion.p>

					{/* CTA Buttons */}
					<motion.div
						variants={itemVariants}
						className="flex flex-col sm:flex-row items-center gap-4 pt-4"
					>
						<Link to="/canvas">
							<Button
								size="lg"
								className="h-14 px-8 text-base rounded-full shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 group"
							>
								Enter Studio
								<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
							</Button>
						</Link>
						<a
							href="https://github.com/gatewai/gatewai"
							target="_blank"
							rel="noreferrer"
						>
							<Button
								variant="outline"
								size="lg"
								className="h-14 px-8 text-base rounded-full border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all duration-300"
							>
								View on GitHub
							</Button>
						</a>
					</motion.div>
				</motion.div>
			</section>

			{/* Features / Glass Grid */}
			<section className="relative z-10 py-24 px-6 md:px-12 max-w-7xl mx-auto">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<FeatureCard
						icon={<Network className="h-6 w-6 text-blue-400" />}
						title="Visual Graph Engine"
						description="Construct complex logic flows visually. Connect LLMs, image generators, and custom scripts with drag-and-drop ease."
						delay={0.1}
					/>
					<FeatureCard
						icon={<Cpu className="h-6 w-6 text-purple-400" />}
						title="Hybrid Execution"
						description="Run lightweight tasks in the browser and offload heavy generative jobs to the cloud or local backend seamlessly."
						delay={0.2}
					/>
					<FeatureCard
						icon={<Zap className="h-6 w-6 text-yellow-400" />}
						title="Real-time Preview"
						description="See results instantly as you tweak parameters. Iterate faster with a reactive canvas designed for experimentation."
						delay={0.3}
					/>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-12 text-center text-sm text-muted-foreground border-t border-border/40 bg-zinc-950/50">
				<p>© 2024 Gatewai Studio. Built for the future of AI.</p>
			</footer>
		</main>
	);
};

const FeatureCard = ({
	icon,
	title,
	description,
	delay,
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
	delay: number;
}) => {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-100px" }}
			transition={{ duration: 0.5, delay }}
			className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 transition-all hover:bg-white/10 hover:border-white/20 hover:shadow-2xl hover:shadow-primary/5"
		>
			<div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
			<div className="relative z-10">
				<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20 group-hover:bg-white/20 transition-colors">
					{icon}
				</div>
				<h3 className="mb-2 text-xl font-semibold text-white tracking-tight">
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
