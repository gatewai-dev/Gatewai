import { defineClient } from "@gatewai/node-sdk/browser";
import { PiDownloadSimple } from "react-icons/pi";
import metadata from "../metadata.js";
import { ImportNodeComponent } from "./import-node-component.js";
import { ImportBrowserProcessor } from "./processor.js";

export const fileNode = defineClient(metadata, {
	Component: ImportNodeComponent,
	mainIconComponent: PiDownloadSimple,
	processor: ImportBrowserProcessor,
});

export default fileNode;
