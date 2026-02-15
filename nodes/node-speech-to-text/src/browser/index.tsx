import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { SpeechToTextNodeComponent } from "./speech-to-text-node-component.js";

export default defineClient(metadata, {
	Component: SpeechToTextNodeComponent,
});
