import { Panel } from "@gatewai/react-canvas";
import { memo } from "react";

const LeftPanel = memo(({ leftPanel }: { leftPanel?: React.ReactNode }) => {
	return (
		<Panel
			position="center-left"
			className=" left-0 ml-0! bottom-0 top-0 h-screen"
		>
			{leftPanel || <NodePalette />}
		</Panel>
	);
});

export { LeftPanel };
