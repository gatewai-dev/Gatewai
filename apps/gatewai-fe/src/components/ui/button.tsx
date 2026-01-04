import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
	{
		variants: {
			variant: {
				// Glass-filled primary
				default:
					"bg-primary/80 backdrop-blur-sm text-primary-foreground hover:bg-primary/90 shadow-md border border-white/10",
				destructive:
					"bg-destructive/80 backdrop-blur-sm text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
				// The classic "Glass" look
				outline:
					"border border-white/20 bg-white/10 dark:bg-white/5 backdrop-blur-md shadow-lg hover:bg-white/20 hover:text-accent-foreground",
				secondary:
					"bg-secondary/70 backdrop-blur-sm text-secondary-foreground hover:bg-secondary/80",
				ghost:
					"hover:bg-white/10 backdrop-blur-none hover:backdrop-blur-md dark:hover:bg-white/5",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				xs: "h-5 rounded px-1! has-[>svg]:px-2",
				sm: "h-7 rounded gap-1.5 px-3 has-[>svg]:px-2.5",
				lg: "h-10 rounded px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-sm": "size-7",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

export type ButtonProps = React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	};

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
