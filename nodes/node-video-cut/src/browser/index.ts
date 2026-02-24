import { defineClient } from "@gatewai/node-sdk/browser";
import { PiScissorsThin } from "react-icons/pi";
import { metadata } from "../metadata.js";
import { VideoCutNodeComponent } from "./video-cut-node-component.js";
import { VideoCutBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: VideoCutNodeComponent,
	processor: VideoCutBrowserProcessor,
	mainIconComponent: PiScissorsThin,
});
