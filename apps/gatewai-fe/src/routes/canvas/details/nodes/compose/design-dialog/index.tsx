import type { OutputItem } from "@gatewai/types";
import { ImagesIcon } from "lucide-react";
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useAppSelector } from "@/store";
import { makeSelectEdgesByTargetNodeId } from "@/store/edges";
import {
	type HandleEntityType,
	makeSelectHandlesByNodeId,
} from "@/store/handles";
import type { NodeEntityType } from "@/store/nodes";
import { useNodeResult } from "../../../processor/processor-ctx";
import { CanvasDesignerEditor } from "../canvas-editor";

const DesignDialog = memo(({ node }: { node: NodeEntityType }) => {
	const { inputs } = useNodeResult(node.id);
	const handles = useAppSelector(makeSelectHandlesByNodeId(node.id));
	const edges = useAppSelector(makeSelectEdgesByTargetNodeId(node.id));
	console.log({ inputs });
	const initialLayers = useMemo(() => {
		const items = new Map<
			HandleEntityType["id"],
			OutputItem<"Text">[] | OutputItem<"Image">
		>();
		for (const item of inputs) {
			const handleId = item[0];
			const sourceHandleId = edges.find(
				(f) => f.targetHandleId === handleId,
			)?.sourceHandleId;
			if (!sourceHandleId) continue;

			const inputItem = item[1].outputs[item[1].selectedOutputIndex].items.find(
				(f) => f.outputHandleId === sourceHandleId,
			) as OutputItem<"Image">;
			if (inputItem) {
				items.set(handleId, inputItem);
			}
		}
		return items;
	}, [inputs, edges]);

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="sm">
					<ImagesIcon /> Edit
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-screen! h-screen w-screen! max-h-screen!">
				<CanvasDesignerEditor
					onSave={console.log}
					initialLayers={initialLayers}
				/>
			</DialogContent>
		</Dialog>
	);
});

export { DesignDialog };
