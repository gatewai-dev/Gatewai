import { defineNode } from "@gatewai/node-sdk/server";
import metadata from "../metadata.js";
import { TextToSpeechProcessor } from "./processor.js";

export default defineNode(metadata, {
	backendProcessor: TextToSpeechProcessor,
});
