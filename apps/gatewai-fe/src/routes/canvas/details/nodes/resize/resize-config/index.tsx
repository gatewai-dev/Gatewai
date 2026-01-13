import type { ResizeNodeConfig } from "@gatewai/types";
import type { NodeEntityType } from "@/store/nodes";
import { AspectRatioSwitch } from "../../common/dimensions/aspect-ratio-switch";
import { ResizeHeightInput } from "../../common/dimensions/height-input";
import { ResizeWidthInput } from "../../common/dimensions/width-input";

function ResizeConfig({
	node,
	disabled,
}: {
	node: NodeEntityType;
	disabled?: boolean;
}) {
	const nodeConfig = node.config as ResizeNodeConfig;
	return (
		<div className="flex items-end gap-2">
			<ResizeWidthInput
				node={node}
				disabled={disabled}
				originalWidth={nodeConfig?.originalWidth ?? undefined}
				originalHeight={nodeConfig?.originalHeight ?? undefined}
				maintainAspect={nodeConfig?.maintainAspect ?? true}
			/>
			<ResizeHeightInput
				node={node}
				disabled={disabled}
				originalWidth={nodeConfig?.originalWidth ?? undefined}
				originalHeight={nodeConfig?.originalHeight ?? undefined}
				maintainAspect={nodeConfig?.maintainAspect ?? true}
			/>
			<AspectRatioSwitch
				node={node}
				disabled={disabled}
				originalWidth={nodeConfig?.originalWidth ?? undefined}
				originalHeight={nodeConfig?.originalHeight ?? undefined}
			/>
		</div>
	);
}

export { ResizeConfig };
