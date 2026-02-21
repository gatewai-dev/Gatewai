import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { TbVolume } from "react-icons/tb";
import metadata from "../metadata.js";
import { TextToSpeechNodeComponent } from "./text-to-speech-node-component.js";
import { TextToSpeechNodeConfigComponent } from "./text-to-speech-node-config-component.js";

export default defineClient(metadata, {
	Component: TextToSpeechNodeComponent,
	ConfigComponent: TextToSpeechNodeConfigComponent,
	mainIconComponent: TbVolume,
	processor: BrowserPassthroughProcessor,
});
