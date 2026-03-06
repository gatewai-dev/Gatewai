import { defineClient } from "@gatewai/node-sdk/browser";
import { PiCloudFog } from "react-icons/pi";
import { metadata } from "../metadata.js";
import { BlurNodeComponent } from "./blur-node-component.js";
import { BlurBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: BlurNodeComponent,
	processor: BlurBrowserProcessor,
	mainIconComponent: PiCloudFog,
});
