import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiCropThin } from "react-icons/pi";
import { metadata } from "../metadata.js";
import { CropNodeComponent } from "./crop-node-component.js";
import { CropBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: CropNodeComponent,
	processor: CropBrowserProcessor,
	mainIconComponent: memo(PiCropThin),
});
