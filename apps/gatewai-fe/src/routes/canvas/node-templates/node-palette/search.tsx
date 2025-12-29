import { Input } from "@/components/ui/input";
import { useNodePalette } from "./node-palette.ctx";
import { memo } from "react";

const SearchInput  = memo(() => {
	const { searchQuery, setSearchQuery } = useNodePalette();

	return (
		<Input
			placeholder="Search"
			value={searchQuery}
			onChange={(e) => setSearchQuery(e.target.value)}
		/>
	);
});

export { SearchInput }
