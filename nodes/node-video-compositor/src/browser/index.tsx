import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiFilmReelLight } from "react-icons/pi";
import manifest from "../metadata.js";
import { VideoCompositorNodeComponent } from "./node-component.js";
import { VideoCompositorView } from "./video-editor/video-compose-view/index.js";

export default defineClient(manifest, {
	Component: VideoCompositorNodeComponent,
	PageContentComponent: VideoCompositorView,
	mainIconComponent: memo(PiFilmReelLight),
});
