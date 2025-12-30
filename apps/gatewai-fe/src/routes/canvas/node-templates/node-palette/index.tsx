import { Separator } from "@/components/ui/separator";
import { useNodeTemplates } from "../node-templates.ctx";
import { DataTypeMultiSelect } from "./io-filter";
import { NodePaletteProvider } from "./node-palette.ctx";
import { NodeTemplateList } from "./node-template-list";
import { SearchInput } from "./search";

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
			<div className="node-palette flex flex-col gap-2 p-4 max-h-full  relative">
				<div className="shrink-0 flex flex-col gap-2 sticky">
					<SearchInput />
					<DataTypeMultiSelect />
				</div>
				<Separator />
				<NodeTemplateList templates={nodeTemplates} />
			</div>
		</NodePaletteProvider>
	);
}
