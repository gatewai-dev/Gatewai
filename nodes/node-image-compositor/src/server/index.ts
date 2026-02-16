import { defineNode } from "@gatewai/node-sdk/server";
import { manifest } from "../metadata.js";
import { ImageCompositorProcessor } from "./processor.js";

export const compositorNode = defineNode(manifest, {
	backendProcessor: ImageCompositorProcessor,
});

export default compositorNode;
