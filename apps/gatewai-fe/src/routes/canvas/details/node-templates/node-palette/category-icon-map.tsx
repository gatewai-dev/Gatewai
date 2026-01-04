import type { IconType } from "react-icons";
import {
	FiCpu,
	FiCrop,
	FiDatabase,
	FiEdit3,
	FiEye,
	FiFilePlus,
	FiGrid,
	FiLayers,
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

interface CategoryMetadata {
	icon: IconType;
	color: string; // Useful for styling the sidebar or node headers
}

export const CATEGORY_MAP: Record<NodeCategory, CategoryMetadata> = {
	"Quick Access": {
		icon: FiGrid,
		color: "#6B7280", // Gray
	},
	AI: {
		icon: FiCpu,
		color: "#8B5CF6", // Purple
	},
	Tools: {
		icon: FiDatabase,
		color: "#3B82F6", // Blue
	},
	Image: {
		icon: FiCrop,
		color: "#10B981", // Emerald
	},
};

export const SUB_CATEGORY_MAP: Record<NodeSubCategory, IconType> = {
	"AI Models": FiCpu,
	"Data Entry": FiType,
	Files: FiFilePlus,
	"Image Labelling": FiCrop,
	Effects: FiWind,
	Composition: FiGrid,
	Tools: FiEye,
};
