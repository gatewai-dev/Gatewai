import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { FileNodeComponent } from "./file-node-component.js";

export default defineClient(metadata, {
	Component: FileNodeComponent,
});
