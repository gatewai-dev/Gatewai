import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { PreviewNodeComponent } from "./preview-node-component.js";

export default defineClient(metadata, {
	Component: PreviewNodeComponent,
});
