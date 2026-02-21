import { defineNode } from "@gatewai/node-sdk/server";
import manifest from "../metadata.js";
import { ImageCompositorProcessor } from "./processor.js";

export default defineNode(manifest, {
	backendProcessor: ImageCompositorProcessor,
});
