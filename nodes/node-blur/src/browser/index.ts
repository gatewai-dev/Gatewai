import { defineClient } from "@gatewai/node-sdk/browser";
import { metadata } from "../metadata.js";
import { BlurNodeComponent } from "./blur-node-component.js";
import { blurBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: BlurNodeComponent,
	processor: blurBrowserProcessor,
});
