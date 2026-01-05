import { Gemini } from "@lobehub/icons";
import {
	PiCloudFog,
	PiCropThin,
	PiCube,
	PiDownloadSimple,
	PiDropDuotone,
	PiEye,
	PiFaceMask,
	PiFileText,
	PiGitBranch,
	PiHash,
	PiNote,
	PiPaintBrushFill,
	PiResize,
	PiRobotLight,
	PiStack,
	PiTextT,
	PiToggleLeft,
	PiUploadSimple,
} from "react-icons/pi";
import type { NodeEntityType } from "@/store/nodes";

export const NODE_ICON_MAP: Record<
	string,
	(node?: NodeEntityType) => React.ComponentType
> = {
	Text: () => PiTextT,
	Preview: () => PiEye,
	File: () => PiUploadSimple,
	Export: () => PiDownloadSimple,
	Toggle: () => PiToggleLeft,
	Resize: () => PiResize,
	Agent: () => PiRobotLight,
	ThreeD: () => PiCube,
	Mask: () => PiFaceMask,
	Paint: () => PiPaintBrushFill,
	Crop: () => PiCropThin,
	Blur: () => PiCloudFog,
	Compositor: () => PiStack,
	Describer: () => PiFileText,
	Router: () => PiGitBranch,
	// Add fallbacks or additional mappings as needed for other NodeTypes
	Note: () => PiNote,
	Number: () => PiHash,
	Modulate: () => PiDropDuotone,
	ImageGen: () => Gemini.Color,
	LLM: () => Gemini.Color,
	VideoGen: () => Gemini.Color,
	VideoGenFirstLastFrame: () => Gemini.Color,
	VideoGenExtend: () => Gemini.Color,
	TextToSpeech: () => Gemini.Color,
	SpeechToText: () => Gemini.Color,
};
