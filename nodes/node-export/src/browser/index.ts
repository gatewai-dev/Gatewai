import { defineClient } from "@gatewai/node-sdk/browser";
import { PiUploadSimple } from "react-icons/pi";
import metadata from "../metadata.js";
import { ExportNodeComponent } from "./export-node-component.js";
import { ExportBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: ExportNodeComponent,
	mainIconComponent: PiUploadSimple,
	processor: ExportBrowserProcessor,
});
