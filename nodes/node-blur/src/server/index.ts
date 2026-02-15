import { defineNode } from "@gatewai/node-sdk/server";
import { metadata } from "../metadata.js";
import { BlurProcessor } from "./processor.js";

export const blurNode = defineNode(metadata, {
	backendProcessor: BlurProcessor,
});

export default blurNode;
