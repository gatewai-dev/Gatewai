import type { PaintNodeConfig } from "@gatewai/node-paint";
import type { NodeEntityType } from "@gatewai/react-store";
import { AspectRatioSwitch, ResizeHeightInput, ResizeWidthInput } from "@gatewai/react-canvas";

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
