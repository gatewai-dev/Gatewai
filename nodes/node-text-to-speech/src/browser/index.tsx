import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { TextToSpeechNodeComponent } from "./text-to-speech-node-component.js";

export default defineClient(metadata, {
	Component: TextToSpeechNodeComponent,
});
