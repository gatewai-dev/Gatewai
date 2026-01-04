import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				// Base Glassmorphism Styles
				"bg-white/5 dark:bg-black/20 backdrop-blur-md border-white/20 dark:border-white/10",
				"file:text-foreground placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground h-7 w-full min-w-0 rounded-md border px-2 py-1 text-base shadow-lg transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-white/40 focus-visible:ring-ring/30 focus-visible:ring-[3px]",
				"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
