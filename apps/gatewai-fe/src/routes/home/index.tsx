import { Button, GatewaiLogo } from "@gatewai/ui-kit";
import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { Link } from "react-router";

const HomePage = () => {
	// Generate some random heights for the masonry grid placeholders
	const placeholders = Array.from({ length: 12 }).map((_, i) => ({
		id: i,
		height: Math.floor(Math.random() * (500 - 250 + 1) + 250),
		seed: i + 10,
	}));

	return (
		<main
			className="relative w-full min-h-screen bg-[#050505] text-foreground selection:bg-primary/30 overflow-x-hidden"
			style={{ fontFamily: "'Outfit', sans-serif" }}
		>
			<Helmet>
				<title>Gatewai - AI Workflow Engine</title>
			</Helmet>

			<style>{`
                @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');
                
                /* Hide scrollbar for cleaner look */
                ::-webkit-scrollbar {
                    width: 8px;
                }
                ::-webkit-scrollbar-track {
                    background: #050505;
                }
                ::-webkit-scrollbar-thumb {
                    background: #262626;
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-thumb:hover {
                    background: #404040;
                }
                
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 20s linear infinite;
                }
            `}</style>

			{/* 1. Sticky Transparent Navbar */}
			<header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-linear-to-b from-black/80 to-transparent backdrop-blur-sm border-b border-white/5">
				<div className="flex items-center gap-3">
					<GatewaiLogo className="h-8 w-auto text-primary" />
				</div>
				<div className="flex items-center gap-4">
					<a
						href="https://github.com/gatewai-dev/Gatewai"
						target="_blank"
						rel="noreferrer"
						className="text-neutral-400 hover:text-white transition-colors"
					>
						<FaGithub className="size-5" />
					</a>
					<a
						href="https://discord.gg/ha4A8UD7kn"
						target="_blank"
						rel="noreferrer"
						className="text-neutral-400 hover:text-[#5865F2] transition-colors"
					>
						<FaDiscord className="size-5" />
					</a>
					<Link to="/canvas">
						<Button className="rounded-full bg-white text-black hover:bg-neutral-200 font-semibold px-6 h-10 border-0">
							Launch App
						</Button>
					</Link>
				</div>
			</header>

			{/* 2. Immersive Hero Section */}
			<section className="relative h-screen flex flex-col items-center justify-center pt-20 overflow-hidden">
				{/* Full-bleed Background Media Placeholder */}
				<div className="absolute inset-0 z-0 pointer-events-none">
					<img
						src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
						alt="Hero Background"
						className="w-full h-full object-cover opacity-[0.35]"
					/>
					{/* Gradient overlays to blend into the background color */}
					<div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-transparent to-[#050505]"></div>
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] opacity-80"></div>
				</div>

				<div className="relative z-10 flex flex-col items-center text-center max-w-5xl px-4">
					<motion.div
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.6, ease: "easeOut" }}
						className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
					>
						<Sparkles className="size-4 text-primary" />
						<span className="text-xs font-mono text-neutral-300">
							GATEWAI ENGINE V2.0 LIVE
						</span>
					</motion.div>

					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.1 }}
						className="text-6xl md:text-8xl font-extrabold tracking-tighter leading-[0.95] text-white mb-6"
						style={{ fontFamily: "'JetBrains Mono', monospace" }}
					>
						ORCHESTRATE <br />
						<span className="text-transparent bg-clip-text bg-linear-to-r from-primary via-[#b7ea48] to-green-400">
							INTELLIGENCE.
						</span>
					</motion.h1>

					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.2 }}
						className="text-lg md:text-xl text-neutral-400 max-w-2xl font-light leading-relaxed mb-10"
					>
						The visual node-based platform for multi-modal AI. Connect Gemini,
						Veo, and more. Chain operations and build powerful workflows in
						seconds.
					</motion.p>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.3 }}
						className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
					>
						<Link to="/canvas" className="w-full sm:w-auto">
							<Button className="w-full h-14 px-8 text-base font-semibold rounded-full bg-primary hover:bg-primary/90 text-neutral-950 border-0 shadow-[0_0_40px_rgba(183,234,72,0.3)] transition-all duration-300 hover:scale-105">
								Start Creating <ArrowRight className="ml-2 size-5" />
							</Button>
						</Link>
						<Button
							variant="outline"
							className="w-full sm:w-auto h-14 px-8 text-base font-semibold rounded-full border-white/10 bg-white/5 hover:bg-white/10 text-white backdrop-blur-md transition-all duration-300"
						>
							<Play className="mr-2 size-4 fill-white" /> Watch Demo
						</Button>
					</motion.div>
				</div>
			</section>

			{/* 3. Tech Stack Ticker (Remade Style) */}
			<section className="relative py-10 border-y border-white/5 bg-white/2">
				<div className="absolute left-0 top-0 bottom-0 w-32 bg-linear-to-r from-[#050505] to-transparent z-10" />
				<div className="absolute right-0 top-0 bottom-0 w-32 bg-linear-to-l from-[#050505] to-transparent z-10" />

				<div className="flex overflow-hidden">
					<div className="flex items-center gap-16 animate-marquee whitespace-nowrap opacity-50 hover:opacity-100 transition-opacity duration-500">
						{/* Repeated list for seamless scrolling */}
						{Array(3)
							.fill([
								"Gemini 3 Pro",
								"Veo Video",
								"Nano Banana Image",
								"Lyria Audio",
								"React Flow",
								"PixiJS",
								"Remotion",
							])
							.flat()
							.map((tech, idx) => (
								<span
									key={idx}
									className="font-mono text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-4"
								>
									<span className="w-2 h-2 rounded-full bg-primary/50" />
									{tech}
								</span>
							))}
					</div>
				</div>
			</section>

			{/* 4. Masonry Showcase Gallery (The core "Remade" look) */}
			<section className="py-24 px-4 md:px-8 max-w-450 mx-auto">
				<div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
					<div>
						<h2
							className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4"
							style={{ fontFamily: "'JetBrains Mono', monospace" }}
						>
							Community Outputs
						</h2>
						<p className="text-neutral-400 text-lg">
							Discover what creators are building with Gatewai nodes.
						</p>
					</div>
					<Button
						variant="ghost"
						className="text-primary hover:text-primary hover:bg-primary/10 rounded-full"
					>
						Explore Gallery <ArrowRight className="ml-2 size-4" />
					</Button>
				</div>

				{/* CSS Columns for Masonry Layout */}
				<div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
					{placeholders.map((item) => (
						<div
							key={item.id}
							className="relative group overflow-hidden rounded-2xl bg-neutral-900 border border-white/5 break-inside-avoid cursor-pointer"
						>
							{/* Placeholder Image */}

							{/* Hover Overlay */}
							<div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
								<div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
									<div className="flex items-center gap-2 mb-2">
										<span className="px-2 py-1 rounded-md bg-white/20 backdrop-blur-md text-[10px] font-mono text-white">
											{item.id % 2 === 0 ? "VEO VIDEO" : "GEMINI + NANO BANANA"}
										</span>
									</div>
									<h3 className="text-white font-medium text-lg leading-tight mb-1">
										{item.id % 2 === 0
											? "Cinematic Sci-Fi Trailer"
											: "Product Photography Generator"}
									</h3>
									<p className="text-neutral-400 text-sm">
										@creator_{item.seed}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* 5. Bottom CTA & Footer */}
			<footer className="relative border-t border-white/10 overflow-hidden bg-black pt-20 pb-10">
				<div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>

				<div className="flex flex-col items-center text-center px-4 mb-20">
					<h2
						className="text-4xl md:text-5xl font-bold text-white mb-6"
						style={{ fontFamily: "'JetBrains Mono', monospace" }}
					>
						Ready to build?
					</h2>
					<p className="text-neutral-400 mb-8 max-w-md">
						Join thousands of creators visually orchestrating the next
						generation of AI content.
					</p>
					<Link to="/canvas">
						<Button className="h-14 px-10 text-lg font-semibold rounded-full bg-white text-black hover:bg-neutral-200 transition-colors">
							Launch Studio For Free
						</Button>
					</Link>
				</div>

				<div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between pt-10 border-t border-white/5 text-sm text-neutral-500 font-mono">
					<span>© 2026 GATEWAI STUDIO</span>
					<div className="flex gap-6 mt-4 md:mt-0">
						<a href="#" className="hover:text-primary transition-colors">
							Twitter
						</a>
						<a href="#" className="hover:text-primary transition-colors">
							Discord
						</a>
						<a href="#" className="hover:text-primary transition-colors">
							Terms
						</a>
						<a href="#" className="hover:text-primary transition-colors">
							Privacy
						</a>
					</div>
				</div>
			</footer>
		</main>
	);
};

export { HomePage };
