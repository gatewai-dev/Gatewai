import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { PiDownloadSimple } from "react-icons/pi";
import metadata from "../metadata.js";
import { ImportNodeComponent } from "./import-node-component.js";

export const fileNode = defineClient(metadata, {
	Component: ImportNodeComponent,
	mainIconComponent: PiDownloadSimple,
	processor: BrowserPassthroughProcessor,
});

export default fileNode;
