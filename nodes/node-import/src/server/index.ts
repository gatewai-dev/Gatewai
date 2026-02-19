import {
	defineNode,
	ServerPassthroughProcessor,
} from "@gatewai/node-sdk/server";
import metadata from "../metadata.js";
import { importNodeRouter } from "./router.js";

export type ImportNodeRouterType = typeof importNodeRouter;

export default defineNode(metadata, {
	backendProcessor: ServerPassthroughProcessor,
	route: importNodeRouter,
});
