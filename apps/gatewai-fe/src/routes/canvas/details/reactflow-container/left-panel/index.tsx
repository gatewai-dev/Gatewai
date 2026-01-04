import { Panel } from "@xyflow/react";
import { memo } from "react";
import { NodePalette } from "../../node-templates/node-palette";

const LeftPanel = memo(() => {
	return (
		<Panel
			position="center-left"
			className=" left-0 ml-0! bottom-0 top-0 h-screen"
		>
			<NodePalette />
		</Panel>
	);
});

export { LeftPanel };
