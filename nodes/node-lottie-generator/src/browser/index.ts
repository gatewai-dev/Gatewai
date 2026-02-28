import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { PiShapes } from "react-icons/pi";
import { metadata } from "../metadata.js";
import { LottieNodeComponent } from "./lottie-node-component.js";
import { LottieNodeConfigComponent } from "./lottie-node-config-component.js";

export * from "./lottie-node-component.js";
export * from "./lottie-node-config-component.js";

export default defineClient(metadata, {
	Component: LottieNodeComponent,
	ConfigComponent: LottieNodeConfigComponent,
	mainIconComponent: PiShapes,
	processor: BrowserPassthroughProcessor,
});
