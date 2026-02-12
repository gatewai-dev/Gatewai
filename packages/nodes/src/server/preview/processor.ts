import type {
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import { injectable } from "tsyringe";

@injectable()
export class PreviewProcessor implements NodeProcessor {
	async process(): Promise<BackendNodeProcessorResult> {
		return {
			success: true,
		};
	}
}

export default PreviewProcessor;
