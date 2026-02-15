import { defineNode } from "@gatewai/node-sdk/server";
import { metadata } from "../metadata.js";
import { BlurProcessor } from "./processor.js";

export default defineNode(metadata, {
	backendProcessor: BlurProcessor,
});
