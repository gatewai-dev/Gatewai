import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiDownloadSimple } from "react-icons/pi";
import metadata from "../metadata.js";
import { FileNodeComponent } from "./file-node-component.js";

export default defineClient(metadata, {
	Component: FileNodeComponent,
	mainIconComponent: memo(PiDownloadSimple),
});
