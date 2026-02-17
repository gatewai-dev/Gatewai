import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiMicrophone } from "react-icons/pi";
import metadata from "../metadata.js";
import { SpeechToTextNodeComponent } from "./speech-to-text-node-component.js";

export default defineClient(metadata, {
	Component: SpeechToTextNodeComponent,
	mainIconComponent: memo(PiMicrophone),
});
