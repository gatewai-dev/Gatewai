import { Gemini } from "@lobehub/icons";
import type { FC } from "react";
import {
	PiArrowsHorizontal,
	PiArrowsMerge,
	PiBrain,
	PiCloudFog,
	PiCropThin,
	PiDownloadSimple,
	PiDropDuotone,
	PiEye,
	PiFilmReelLight,
	PiFrameCorners,
	PiHash,
	PiMagicWand,
	PiMicrophone,
	PiNote,
	PiPaintBrushFill,
	PiResize,
	PiRobotLight,
	PiSpeakerHifi,
	PiStack,
	PiTextT,
	PiToggleLeft,
	PiUploadSimple,
	PiVideoCamera,
} from "react-icons/pi";
import type { NodeEntityType } from "@/store/nodes";

export const NODE_ICON_MAP: Record<
	NodeEntityType["type"],
	{
		mainIcon: FC<{ className?: string }>;
		optionalIcons?: FC<{ className?: string }>[];
	}
> = {
	Text: { mainIcon: PiTextT },
	TextMerger: { mainIcon: PiArrowsMerge },
	VideoCompositor: { mainIcon: PiFilmReelLight },
	Preview: { mainIcon: PiEye },
	File: { mainIcon: PiUploadSimple },
	Export: { mainIcon: PiDownloadSimple },
	Toggle: { mainIcon: PiToggleLeft },
	Resize: { mainIcon: PiResize },
	Agent: { mainIcon: PiRobotLight },
	Paint: { mainIcon: PiPaintBrushFill },
	Crop: { mainIcon: PiCropThin },
	Blur: { mainIcon: PiCloudFog },
	Compositor: { mainIcon: PiStack },
	Note: { mainIcon: PiNote },
	Number: { mainIcon: PiHash },
	Modulate: { mainIcon: PiDropDuotone },
	ImageGen: { mainIcon: PiMagicWand, optionalIcons: [Gemini.Color] },
	LLM: { mainIcon: PiBrain, optionalIcons: [Gemini.Color] },
	VideoGen: { mainIcon: PiVideoCamera, optionalIcons: [Gemini.Color] },
	VideoGenFirstLastFrame: {
		mainIcon: PiFrameCorners,
		optionalIcons: [Gemini.Color],
	},
	VideoGenExtend: {
		mainIcon: PiArrowsHorizontal,
		optionalIcons: [Gemini.Color],
	},
	TextToSpeech: { mainIcon: PiSpeakerHifi, optionalIcons: [Gemini.Color] },
	SpeechToText: { mainIcon: PiMicrophone, optionalIcons: [Gemini.Color] },
};
