import { memo } from "react";
import { Input } from "@/components/ui/input";
import { useNodePalette } from "./node-palette.ctx";

const SearchInput = memo(() => {
	const { searchQuery, setSearchQuery } = useNodePalette();

	return (
		<Input
			placeholder="Search"
			value={searchQuery}
			onChange={(e) => setSearchQuery(e.target.value)}
		/>
	);
});

export { SearchInput };
