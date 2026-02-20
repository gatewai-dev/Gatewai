import { defineNode } from "@gatewai/node-sdk/server";
import { metadata } from "@/metadata.js";
import { CropProcessor } from "./processor.js";

export const cropNode = defineNode(metadata, {
	backendProcessor: CropProcessor,
});

export default cropNode;
