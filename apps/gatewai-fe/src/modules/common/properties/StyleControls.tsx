import { ImageIcon, Move } from "lucide-react";
import type React from "react";
import { DraggableNumberInput } from "@/components/ui/draggable-number-input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/util/color-input";
import { CollapsibleSection } from "../CollapsibleSection";

// We need a fallback for constants if they are not passed
const DEFAULTS = {
	STROKE: "#000000",
	STROKE_WIDTH: 0,
	CORNER_RADIUS: 0,
	PADDING: 0,
	FILL: "#ffffff",
};

interface StyleControlsProps {
	stroke?: string;
	strokeWidth?: number;
	cornerRadius?: number;
	padding?: number;
	backgroundColor?: string;
	opacity?: number;

	// Config options to show/hide sections
	showCornerRadius?: boolean;
	showPadding?: boolean;
	showBackground?: boolean;
	showOpacity?: boolean;
	showStroke?: boolean;

	onChange: (updates: {
		stroke?: string;
		strokeWidth?: number;
		cornerRadius?: number;
		padding?: number;
		backgroundColor?: string;
		opacity?: number;
	}) => void;
}

export const StyleControls: React.FC<StyleControlsProps> = ({
	stroke,
	strokeWidth,
	cornerRadius,
	padding,
	backgroundColor,
	opacity,
	showCornerRadius = true,
	showPadding = true,
	showBackground = false,
	showOpacity = true,
	showStroke = true,
	onChange,
}) => {
	// Only render if at least one section is visible
	if (
		!showCornerRadius &&
		!showPadding &&
		!showBackground &&
		!showOpacity &&
		!showStroke
	) {
		return null;
	}

	return (
		<CollapsibleSection title="Style" icon={ImageIcon}>
			<div className="space-y-4">
				{/* Background */}
				{showBackground && (
					<div className="space-y-2">
						<Label className="text-[10px] text-gray-500 font-semibold">
							BACKGROUND
						</Label>
						<ColorPicker
							value={backgroundColor ?? "transparent"}
							onChange={(c) => onChange({ backgroundColor: c })}
							className="h-8 w-full"
						/>
					</div>
				)}

				{/* Opacity */}
				{showOpacity && (
					<div className="space-y-2">
						<Label className="text-[10px] text-gray-500 font-semibold">
							OPACITY
						</Label>
						<DraggableNumberInput
							label="%"
							icon={Move}
							value={(opacity ?? 1) * 100}
							onChange={(v) => onChange({ opacity: v / 100 })}
							min={0}
							max={100}
						/>
					</div>
				)}

				{/* Border / Stroke */}
				{showStroke && (
					<div className="space-y-2">
						<Label className="text-[10px] text-gray-500 font-semibold">
							BORDER
						</Label>
						<div className="flex gap-2">
							<div className="space-y-1 flex-1">
								<Label className="text-[9px] text-gray-500">COLOR</Label>
								<ColorPicker
									value={stroke ?? DEFAULTS.STROKE}
									onChange={(c) => onChange({ stroke: c })}
									className="h-8 w-full"
								/>
							</div>
							<div className="space-y-1 w-[80px]">
								<Label className="text-[9px] text-gray-500">WIDTH</Label>
								<DraggableNumberInput
									icon={Move}
									value={strokeWidth ?? DEFAULTS.STROKE_WIDTH}
									onChange={(v) => onChange({ strokeWidth: v })}
									min={0}
								/>
							</div>
						</div>
					</div>
				)}

				{/* Corner Radius */}
				{showCornerRadius && (
					<div className="space-y-2">
						<Label className="text-[10px] text-gray-500 font-semibold">
							CORNER RADIUS
						</Label>
						<DraggableNumberInput
							icon={Move}
							value={cornerRadius ?? DEFAULTS.CORNER_RADIUS}
							onChange={(v) => onChange({ cornerRadius: v })}
							min={0}
						/>
					</div>
				)}

				{/* Padding */}
				{showPadding && (
					<div className="space-y-2">
						<Label className="text-[10px] text-gray-500 font-semibold">
							PADDING
						</Label>
						<DraggableNumberInput
							icon={Move}
							value={padding ?? DEFAULTS.PADDING}
							onChange={(v) => onChange({ padding: v })}
							min={0}
						/>
					</div>
				)}
			</div>
		</CollapsibleSection>
	);
};
