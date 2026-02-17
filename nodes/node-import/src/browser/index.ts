import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiDownloadSimple } from "react-icons/pi";
import metadata from "../metadata.js";
import { ImportNodeComponent } from "./import-node-component.js";
import { ImportBrowserProcessor } from "./processor.js";

export const fileNode = defineClient(metadata, {
	Component: ImportNodeComponent,
	mainIconComponent: memo(PiDownloadSimple),
	processor: ImportBrowserProcessor,
});

export default fileNode;
