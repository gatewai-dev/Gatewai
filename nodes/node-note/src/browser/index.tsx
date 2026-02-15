import { defineClient } from "@gatewai/node-sdk/browser";
import metadata from "../metadata.js";
import { NoteNodeComponent } from "./note-node-component.js";

export default defineClient(metadata, {
	Component: NoteNodeComponent,
});
