import {
	defineNode,
	ServerPassthroughProcessor,
} from "@gatewai/node-sdk/server";
import metadata from "../metadata.js";

export default defineNode(metadata, {
	backendProcessor: ServerPassthroughProcessor,
});
