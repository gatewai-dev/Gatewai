import { defineClient } from "@gatewai/node-sdk/browser";
import { PiCropThin } from "react-icons/pi";
import { metadata } from "../metadata.js";
import { VideoCropBrowserProcessor } from "./processor.js";
import { VideoCropNodeComponent } from "./video-crop-node-component.js";

export default defineClient(metadata, {
	Component: VideoCropNodeComponent,
	processor: VideoCropBrowserProcessor,
	mainIconComponent: PiCropThin,
});
