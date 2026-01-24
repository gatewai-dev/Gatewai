import { Check, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

interface PatchReviewBannerProps {
	patchId: string;
	onClear: () => void;
}

export function PatchReviewBanner({
	patchId,
	onClear,
}: PatchReviewBannerProps) {
	const { isReviewing, previewPatch, applyPatch, rejectPatch, cancelPreview } =
		useCanvasCtx();

	const handlePreview = async () => {
		await previewPatch(patchId);
	};

	const handleApply = async () => {
		await applyPatch(patchId);
		onClear();
	};

	const handleReject = async () => {
		await rejectPatch(patchId);
		onClear();
	};

	const handleCancelPreview = () => {
		cancelPreview();
	};

	if (!isReviewing) {
		// Show "Review Proposed Changes" banner
		return (
			<div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
				<div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4 backdrop-blur-md border border-white/20">
					<div className="flex items-center gap-2">
						<div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
						<span className="font-medium">Agent proposed canvas changes</span>
					</div>
					<Button
						onClick={handlePreview}
						variant="secondary"
						size="sm"
						className="bg-white/20 hover:bg-white/30 text-white border-0"
					>
						<Eye className="w-4 h-4 mr-2" />
						Review Changes
					</Button>
				</div>
			</div>
		);
	}

	// Show "Reviewing" banner with Accept/Reject options
	return (
		<div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
			<div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4 backdrop-blur-md border border-white/20">
				<div className="flex items-center gap-2">
					<div className="w-3 h-3 rounded-full bg-white animate-pulse" />
					<span className="font-medium">Reviewing proposed changes</span>
				</div>
				<div className="flex gap-2">
					<Button
						onClick={handleApply}
						variant="secondary"
						size="sm"
						className="bg-green-500 hover:bg-green-600 text-white border-0"
					>
						<Check className="w-4 h-4 mr-2" />
						Accept
					</Button>
					<Button
						onClick={handleReject}
						variant="secondary"
						size="sm"
						className="bg-red-500 hover:bg-red-600 text-white border-0"
					>
						<X className="w-4 h-4 mr-2" />
						Reject
					</Button>
					<Button
						onClick={handleCancelPreview}
						variant="ghost"
						size="sm"
						className="text-white/80 hover:text-white hover:bg-white/10"
					>
						Cancel
					</Button>
				</div>
			</div>
		</div>
	);
}
