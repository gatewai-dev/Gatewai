import metadata from "../metadata.js";
import { defineNode } from "@gatewai/node-sdk/server";
import { ImageGenProcessor } from "./processor.js";

export default defineNode(metadata, { backendProcessor: ImageGenProcessor });