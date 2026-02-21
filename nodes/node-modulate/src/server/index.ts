import { defineNode } from "@gatewai/node-sdk/server";
import { metadata } from "../metadata.js";
import { ModulateProcessor } from "./processor.js";

export const modulateNode = defineNode(metadata, {
	backendProcessor: ModulateProcessor,
});

export default modulateNode;
