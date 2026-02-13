import type { NodeProcessor } from "@gatewai/node-sdk";
import { injectable } from "tsyringe";
import { manifest } from "../metadata.js";

@injectable()
export class VideoCompositorProcessor implements NodeProcessor {
	async process() {
		// Implementation placeholder
		return {};
	}
}
