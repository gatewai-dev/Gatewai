// src/node-palette/iconMap.ts
import { 
PiTextT, PiEye, PiFile, PiDownloadSimple, PiToggleLeft, PiMagnifyingGlass, PiResize, PiUser, PiCube, PiFaceMask, PiPaintBrush, PiCloudFog, PiStack, PiFileText, PiGitBranch, PiNote, PiHash, PiPaintBucket, PiChats
} from "react-icons/pi";

export const NODE_ICON_MAP: Record<
    string,
    React.ComponentType<{ className?: string }>
> = {
    Text: PiTextT,
    Preview: PiEye,
    File: PiFile,
    Export: PiDownloadSimple,
    Toggle: PiToggleLeft,
    Crawler: PiMagnifyingGlass,
    Resize: PiResize,
    Agent: PiUser,
    ThreeD: PiCube,
    Mask: PiFaceMask,
    Painter: PiPaintBrush,
    Blur: PiCloudFog,
    Compositor: PiStack,
    Describer: PiFileText,
    Router: PiGitBranch,
    // Add fallbacks or additional mappings as needed for other NodeTypes
    Note: PiNote,
    Number: PiHash,
    ImageGen: PiPaintBucket,
    LLM: PiChats,
};