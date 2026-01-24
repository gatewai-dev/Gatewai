import { Check, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

interface PatchReviewCardProps {
	patchId: string;
	onComplete: () => void;
}

export function PatchReviewCard({ patchId, onComplete }: PatchReviewCardProps) {
	const { isReviewing, previewPatch, applyPatch, rejectPatch, cancelPreview } =
		useCanvasCtx();

	const handlePreview = async () => {
		await previewPatch(patchId);
	};

	const handleApply = async () => {
		await applyPatch(patchId);
		onComplete();
	};

	const handleReject = async () => {
		await rejectPatch(patchId);
		onComplete();
	};

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
