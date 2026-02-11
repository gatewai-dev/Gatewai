import type { NodeEntityType } from "@gatewai/react-store";
import type { PaintNodeConfig } from "@gatewai/types";
import { AspectRatioSwitch } from "../../common/dimensions/aspect-ratio-switch";
import { ResizeHeightInput } from "../../common/dimensions/height-input";
import { ResizeWidthInput } from "../../common/dimensions/width-input";

function PaintDimensionsConfig({
	node,
	disabled,
}: {
	node: NodeEntityType;
	disabled?: boolean;
}) {
	const nodeConfig = node.config as PaintNodeConfig;
	return (
		<div className="flex items-end gap-2">
			<ResizeWidthInput
				node={node}
				disabled={disabled}
				maintainAspect={nodeConfig?.maintainAspect ?? true}
			/>
			<ResizeHeightInput
				node={node}
				disabled={disabled}
				maintainAspect={nodeConfig?.maintainAspect ?? true}
			/>
			<AspectRatioSwitch node={node} disabled={disabled} />
		</div>
	);
}

export { PaintDimensionsConfig };
