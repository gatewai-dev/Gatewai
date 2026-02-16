
import type { PaintNodeConfig } from "@/shared/config.js";
import {
    AspectRatioSwitch,
    ResizeHeightInput,
    ResizeWidthInput,
} from "@gatewai/react-canvas";
import type { NodeEntityType } from "@gatewai/react-store";

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
