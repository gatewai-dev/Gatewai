import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { PiImageSquare } from "react-icons/pi";
import { metadata } from "../metadata.js";
import { SvgNodeComponent } from "./svg-node-component.js";
import { SvgNodeConfigComponent } from "./svg-node-config-component.js";

export * from "./svg-node-component.js";
export * from "./svg-node-config-component.js";

export default defineClient(metadata, {
	Component: SvgNodeComponent,
	ConfigComponent: SvgNodeConfigComponent,
	mainIconComponent: PiImageSquare,
	processor: BrowserPassthroughProcessor,
});
