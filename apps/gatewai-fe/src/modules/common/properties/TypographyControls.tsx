import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Italic,
	MoveVertical,
	Type,
	Underline,
} from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DraggableNumberInput } from "@/components/ui/draggable-number-input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ColorPicker } from "@/components/util/color-input";
import { GetFontAssetUrl } from "@/lib/file";
import { fontManager } from "@/lib/fonts";
import { useGetFontListQuery } from "@/store/fonts";
import { CollapsibleSection } from "../CollapsibleSection";

interface TypographyControlsProps {
	fontFamily: string;
	fontSize: number;
	fill: string;
	fontStyle: string; // "italic" | "normal"
	textDecoration: string; // "underline" | ""
	fontWeight: string; // "bold" | "normal"
	align?: string; // "left" | "center" | "right" | "justify"
	letterSpacing?: number;
	lineHeight?: number;

	onChange: (updates: {
		fontFamily?: string;
		fontSize?: number;
		fill?: string;
		fontStyle?: string;
		textDecoration?: string;
		fontWeight?: string;
		align?: string;
		letterSpacing?: number;
		lineHeight?: number;
	}) => void;
}

export const TypographyControls: React.FC<TypographyControlsProps> = ({
	fontFamily,
	fontSize,
	fill,
	fontStyle,
	textDecoration,
	fontWeight,
	align,
	letterSpacing,
	lineHeight,
	onChange,
}) => {
	const { data: fontList } = useGetFontListQuery({});
	const fontNames = useMemo(() => {
		if (Array.isArray(fontList) && (fontList as string[])?.length > 0) {
			return fontList as string[];
		}
		return ["Geist", "Inter", "Arial", "Courier New", "Times New Roman"];
	}, [fontList]);

	const isBold = fontWeight === "bold" || fontStyle?.includes("bold");
	const isItalic = fontStyle?.includes("italic");
	const isUnderline = textDecoration?.includes("underline");

	const toggleStyle = (style: "bold" | "italic") => {
		if (style === "bold") {
			const nextWeight = isBold ? "normal" : "bold";
			onChange({ fontWeight: nextWeight });
		} else if (style === "italic") {
			const nextStyle = isItalic ? "normal" : "italic";
			onChange({ fontStyle: nextStyle });
		}
	};

	const toggleUnderline = () => {
		onChange({ textDecoration: isUnderline ? "" : "underline" });
	};

	return (
		<CollapsibleSection title="Typography" icon={Type}>
			<div className="space-y-4">
				{/* Font Family */}
				<div className="space-y-1.5">
					<Label className="text-[10px] text-gray-500 font-semibold">
						FONT FAMILY
					</Label>
					<Select
						value={fontFamily}
						onValueChange={(val) => {
							const fontUrl = GetFontAssetUrl(val);
							fontManager.loadFont(val, fontUrl).then(() => {
								onChange({ fontFamily: val });
							});
						}}
					>
						<SelectTrigger className="h-8 text-xs bg-neutral-800 border-white/10 text-white">
							<SelectValue placeholder="Select font" />
						</SelectTrigger>
						<SelectContent className="bg-neutral-800 border-white/10 text-white max-h-[200px]">
							{fontNames.map((f) => (
								<SelectItem key={f} value={f} style={{ fontFamily: f }}>
									{f}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Size & Color */}
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1">
						<Label className="text-[10px] text-gray-500 block mb-1 font-semibold">
							SIZE
						</Label>
						<DraggableNumberInput
							icon={Type}
							value={fontSize}
							onChange={(v) => onChange({ fontSize: v })}
							min={1}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-[10px] text-gray-500 block mb-1 font-semibold">
							COLOR
						</Label>
						<ColorPicker
							value={fill}
							onChange={(c) => onChange({ fill: c })}
							className="h-8 w-full"
						/>
					</div>
				</div>

				{/* Style Toggles */}
				<div className="flex p-1 bg-white/5 rounded border border-white/5">
					<Button
						variant={isBold ? "secondary" : "ghost"}
						size="icon"
						className="h-6 flex-1 rounded-sm"
						onClick={() => toggleStyle("bold")}
						title="Bold"
					>
						<Bold className="w-3.5 h-3.5" />
					</Button>
					<Separator
						orientation="vertical"
						className="h-3 my-auto mx-1 bg-white/10"
					/>
					<Button
						variant={isItalic ? "secondary" : "ghost"}
						size="icon"
						className="h-6 flex-1 rounded-sm"
						onClick={() => toggleStyle("italic")}
						title="Italic"
					>
						<Italic className="w-3.5 h-3.5" />
					</Button>
					<Separator
						orientation="vertical"
						className="h-3 my-auto mx-1 bg-white/10"
					/>
					<Button
						variant={isUnderline ? "secondary" : "ghost"}
						size="icon"
						className="h-6 flex-1 rounded-sm"
						onClick={toggleUnderline}
						title="Underline"
					>
						<Underline className="w-3.5 h-3.5" />
					</Button>
				</div>

				{/* Alignment */}
				<div className="space-y-2">
					<Label className="text-[10px] text-gray-500 font-semibold">
						ALIGNMENT
					</Label>
					<div className="flex p-1 bg-white/5 rounded border border-white/5">
						<Button
							variant={align === "left" || !align ? "secondary" : "ghost"}
							size="icon"
							className="h-6 flex-1 rounded-sm"
							onClick={() => onChange({ align: "left" })}
							title="Align Left"
						>
							<AlignLeft className="w-3.5 h-3.5" />
						</Button>
						<Button
							variant={align === "center" ? "secondary" : "ghost"}
							size="icon"
							className="h-6 flex-1 rounded-sm"
							onClick={() => onChange({ align: "center" })}
							title="Align Center"
						>
							<AlignCenter className="w-3.5 h-3.5" />
						</Button>
						<Button
							variant={align === "right" ? "secondary" : "ghost"}
							size="icon"
							className="h-6 flex-1 rounded-sm"
							onClick={() => onChange({ align: "right" })}
							title="Align Right"
						>
							<AlignRight className="w-3.5 h-3.5" />
						</Button>
					</div>
				</div>

				{/* Vertical Alignment (Removed) */}

				{/* Spacing & Line Height */}
				<div className="grid grid-cols-2 gap-3">
					<DraggableNumberInput
						label="L. Space"
						icon={Type}
						value={letterSpacing ?? 0}
						onChange={(v) => onChange({ letterSpacing: v })}
						step={0.1}
					/>
					<DraggableNumberInput
						label="L. Height"
						icon={MoveVertical}
						value={lineHeight ?? 1.2}
						onChange={(v) => onChange({ lineHeight: v })}
						step={0.1}
						allowDecimal
					/>
				</div>
			</div>
		</CollapsibleSection>
	);
};
