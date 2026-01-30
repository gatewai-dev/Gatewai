import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { GatewaiLogo } from "@/components/ui/gatewai-logo";

interface AuthLayoutProps {
	children: ReactNode;
	title: string;
	subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
	return (
		<div className="container relative min-h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0 bg-background text-foreground overflow-hidden">
			{/* Left Side - Hero / Branding */}
			<div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex border-r border-border/40">
				<div className="absolute inset-0 bg-zinc-900" />

				{/* Background Decoration */}
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute h-full w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-zinc-900/0 to-zinc-900/0 opacity-50" />
					<div className="absolute -left-1/2 top-0 h-[1000px] w-[1000px] rounded-full bg-primary/5 blur-3xl" />
				</div>

				<div className="relative z-20 flex items-center gap-2 text-lg font-medium">
					<GatewaiLogo className="size-24" />
				</div>
			</div>

			{/* Right Side - Form */}
			<div className="relative flex h-full items-center p-4 lg:p-8 bg-background">
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />

				<motion.div
					initial={{ opacity: 0, x: 20 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.6, ease: "easeOut" }}
					className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[400px]"
				>
					<div className="flex flex-col space-y-2 text-center">
						<h1 className="text-3xl font-bold tracking-tighter text-foreground">
							{title}
						</h1>
						<p className="text-sm text-muted-foreground">{subtitle}</p>
					</div>

					{children}

					<p className="px-8 text-center text-sm text-muted-foreground">
						By clicking continue, you agree to our{" "}
						<a
							href="#"
							className="underline underline-offset-4 hover:text-primary"
						>
							Terms of Service
						</a>{" "}
						and{" "}
						<a
							href="#"
							className="underline underline-offset-4 hover:text-primary"
						>
							Privacy Policy
						</a>
						.
					</p>
				</motion.div>
			</div>
		</div>
	);
}
