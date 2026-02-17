import { defineClient } from "@gatewai/node-sdk/browser";
import { PiPaintBrushFill } from "react-icons/pi";
import metadata from "../metadata.js";
import { PaintNodeComponent } from "./paint-node-component.js";
import { PaintBrowserProcessor } from "./processor.js";

export default defineClient(metadata, {
	Component: PaintNodeComponent,
	processor: PaintBrowserProcessor,
	mainIconComponent: PiPaintBrushFill,
});
