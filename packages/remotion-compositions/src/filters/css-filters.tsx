import type React from "react";
import { buildCSSFilterString } from "../utils/apply-operations.js";

interface CSSFiltersProps {
	filters?: {
		brightness?: number;
		contrast?: number;
		saturation?: number;
		hueRotate?: number;
		blur?: number;
		grayscale?: number;
		sepia?: number;
		invert?: number;
	};
	children: React.ReactNode;
}

export const CSSFilters: React.FC<CSSFiltersProps> = ({
	filters,
	children,
}) => {
	if (!filters) return <>{children}</>;

	const defaults = {
		brightness: 100,
		contrast: 100,
		saturation: 100,
		hueRotate: 0,
		blur: 0,
		grayscale: 0,
		sepia: 0,
		invert: 0,
	};

	const filterString = buildCSSFilterString({ ...defaults, ...filters });

	return (
		<div style={{ filter: filterString, width: "100%", height: "100%" }}>
			{children}
		</div>
	);
};
