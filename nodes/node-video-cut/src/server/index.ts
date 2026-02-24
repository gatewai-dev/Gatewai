import { defineNode } from "@gatewai/node-sdk/server";
import { metadata } from "../metadata.js";
import { VideoCutProcessor } from "./processor.js";

export default defineNode(metadata, {
	backendProcessor: VideoCutProcessor,
});
