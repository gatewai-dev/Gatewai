import { type NodePackage, registeredNodes } from "@gatewai/nodes/registry";
import React, { lazy } from "react";
import { BlurNodeComponent } from "./blur";
import { CompositorNodeComponent } from "./compose";
import { CropNodeComponent } from "./crop";
import { ExportNodeComponent } from "./export";
import { FileNodeComponent } from "./file";
import { ImageGenNodeComponent } from "./image-gen";
import { LlmNodeComponent } from "./llm";
import { ModulateNodeComponent } from "./modulate";
import { PaintNodeComponent } from "./paint";
import { PreviewNodeComponent } from "./preview";
import { ResizeNodeComponent } from "./resize";
import { SpeechToTextNodeComponent } from "./speech-to-text";
import { NoteNodeComponent } from "./sticky-note";
import { TextNodeComponent } from "./text";
import { TextMergerNodeComponent } from "./text-merger";
import { TextToSpeechNodeComponent } from "./text-to-speech";
import { VideoCompositorNodeComponent } from "./video-compose";
import { VideoGenNodeComponent } from "./video-gen";
import { VideoGenExtendNodeComponent } from "./video-gen-extend";
import { VideoGenFirstLastFrameNodeComponent } from "./video-gen-first-last-frame";

const wrapRegistryComponent = (nodePackage: NodePackage) => {
	return lazy(async () => {
		const module = await nodePackage.client;
		return { default: module.default.Component };
	});
};

export const loadNodeTypes = async () => {
	const nodeTypes: Record<string, any> = {
		LLM: LlmNodeComponent,
		Text: TextNodeComponent,
		ImageGen: ImageGenNodeComponent,
		Blur: BlurNodeComponent,
		Resize: ResizeNodeComponent,
		File: FileNodeComponent,
		Crop: CropNodeComponent,
		Paint: PaintNodeComponent,
		Note: NoteNodeComponent,
		Preview: PreviewNodeComponent,
		Modulate: ModulateNodeComponent,
		Export: ExportNodeComponent,
		Compositor: CompositorNodeComponent,
		VideoGen: VideoGenNodeComponent,
		VideoGenExtend: VideoGenExtendNodeComponent,
		VideoGenFirstLastFrame: VideoGenFirstLastFrameNodeComponent,
		SpeechToText: SpeechToTextNodeComponent,
		TextToSpeech: TextToSpeechNodeComponent,
		VideoCompositor: VideoCompositorNodeComponent,
		TextMerger: TextMergerNodeComponent,
	};

	Object.keys(registeredNodes).forEach((key) => {
		const nodePackage = registeredNodes[key];
		nodeTypes[nodePackage.metadata.type] = wrapRegistryComponent(nodePackage);
	});

	return nodeTypes;
};
