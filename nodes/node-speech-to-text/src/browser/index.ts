import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { PiMicrophone } from "react-icons/pi";
import metadata from "../metadata.js";
import { SpeechToTextNodeComponent } from "./speech-to-text-node-component.js";

export default defineClient(metadata, {
	Component: SpeechToTextNodeComponent,
	mainIconComponent: PiMicrophone,
	processor: BrowserPassthroughProcessor,
});
