import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";

// 1. Keep Provider separate. Do not wrap it inside the Tooltip component.
function TooltipProvider({
	delayDuration = 0,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			{...props}
		/>
	);
}

// 2. Memoize the Tooltip components to prevent re-renders from parent updates.
const Tooltip = React.memo(
	({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) => {
		return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
	},
);
Tooltip.displayName = "Tooltip";

const TooltipTrigger = React.memo(
	({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) => {
		return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
	},
);
TooltipTrigger.displayName = "TooltipTrigger";

const TooltipContent = React.memo(
	({
		className,
		sideOffset = 4, // Increased slightly for better UX
		children,
		...props
	}: React.ComponentProps<typeof TooltipPrimitive.Content>) => {
		return (
			<TooltipPrimitive.Portal>
				<TooltipPrimitive.Content
					data-slot="tooltip-content"
					sideOffset={sideOffset}
					className={cn(
						"bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
						className,
					)}
					{...props}
				>
					{children}
				</TooltipPrimitive.Content>
			</TooltipPrimitive.Portal>
		);
	},
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
