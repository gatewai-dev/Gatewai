import { defineClient } from "@gatewai/node-sdk/browser";
import { PiScissorsThin } from "react-icons/pi";
import { metadata } from "../metadata.js";
import { MediaCutNodeComponent } from "./media-cut-node-component.js";
import { MediaCutBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: MediaCutNodeComponent,
	processor: MediaCutBrowserProcessor,
	mainIconComponent: PiScissorsThin,
});
