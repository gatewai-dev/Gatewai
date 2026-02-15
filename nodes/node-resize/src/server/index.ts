import { defineNode } from "@gatewai/node-sdk/server";
import metadata from "../metadata.js";
import { ResizeProcessor } from "./processor.js";

export const resizeNode = defineNode(metadata, { backendProcessor: ResizeProcessor });

export default resizeNode;
