import { defineClient } from "@gatewai/node-sdk";
import React from "react";
import { manifest } from "../metadata.js";

export const VideoCompositorClient = () => {
	return <div>Video Compositor</div>;
};

export default defineClient(manifest, {
	Component: VideoCompositorClient,
});
