import type { IconType } from "react-icons";
import {
	FiCpu,
	FiCrop,
	FiEye,
	FiFilePlus,
	FiGrid,
	FiType,
	FiWind,
} from "react-icons/fi";

// Define the Category type based on our seeding logic
export type NodeCategory = "Quick Access" | "AI" | "Tools" | "Image";
export type NodeSubCategory =
	| "AI Models"
	| "Data Entry"
	| "Files"
	| "Image Labelling"
	| "Effects"
	| "Composition"
	| "Tools";

export const SUB_CATEGORY_MAP: Record<NodeSubCategory, IconType> = {
	"AI Models": FiCpu,
	"Data Entry": FiType,
	Files: FiFilePlus,
	"Image Labelling": FiCrop,
	Effects: FiWind,
	Composition: FiGrid,
	Tools: FiEye,
};
