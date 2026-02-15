import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { ExportNodeComponent } from "./export-node-component.js";

export default defineClient(metadata, {
	Component: ExportNodeComponent,
});
