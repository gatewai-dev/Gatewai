import { LuPlus } from "react-icons/lu";
import { Button, type ButtonProps } from "@/components/ui/button";
import { generateId } from "@/lib/idgen";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

export type CreateHandleButtonProps = ButtonProps & {
	nodeId: NodeEntityType["id"];
};

function CreateHandleButton({ nodeId, ...restProps }: CreateHandleButtonProps) {
	const { createNewHandle } = useCanvasCtx();
	const onClickButton = () => {
		const handleEntity: HandleEntityType = {
			id: generateId(),
			nodeId,
			description: null,
			dataTypes: ["Image"],
			type: "Input",
			required: false,
			order: 2,
			templateHandleId: null,
			label: "Reference Image",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		createNewHandle(handleEntity);
	};
	return (
		<Button
			size="xs"
			variant="outline"
			{...restProps}
			onClick={() => onClickButton()}
		>
			<LuPlus className="size-3" />
			Reference Image
		</Button>
	);
}

export { CreateHandleButton };
