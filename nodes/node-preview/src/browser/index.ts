import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiEye } from "react-icons/pi";
import metadata from "../metadata.js";
import { PreviewNodeComponent } from "./preview-node-component.js";

export default defineClient(metadata, {
	Component: PreviewNodeComponent,
	processor: BrowserPassthroughProcessor,
	mainIconComponent: memo(PiEye),
});
