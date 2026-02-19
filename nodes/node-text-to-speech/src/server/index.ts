import { defineNode } from "@gatewai/node-sdk/server";
import metadata from "../metadata.js";
import { TextToSpeechProcessor } from "./processor";

export default defineNode(metadata, {
	backendProcessor: TextToSpeechProcessor,
});
