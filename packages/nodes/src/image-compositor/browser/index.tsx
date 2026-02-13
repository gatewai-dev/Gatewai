import { defineClient } from "@gatewai/node-sdk";
import { manifest } from "../metadata.js";
import { ImageDesignerEditor } from "./canvas-editor/index.js";

export default defineClient(manifest, {
	Component: ((props: any) => {
		// Placeholder wrapper until props allow integration with ImageDesignerEditor
		return <div>Image Compositor Node</div>;
	}) as any, // casting as any temporarily to bypass strict prop validation if ImageDesignerEditor is mismatched
});

export * from "./canvas-editor/index.js";
