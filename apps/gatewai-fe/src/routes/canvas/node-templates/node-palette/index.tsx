import { useNodeTemplates } from "../node-templates.ctx";
import { DataTypeMultiSelect } from "./io-filter";
import { NodePaletteProvider } from "./node-palette.ctx";
import { NodeTemplateList } from "./node-template-list";
import { SearchInput } from "./search";
import { SortSelect } from "./sort";

export function NodePalette() {
	const { nodeTemplates, isError, isLoading } = useNodeTemplates();

	if (isLoading || !nodeTemplates) {
		return <div>Loading templates...</div>;
	}

	if (isError) {
		return <div>Error loading templates.</div>;
	}

	return (
		<NodePaletteProvider>
			<div className="node-palette flex flex-col gap-4 p-4">
				<SearchInput />
				<DataTypeMultiSelect />
				<SortSelect />
				<NodeTemplateList templates={nodeTemplates} />
			</div>
		</NodePaletteProvider>
	);
}
