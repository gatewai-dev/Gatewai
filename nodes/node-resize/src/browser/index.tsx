import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { ResizeBrowserProcessor } from "./processor.js";
import { ResizeNodeComponent } from "./resize-node-component.js";

export default defineClient(metadata, {
	Component: ResizeNodeComponent,
	processor: ResizeBrowserProcessor,
});
