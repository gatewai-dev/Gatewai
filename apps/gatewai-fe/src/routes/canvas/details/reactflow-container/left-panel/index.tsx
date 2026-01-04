import { Panel } from "@xyflow/react";
import { memo } from "react";
import { NodePalette } from "../../node-templates/node-palette";

const LeftPanel = memo(() => {
	return (
		<Panel
			position="top-left"
			className=" bg-background left-0 top-0 m-0! h-full flex flex-col"
		>
			<NodePalette />
		</Panel>
	);
});

export { LeftPanel };
