import { MonitorOff, RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button"; // Adjusted path to standard shadcn alias
import { LoadingSpinner } from "../ui/loading-spinner";

export function useWebGLSupport() {
	const [isSupported, setIsSupported] = useState<boolean | null>(null);

	useEffect(() => {
		const checkSupport = () => {
			try {
				const canvas = document.createElement("canvas");
				const supported = !!(
					window.WebGLRenderingContext &&
					(canvas.getContext("webgl") ||
						canvas.getContext("experimental-webgl"))
				);
				// FIX: Use the actual 'supported' boolean instead of hardcoded false
				setIsSupported(supported);
			} catch (_e) {
				setIsSupported(false);
			}
		};

		checkSupport();
	}, []);

	return isSupported;
}

const WebGLGuard = ({ children }: { children: ReactNode }) => {
	const isSupported = useWebGLSupport();

	// 1. Loading State - Full Screen Centered
	if (isSupported === null) {
		return (
			<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6 space-y-4">
				<LoadingSpinner size={60} />
				<p className="text-sm font-medium text-muted-foreground animate-pulse">
					Detecting hardware acceleration...
				</p>
			</div>
		);
	}

	// 2. Error State - Full Screen with shadcn Dark/Light support
	if (!isSupported) {
		return (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-4 md:p-6">
				<div className="max-w-md w-full text-center space-y-8">
					<div className="flex justify-center">
						<div className="p-6 bg-primary/10 rounded-full ring-1 ring-primary/20">
							<MonitorOff className="w-12 h-12 text-primary" />
						</div>
					</div>

					<div className="space-y-3">
						<h2 className="text-3xl font-bold tracking-tight text-foreground">
							WebGL Not Available
						</h2>
						<p className="text-muted-foreground leading-relaxed">
							This experience requires hardware acceleration. Your current
							browser or hardware setup doesn't support WebGL.
						</p>
					</div>

					<div className="bg-card p-6 rounded-xl border border-border text-left shadow-sm">
						<h3 className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
							Troubleshooting Steps:
						</h3>
						<ul className="space-y-3 text-sm text-muted-foreground">
							<li className="flex items-start gap-3">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
									1
								</span>
								<span>
									Enable <strong>Hardware Acceleration</strong> in your browser
									settings.
								</span>
							</li>
							<li className="flex items-start gap-3">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
									2
								</span>
								<span>
									Update your <strong>Graphics Drivers</strong> to the latest
									version.
								</span>
							</li>
							<li className="flex items-start gap-3">
								<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
									3
								</span>
								<span>
									Try using <strong>Chrome, Edge, or Firefox</strong>.
								</span>
							</li>
						</ul>
					</div>

					<Button
						onClick={() => window.location.reload()}
						size="lg"
						className="w-full sm:w-auto h-12 px-8 gap-2 shadow-lg hover:shadow-primary/20 transition-all"
					>
						<RefreshCw className="w-4 h-4" />
						Reload Page
					</Button>
				</div>
			</div>
		);
	}

	// 3. Success State
	return <>{children}</>;
};

export { WebGLGuard };
