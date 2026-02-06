import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, GitPullRequest, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

interface PatchReviewCardProps {
	patchId: string;
	initialStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
	onComplete: (status: "ACCEPTED" | "REJECTED") => void;
}

export function PatchReviewCard({
	patchId,
	initialStatus = "PENDING",
	onComplete,
}: PatchReviewCardProps) {
	const { isReviewing, previewPatch, applyPatch, rejectPatch, cancelPreview } =
		useCanvasCtx();
	const [status, setStatus] = useState(initialStatus);

	const handleApply = async () => {
		await applyPatch(patchId);
		setStatus("ACCEPTED");
		onComplete("ACCEPTED");
	};

	const handleReject = async () => {
		await rejectPatch(patchId);
		setStatus("REJECTED");
		onComplete("REJECTED");
	};

	return (
		<div className="w-full font-sans selection:bg-primary/10 my-2">
			<AnimatePresence mode="wait">
				{status === "ACCEPTED" ? (
					<motion.div
						key="accepted"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
					>
						<Check className="w-3.5 h-3.5 text-green-500" />
						<span className="text-[11px] font-medium">Changes applied</span>
					</motion.div>
				) : status === "REJECTED" ? (
					<motion.div
						key="rejected"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						className="flex items-center gap-2.5 px-3 py-2 rounded-lg border"
					>
						<X className="w-3.5 h-3.5 text-red-500" />
						<span className="text-[11px] font-medium">Changes discarded</span>
					</motion.div>
				) : !isReviewing ? (
					<motion.div
						key="idle"
						initial={{ opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-background via-background to-muted/40 p-0.5 shadow-sm hover:shadow-md transition-all duration-300"
					>
						<div className="flex items-center justify-between gap-3 bg-background/50 backdrop-blur-xl p-2.5 rounded-[10px]">
							<div className="flex items-center gap-3">
								<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
									<GitPullRequest className="w-4 h-4" />
								</div>
								<div className="flex flex-col gap-0.5">
									<h4 className="text-[11px] font-medium text-foreground">
										Suggested Changes
									</h4>
									<p className="text-[10px] text-muted-foreground">
										Review code updates
									</p>
								</div>
							</div>
							<Button
								onClick={() => previewPatch(patchId)}
								size="sm"
								className="h-7 px-3 text-[10px] font-medium rounded-lg shadow-none bg-primary text-primary-foreground hover:bg-primary/90"
							>
								Review
								<ArrowRight className="ml-1.5 w-3 h-3 opacity-70" />
							</Button>
						</div>
					</motion.div>
				) : (
					<motion.div
						key="reviewing"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95 }}
						className="relative rounded-xl border-2 border-primary/20 bg-background/80 backdrop-blur-xl shadow-2xl shadow-primary/5 overflow-hidden"
					>
						{/* Progress Strip */}
						<div className="absolute top-0 inset-x-0 h-0.5 bg-linear-to-r from-transparent via-primary to-transparent opacity-50" />

						<div className="p-3 space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span className="relative flex h-2 w-2">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
										<span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
									</span>
									<span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
										Reviewing...
									</span>
								</div>
								<Button
									onClick={cancelPreview}
									variant="ghost"
									size="sm"
									className="h-6 px-2 text-[10px] hover:bg-muted text-muted-foreground"
								>
									Cancel
								</Button>
							</div>

							<div className="grid grid-cols-2 gap-2">
								<Button
									onClick={handleApply}
									className="h-8 rounded-lg text-[11px] font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all"
								>
									<Check className="w-3.5 h-3.5 mr-1.5" />
									Accept
								</Button>
								<Button
									onClick={handleReject}
									variant="secondary"
									className="h-8 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all"
								>
									<X className="w-3.5 h-3.5 mr-1.5" />
									Reject
								</Button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
