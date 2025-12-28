import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function MediaBackground({
	className,
	children,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"w-full media-container h-[280px] flex items-center justify-center rounded bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700",
				className,
			)}
		>
			{children}
		</div>
	);
}

export { MediaBackground };
