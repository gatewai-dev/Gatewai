import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiStack } from "react-icons/pi";
import { manifest } from "../metadata.js";
import { CompositorView } from "./canvas-editor-page/index.js";
import { CompositorNodeComponent } from "./compositor-node/index.js";
import { imageCompositorBrowserProcessor } from "./processor.js";

// @ts-expect-error - processor is a function not a class constructor yet
export default defineClient(manifest, {
	Component: CompositorNodeComponent,
	PageContentComponent: CompositorView,
	processor: imageCompositorBrowserProcessor,
	mainIconComponent: memo(PiStack),
});
