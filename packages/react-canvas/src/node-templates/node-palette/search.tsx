import { Button, Input } from "@gatewai/ui-kit";
import { X } from "lucide-react";
import { memo } from "react";
import { useNodePalette } from "./node-palette.ctx";

const SearchInput = memo(() => {
	const { searchQuery, setSearchQuery } = useNodePalette();

	const hasQuery = searchQuery.length > 0;

	return (
		<div className="relative flex items-center w-full">
			<Input
				placeholder="Search nodes"
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				className="pr-9 focus-visible:ring-1"
			/>

			<Button
				type="button"
				variant="ghost"
				size="xs"
				onClick={() => setSearchQuery("")}
				// pointer-events-none prevents clicking the button when it's invisible
				className={`
                    absolute right-2 p-0.5 rounded-sm
                    text-muted-foreground/60 hover:text-foreground
                    transition-all duration-200 ease-in-out
                    ${
											hasQuery
												? "opacity-100 scale-100 translate-x-0"
												: "opacity-0 scale-75 translate-x-1 pointer-events-none"
										}
                `}
				aria-label="Clear search"
			>
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
});

export { SearchInput };
