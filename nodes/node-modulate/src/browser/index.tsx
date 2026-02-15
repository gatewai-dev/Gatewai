import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { ModulateBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: () => null,
	processor: ModulateBrowserProcessor,
});
