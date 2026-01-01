import type { OutputItem } from "@gatewai/types";
import { ImagesIcon } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { HandleEntityType } from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { useCanvasCtx } from "../../../ctx/canvas-ctx";
import { useNodeResult } from "../../../processor/processor-ctx";
import { CanvasDesignerEditor } from "../canvas-editor";

const DesignDialog = memo(({ node }: { node: NodeEntityType }) => {
	const { inputs } = useNodeResult(node.id);
	const { onNodeConfigUpdate } = useCanvasCtx();
	const initialLayers = useMemo(() => {
		const items = new Map<
			HandleEntityType["id"],
			OutputItem<"Text"> | OutputItem<"Image">
		>();

		for (const [key, value] of inputs) {
			const handleId = key;
			if (value.outputItem) {
				items.set(
					handleId,
					value.outputItem as OutputItem<"Text"> | OutputItem<"Image">,
				);
			}
		}
		return items;
	}, [inputs]);

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="sm">
					<ImagesIcon /> Edit
				</Button>
			</DialogTrigger>
			<DialogContent
				onEscapeKeyDown={(e) => e.preventDefault()}
				className="max-w-screen! h-screen w-screen! max-h-screen! p-0"
			>
				<CanvasDesignerEditor
					onClose={console.log}
					onSave={console.log}
					initialLayers={initialLayers}
					node={node}
				/>
			</DialogContent>
		</Dialog>
	);
});

export { DesignDialog };
