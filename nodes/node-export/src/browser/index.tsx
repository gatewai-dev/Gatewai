import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiUploadSimple } from "react-icons/pi";
import metadata from "../metadata.js";
import { ExportNodeComponent } from "./export-node-component.js";

export default defineClient(metadata, {
	Component: ExportNodeComponent,
	mainIconComponent: memo(PiUploadSimple),
});
