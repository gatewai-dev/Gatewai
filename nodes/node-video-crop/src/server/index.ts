import { defineNode } from "@gatewai/node-sdk/server";
import { metadata } from "../metadata.js";
import { VideoCropProcessor } from "./processor.js";

export const videoCropNode = defineNode(metadata, {
	backendProcessor: VideoCropProcessor,
});

export default videoCropNode;
