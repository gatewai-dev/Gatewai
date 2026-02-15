import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { ModulateNodeComponent } from "./modulate-node-component.js";
import { ModulateBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: ModulateNodeComponent,
	processor: ModulateBrowserProcessor,
});
