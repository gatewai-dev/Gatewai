import { defineNode } from "@gatewai/node-sdk/server";
import { metadata } from "../metadata.js";
import { MediaCutProcessor } from "./processor.js";

export default defineNode(metadata, {
	backendProcessor: MediaCutProcessor,
});
