import { defineClient } from "@gatewai/node-sdk/browser";
import { PiStack } from "react-icons/pi";
import { manifest } from "../metadata.js";
import { CompositorView } from "./canvas-editor-page/index.js";
import { CompositorNodeComponent } from "./compositor-node/index.js";
import { ImageCompositorBrowserProcessor } from "./processor.js";

export default defineClient(manifest, {
	Component: CompositorNodeComponent,
	PageContentComponent: CompositorView,
	processor: ImageCompositorBrowserProcessor,
	mainIconComponent: PiStack,
});
