import {
	BrowserPassthroughProcessor,
	defineClient,
} from "@gatewai/node-sdk/browser";
import { PiFilmReelLight } from "react-icons/pi";
import { metadata } from "../metadata.js";
import { VideoCompositorNodeComponent } from "./node-component.js";
import { VideoCompositorView } from "./video-editor/video-compose-view/index.js";

export default defineClient(metadata, {
	Component: VideoCompositorNodeComponent,
	PageContentComponent: VideoCompositorView,
	mainIconComponent: PiFilmReelLight,
	processor: BrowserPassthroughProcessor,
});
