import { Panel } from "@xyflow/react";
import { memo } from "react";
import { Toolbar } from "./toolbar";

const BottomPanel = memo(() => {
	return (
		<Panel position="bottom-center">
			<Toolbar />
		</Panel>
	);
});

export { BottomPanel };
