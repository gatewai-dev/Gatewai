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

	const handlePreview = async () => {
		await previewPatch(patchId);
	};

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

	if (status === "ACCEPTED") {
		return (
			<div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5 animate-in fade-in duration-300">
				<div className="flex items-center gap-2">
					<CheckCircle2 className="w-4 h-4 text-green-500" />
					<span className="text-sm font-medium text-green-500">
						Changes applied to canvas
					</span>
				</div>
			</div>
		);
	}

	if (status === "REJECTED") {
		return (
			<div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 animate-in fade-in duration-300">
				<div className="flex items-center gap-2">
					<XCircle className="w-4 h-4 text-destructive" />
					<span className="text-sm font-medium text-destructive">
						Changes rejected
					</span>
				</div>
			</div>
		);
	}

	if (!isReviewing) {
		return (
			<div className="p-4 rounded-lg border border-border bg-muted/30 animate-in fade-in slide-in-from-bottom-2 duration-300">
				<div className="flex items-center gap-2 mb-3">
					<div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
					<span className="text-sm font-medium">Canvas changes proposed</span>
				</div>
				<Button
					onClick={handlePreview}
					variant="secondary"
					size="sm"
					className="w-full"
				>
					<Eye className="w-4 h-4 mr-2" />
					Review Changes
				</Button>
			</div>
		);
	}

	return (
		<div className="p-4 rounded-lg border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
			<div className="flex items-center gap-2 mb-3">
				<div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
				<span className="text-sm font-medium">Reviewing proposed changes</span>
			</div>
			<div className="flex gap-2">
				<Button onClick={handleApply} size="sm" className="flex-1">
					<Check className="w-4 h-4 mr-2" />
					Accept
				</Button>
				<Button onClick={handleReject} variant="ghost" size="sm">
					<X className="w-4 h-4 mr-2" />
					Reject
				</Button>
				<Button onClick={cancelPreview} variant="ghost" size="sm">
					Cancel
				</Button>
			</div>
		</div>
	);
}
