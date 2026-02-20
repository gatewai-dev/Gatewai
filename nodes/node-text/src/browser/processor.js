import { TextNodeConfigSchema } from "../shared/config.js";
export class TextBrowserProcessor {
	async process({ node, context }) {
		const outputHandle = context.getFirstOutputHandle(node.id, "Text");
		const config = TextNodeConfigSchema.parse(node.config);
		if (!outputHandle) throw new Error("No input handle");
		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: "Text",
							data: config.content ?? "",
							outputHandleId: outputHandle,
						},
					],
				},
			],
		};
	}
}
