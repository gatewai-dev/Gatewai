import { Button, type ButtonProps } from "@/components/ui/button";
import { generateId } from "@/lib/idgen";
import { type HandleEntityType } from "@/store/handles";
import type { NodeProps } from "@xyflow/react";
import type { ImageGenNode } from "../node-props";
import { PlusIcon } from "lucide-react";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

export type CreateHandleButtonProps = ButtonProps & {
  nodeProps: NodeProps<ImageGenNode>;
};

function CreateHandleButton({nodeProps, ...restProps}: CreateHandleButtonProps) {
    const { createNewHandle } = useCanvasCtx();
    const onClickButton = () => {
        const handleEntity: HandleEntityType = {
            id: generateId(),
            nodeId: nodeProps.id,
            dataTypes: ['Image'],
            type: 'Input',
            required: false,
            order: 2,
            templateHandleId: null,
            label: 'Reference Image 2',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        createNewHandle(handleEntity);
    };
    return (<Button size="xs" variant="outline" {...restProps} onClick={() => onClickButton()}>
            <PlusIcon className="w-3 h-3" />
                Reference Image
            </Button>);
}

export { CreateHandleButton };