import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, Eye, X, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

interface PatchReviewCardProps {
	patchId: string;
	initialStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
	onComplete: () => void;
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
		onComplete();
	};

	const handleReject = async () => {
		await rejectPatch(patchId);
		setStatus("REJECTED");
		onComplete();
	};

	return (
		<div className="relative overflow-hidden font-sans selection:bg-primary/10">
			<AnimatePresence mode="wait">
				{status === "ACCEPTED" ? (
					<motion.div
						key="accepted"
						initial={{ opacity: 0, y: 5 }}
						animate={{ opacity: 1, y: 0 }}
						className="flex items-center gap-3 p-3 rounded-xl border bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm"
					>
						<div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-green-500/10">
							<CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
						</div>
						<span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-300">
							Changes applied
						</span>
					</motion.div>
				) : status === "REJECTED" ? (
					<motion.div
						key="rejected"
						initial={{ opacity: 0, y: 5 }}
						animate={{ opacity: 1, y: 0 }}
						className="flex items-center gap-3 p-3 rounded-xl border bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm"
					>
						<div className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
							<XCircle className="w-4 h-4 text-zinc-500" />
						</div>
						<span className="text-[13px] font-medium text-zinc-500">
							Changes discarded
						</span>
					</motion.div>
				) : !isReviewing ? (
					<motion.div
						key="idle"
						initial={{ opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						className="p-4 rounded-2xl border bg-white dark:bg-zinc-900 shadow-sm transition-all"
					>
						<div className="flex items-center gap-3 mb-4">
							<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800">
								<Eye className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
							</div>
							<div>
								<h4 className="text-[13px] font-semibold tracking-tight">
									Proposed Update
								</h4>
								<p className="text-[11px] text-muted-foreground">
									Canvas version 2.4
								</p>
							</div>
						</div>
						<Button
							onClick={() => previewPatch(patchId)}
							className="w-full h-9 rounded-lg bg-zinc-900 dark:bg-white dark:text-zinc-950 text-white hover:opacity-90 transition-opacity"
						>
							Review Changes
						</Button>
					</motion.div>
				) : (
					<motion.div
						key="reviewing"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						className="p-1 rounded-2xl border bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl shadow-2xl shadow-black/5"
					>
						<div className="p-3">
							<div className="flex items-center gap-2 px-1 mb-3">
								<div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
								<span className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400">
									Review Mode
								</span>
							</div>
							<div className="flex gap-1.5">
								<Button
									onClick={handleApply}
									className="flex-1 h-8 rounded-lg text-[13px]"
								>
									<Check className="w-3.5 h-3.5 mr-1.5" />
									Accept
								</Button>
								<Button
									onClick={handleReject}
									variant="ghost"
									className="h-8 rounded-lg text-[13px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
								>
									<X className="w-3.5 h-3.5" />
								</Button>
								<div className="w-px h-4 my-auto bg-zinc-200 dark:bg-zinc-800 mx-1" />
								<Button
									onClick={cancelPreview}
									variant="ghost"
									className="h-8 rounded-lg text-[13px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
								>
									Cancel
								</Button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
