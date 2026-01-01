import { ImagesIcon } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { NodeEntityType } from "@/store/nodes";
import {
	useMultipleNodeResults,
	useNodeResult,
} from "../../../processor/processor-ctx";
import { CanvasDesignerEditor } from "../canvas-editor";

const DesignDialog = memo(({ node }: { node: NodeEntityType }) => {
	const { inputs } = useNodeResult(node.id);
	console.log({ inputs });
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="sm">
					<ImagesIcon /> Edit
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-screen! h-screen w-screen! max-h-screen!">
				<CanvasDesignerEditor onSave={console.log} initialLayers={[]} />
			</DialogContent>
		</Dialog>
	);
});

export { DesignDialog };
