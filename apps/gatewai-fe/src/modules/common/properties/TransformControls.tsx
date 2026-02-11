import {
	AlignCenterHorizontal,
	AlignCenterVertical,
	Move,
	MoveHorizontal,
	MoveVertical,
	RotateCw,
} from "lucide-react";
import type React from "react";
import { Button } from "@gatewai/ui-kit";
import { DraggableNumberInput } from "@gatewai/ui-kit";
import { Label } from "@gatewai/ui-kit";
import { Switch } from "@gatewai/ui-kit";
import { CollapsibleSection } from "../CollapsibleSection";

interface TransformControlsProps {
	x: number;
	y: number;
	width?: number;
	height?: number;
	rotation: number;
	scale?: number;
	lockAspect?: boolean;

	// Config
	showDimensions?: boolean;
	showScale?: boolean;
	showLockAspect?: boolean;

	onChange: (updates: {
		x?: number;
		y?: number;
		width?: number;
		height?: number;
		rotation?: number;
		scale?: number;
		lockAspect?: boolean;
	}) => void;

	onCenter?: (axis: "x" | "y") => void;
}

export const TransformControls: React.FC<TransformControlsProps> = ({
	x,
	y,
	width,
	height,
	rotation,
	scale,
	lockAspect,
	showDimensions = true,
	showScale = false,
	showLockAspect = false,
	onChange,
	onCenter,
}) => {
	return (
		<CollapsibleSection title="Transform" icon={Move}>
			<div className="space-y-3">
				<div className="flex gap-1">
					<Button
						variant="outline"
						size="sm"
						className="flex-1 h-7 text-[10px] border-white/10 bg-white/5 hover:bg-white/10 hover:text-white text-gray-400"
						onClick={() => onCenter?.("x")}
					>
						<AlignCenterHorizontal className="w-3 h-3 mr-1" /> Center X
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="flex-1 h-7 text-[10px] border-white/10 bg-white/5 hover:bg-white/10 hover:text-white text-gray-400"
						onClick={() => onCenter?.("y")}
					>
						<AlignCenterVertical className="w-3 h-3 mr-1" /> Center Y
					</Button>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<DraggableNumberInput
						label="X"
						icon={MoveHorizontal}
						value={Math.round(x)}
						onChange={(v) => onChange({ x: v })}
					/>
					<DraggableNumberInput
						label="Y"
						icon={MoveVertical}
						value={Math.round(y)}
						onChange={(v) => onChange({ y: v })}
					/>
					{showDimensions && (
						<>
							<DraggableNumberInput
								label="W"
								icon={MoveHorizontal}
								value={Math.round(width ?? 0)}
								onChange={(newWidth) => {
									if (lockAspect && width && height) {
										const ratio = height / width;
										onChange({
											width: newWidth,
											height: newWidth * ratio,
										});
									} else {
										onChange({ width: newWidth });
									}
								}}
								min={1}
							/>
							<DraggableNumberInput
								label="H"
								icon={MoveVertical}
								value={Math.round(height ?? 0)}
								onChange={(newHeight) => {
									if (lockAspect && width && height) {
										const ratio = width / height;
										onChange({
											height: newHeight,
											width: newHeight * ratio,
										});
									} else {
										onChange({ height: newHeight });
									}
								}}
								min={1}
							/>
						</>
					)}
					{showScale && (
						<DraggableNumberInput
							label="Scale"
							icon={Move}
							value={scale ?? 1}
							step={0.01}
							onChange={(v) => onChange({ scale: v })}
							allowDecimal
						/>
					)}
					<DraggableNumberInput
						label="Rot"
						icon={RotateCw}
						value={Math.round(rotation)}
						onChange={(v) => onChange({ rotation: v })}
						className={showScale ? "" : "col-span-2"}
					/>
				</div>

				{showLockAspect && (
					<div className="flex items-center justify-between pt-2">
						<Label className="text-[10px] text-gray-400">
							Lock Aspect Ratio
						</Label>
						<Switch
							checked={lockAspect ?? true}
							onCheckedChange={(c) => onChange({ lockAspect: c })}
							className="scale-75 data-[state=checked]:bg-blue-600"
						/>
					</div>
				)}
			</div>
		</CollapsibleSection>
	);
};
