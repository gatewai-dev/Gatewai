import type { NodeProps } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { useNodeImageUrl } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { BlurNode } from "../node-props";

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
    const node = useAppSelector(makeSelectNodeById(props.id));
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-3">
            </div>
        </BaseNode>
    );
});

BlurNodeComponent.displayName = "BlurNodeComponent";

export { BlurNodeComponent };
