import { defineNode } from "@gatewai/node-sdk/server";
import metadata from "../metadata.js";
import { ExportServerProcessor } from "./processor.js";

export const exportNode = defineNode(metadata, {
	backendProcessor: ExportServerProcessor,
});

export default exportNode;
