import {
	defineNode,
	ServerPassthroughProcessor,
} from "@gatewai/node-sdk/server";
import metadata from "../metadata.js";

export const fileNode = defineNode(metadata, {
	backendProcessor: ServerPassthroughProcessor,
});

export default fileNode;
