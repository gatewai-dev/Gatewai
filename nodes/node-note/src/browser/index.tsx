import { defineClient } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { PiNote } from "react-icons/pi";
import metadata from "../metadata.js";
import { NoteNodeComponent } from "./note-node-component.js";

export default defineClient(metadata, {
	Component: NoteNodeComponent,
	mainIconComponent: memo(PiNote),
});
