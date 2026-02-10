import { DataType } from "@gatewai/db";
import type { BackendNodeProcessor } from "@gatewai/node-sdk";
import type { TextMergerNodeConfig, TextMergerResult } from "@gatewai/types";

const textMergerProcessor: BackendNodeProcessor = async ({
	node,
	data,
	graph,
}) => {
	try {
		const textInputs = graph.getInputValuesByType(data, node.id, {
			dataType: DataType.Text,
		});

		const nodeConfig = node.config as TextMergerNodeConfig;
		const joinString = nodeConfig?.join ?? "\n";

		const texts = textInputs
			.filter((v): v is NonNullable<typeof v> => v !== null && v !== undefined)
			.map((v) => String(v.data));
		const merged = texts.join(joinString);

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle)
			return { success: false, error: "Output handle is missing." };

		const newResult: TextMergerResult = {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: DataType.Text,
							data: merged,
							outputHandleId: outputHandle.id,
						},
					],
				},
			],
		};

		return { success: true, newResult };
	} catch (err: unknown) {
		if (err instanceof Error) {
			return { success: false, error: err.message };
		}
		return { success: false, error: "Text merger processing failed" };
	}
};

export default textMergerProcessor;
