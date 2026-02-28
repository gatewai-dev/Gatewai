import { defineNode } from "@gatewai/node-sdk/server";
import { metadata } from "../metadata.js";
import { LottieProcessor } from "./processor.js";

export * from "./processor.js";

export default defineNode(metadata, {
	backendProcessor: LottieProcessor,
});
