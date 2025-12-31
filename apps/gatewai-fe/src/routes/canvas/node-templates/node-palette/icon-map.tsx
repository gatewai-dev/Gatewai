import type { ImageGenConfig, LLMNodeConfig } from "@gatewai/types";
import {
	Claude,
	DeepSeek,
	Gemini,
	Grok,
	MetaAI,
	Nova,
	OpenAI,
	Perplexity,
} from "@lobehub/icons";
import {
	PiChats,
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
	PiImages,
	PiMagnifyingGlass,
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
	Crawler: () => PiMagnifyingGlass,
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
	ImageGen: (node?: NodeEntityType) => {
		const MODEL_ICON_MAP: Record<string, React.ComponentType> = {
			openai: OpenAI,
			google: Gemini.Color,
		};
		if (node && node.type === "ImageGen") {
			const cfg = node.config as ImageGenConfig;
			const provider = cfg.model.split("/")[0];
			return MODEL_ICON_MAP[provider] ?? PiImages;
		}
		return PiImages;
	},
	LLM: (node?: NodeEntityType) => {
		const MODEL_ICON_MAP: Record<string, React.ComponentType> = {
			openai: OpenAI,
			google: Gemini.Color,
			xai: Grok,
			anthropic: Claude.Color,
			perplexity: Perplexity.Color,
			amazon: Nova.Color,
			meta: MetaAI.Color,
			deepseek: DeepSeek.Color,
		};
		if (node && node.type === "LLM") {
			const cfg = node.config as LLMNodeConfig;
			const provider = cfg.model.split("/")[0];
			return MODEL_ICON_MAP[provider] ?? PiChats;
		}
		return PiChats;
	},
};
