import type { PaintNodeConfig, ResizeNodeConfig } from "@gatewai/types";
import type { NodeEntityType } from "@/store/nodes";
import { AspectRatioSwitch } from "./aspect-ratio-switch";
import { ResizeHeightInput } from "./height-input";
import { ResizeWidthInput } from "./width-input";

function DimensionsConfig({ node }: { node: NodeEntityType }) {
	const nodeConfig = node.config as ResizeNodeConfig | PaintNodeConfig;
	return (
		<div className="flex gap-2">
			<ResizeWidthInput
				node={node}
				originalWidth={nodeConfig?.originalWidth ?? null}
				originalHeight={nodeConfig?.originalHeight ?? null}
				maintainAspect={nodeConfig?.maintainAspect ?? true}
			/>
			<ResizeHeightInput
				node={node}
				originalWidth={nodeConfig?.originalWidth ?? null}
				originalHeight={nodeConfig?.originalHeight ?? null}
				maintainAspect={nodeConfig?.maintainAspect ?? true}
			/>
			<AspectRatioSwitch
				node={node}
				originalWidth={nodeConfig?.originalWidth ?? null}
				originalHeight={nodeConfig?.originalHeight ?? null}
			/>
		</div>
	);
}

export { DimensionsConfig };
