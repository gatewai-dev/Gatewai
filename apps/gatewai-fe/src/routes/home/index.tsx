import { Gemini } from "@lobehub/icons";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { GatewaiLogo } from "@/components/ui/gatewai-logo";
import { BlurText } from "@/components/ui/react-bits/blur-text";
// React Bits high-fidelity components
import { SpotlightCard } from "@/components/ui/react-bits/spotlight-card";
import { TrueFocus } from "@/components/ui/react-bits/true-focus";
import { VariableProximity } from "@/components/ui/react-bits/variable-proximity";

const HomePage = () => {
	const containerRef = useRef<HTMLDivElement>(null);
	const signalsContainerRef = useRef<HTMLDivElement>(null);
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			setMousePos({
				x: (e.clientX / window.innerWidth - 0.5) * 20,
				y: (e.clientY / window.innerHeight - 0.5) * 20,
			});
		};
		window.addEventListener("mousemove", handleMouseMove);
		return () => window.removeEventListener("mousemove", handleMouseMove);
	}, []);

	useEffect(() => {
		const palette = [
			"blue-600",
			"purple-600",
			"green-500",
			"red-500",
			"yellow-500",
		];
		const getRandomPos = (dim: number) =>
			Math.random() * (dim * 0.8) + dim * 0.1;
		const createSignal = () => {
			if (!signalsContainerRef.current) return;

			const signal = document.createElement("div");
			signal.className =
				"absolute w-2 h-2 rounded-full bg-white/50 blur-sm shadow-[0_0_8px_2px_rgba(255,255,255,0.6)] transition-all duration-1500 ease-linear animate-pulse will-change-transform";
			signalsContainerRef.current.appendChild(signal);

			const currentX = getRandomPos(window.innerWidth);
			const currentY = getRandomPos(window.innerHeight);
			signal.style.left = `${currentX}px`;
			signal.style.top = `${currentY}px`;

			let hops = Math.floor(Math.random() * 3) + 3; // 3-5 hops per signal

			const doHop = () => {
				if (hops <= 0) {
					signal.remove();
					return;
				}

				const endX = getRandomPos(window.innerWidth);
				const endY = getRandomPos(window.innerHeight);
				signal.style.left = `${endX}px`;
				signal.style.top = `${endY}px`;

				const onTransitionEnd = () => {
					// Create shape at end position
					const shapeType = Math.random() > 0.5 ? "rounded-full" : "rounded-md";
					const color = palette[Math.floor(Math.random() * palette.length)];
					const size = Math.random() * 40 + 20;
					const shape = document.createElement("div");
					shape.className = `absolute ${shapeType} bg-${color}/20 blur-md transition-opacity duration-2000 ease-out will-change-opacity`;
					shape.style.width = `${size}px`;
					shape.style.height = `${size}px`;
					shape.style.left = `${endX - size / 2}px`;
					shape.style.top = `${endY - size / 2}px`;
					shape.style.opacity = "1";
					signalsContainerRef.current?.appendChild(shape);
					shape.offsetHeight; // Force reflow
					shape.style.opacity = "0";

					// Remove shape after fade-out
					shape.addEventListener("transitionend", () => shape.remove(), {
						once: true,
					});

					hops--;
					doHop();
				};

				signal.addEventListener("transitionend", onTransitionEnd, {
					once: true,
				});
			};

			// Trigger first hop after initial render
			requestAnimationFrame(doHop);
		};

		const intervalId = setInterval(createSignal, 1500); // Spawn new signal every 1.5s

		return () => clearInterval(intervalId);
	}, []);

	return (
		<main
			ref={containerRef}
			className="relative min-h-screen w-full overflow-hidden bg-[#050505] text-white selection:bg-white/20 font-sans"
		>
			{/* NEW LAYER: WORKFLOW SIGNALS */}
			<div
				ref={signalsContainerRef}
				className="absolute inset-0 z-[1] pointer-events-none overflow-hidden"
			/>

			{/* 2. LAYER: FILM GRAIN & GRID */}
			<div
				className="pointer-events-none absolute inset-0 z-[4] opacity-[0.12] mix-blend-soft-light"
				style={{
					backgroundImage: `url("https://grainy-gradients.vercel.app/noise.svg")`,
				}}
			/>
			<div
				className="absolute inset-0 z-[2] opacity-[0.15]"
				style={{
					backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
					backgroundSize: "80px 80px",
					maskImage:
						"radial-gradient(circle at 50% 50%, black, transparent 80%)",
				}}
			/>

			{/* CONTENT AREA */}
			<div className="relative z-10 flex flex-col items-center justify-center px-6 min-h-screen">
				{/* Hero Title */}
				<div className="mb-6 w-full max-w-4xl text-primary flex items-center justify-center">
					<GatewaiLogo className="relative size-40 text-primary transition-all duration-1000 cubic-bezier(0.23, 1, 0.32, 1) group-hover:scale-[1.05] group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
				</div>

				{/* Dynamic Subtext */}
				<div className="flex flex-col items-center max-w-2xl text-center mb-12">
					<BlurText
						text="The Multi-Modal Generative AI Workflow Platform."
						delay={150}
						animateBy="words"
						direction="top"
						className=" text-center text-3xl font-semibold tracking-tight text-white/90 mb-6"
					/>

					<div className="h-12 flex items-center justify-center">
						<VariableProximity
							label="Design AI workflows with effortless intuition. Preview in real time."
							className="text-sm md:text-lg font-light text-zinc-400 italic"
							fromFontVariationSettings="'wght' 300"
							toFontVariationSettings="'wght' 600"
							containerRef={containerRef}
							radius={100}
							falloff="exponential"
						/>
					</div>
				</div>

				{/* Action Call */}
				<Link to="/canvas" className="group relative no-underline">
					<div className="absolute -inset-1 rounded-full bg-white/20 opacity-0 blur-xl transition duration-700 group-hover:opacity-100" />

					<SpotlightCard
						className="border-white/10 bg-white/[0.03] backdrop-blur-2xl rounded-full transition-all duration-500 hover:border-white/40"
						spotlightColor="rgba(255, 255, 255, 0.12)"
					>
						<div className="flex items-center gap-10 px-10 py-5">
							<span className="text-[13px] font-bold tracking-[0.2em] text-primary uppercase group-hover:text-primary/80 transition-colors">
								Enter Studio
							</span>
							<div className="flex size-8 items-center justify-center rounded-full bg-white text-black transition-all duration-500 group-hover:scale-110 group-hover:rotate-[-45deg]">
								<svg width="12" height="12" viewBox="0 0 15 15" fill="none">
									<path
										d="M8.14645 3.14645C8.34171 2.95118 8.65829 2.95118 8.85355 3.14645L12.8536 7.14645C13.0488 7.34171 13.0488 7.65829 12.8536 7.85355L8.85355 11.8536C8.65829 12.0488 8.34171 12.0488 8.14645 11.8536C7.95118 11.6583 7.95118 11.3417 8.14645 11.1464L11.2929 8H2.5C2.22386 8 2 7.77614 2 7.5C2 7.22386 2.22386 7 2.5 7H11.2929L8.14645 3.85355C7.95118 3.65829 7.95118 3.34171 8.14645 3.14645Z"
										fill="currentColor"
										fillRule="evenodd"
										clipRule="evenodd"
									></path>
								</svg>
							</div>
						</div>
					</SpotlightCard>
				</Link>

				{/* Footer Meta */}
				<footer className="mt-24 flex flex-col items-center gap-8">
					<div className="flex items-center gap-3 px-5 py-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md">
						<span className="text-[9px] text-zinc-500 font-bold tracking-[0.2em] uppercase">
							Powered by
						</span>
						<Gemini.Color className="size-4 opacity-80" />
					</div>
				</footer>
			</div>

			{/* Edge Vignette */}
			<div className="fixed inset-0 pointer-events-none z-50 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]" />
		</main>
	);
};

export { HomePage };
