import * as SliderPrimitive from "@radix-ui/react-slider";
import { Check, Copy, Pipette } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

// --- Types ---

interface HSVA {
	h: number;
	s: number;
	v: number;
	a: number;
}

interface ColorPickerProps {
	value: string;
	onChange: (value: string) => void;
	className?: string;
	disabled?: boolean;
	showAlpha?: boolean;
	presets?: string[];
}

// --- Color Utility Logic ---

const clamp = (number: number, min: number, max: number) => {
	return Math.min(Math.max(number, min), max);
};

const hsvaToRgba = ({ h, s, v, a }: HSVA) => {
	const f = (n: number, k = (n + h / 60) % 6) =>
		v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
	const rgb = [f(5), f(3), f(1)].map((v) => Math.round(v * 255));
	return { r: rgb[0], g: rgb[1], b: rgb[2], a };
};

const hsvaToHex = (hsva: HSVA, includeAlpha: boolean = true) => {
	const { r, g, b, a } = hsvaToRgba(hsva);
	const toHex = (n: number) => n.toString(16).padStart(2, "0");
	let hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	if (includeAlpha) {
		hex += toHex(Math.round(a * 255));
	}
	return hex;
};

const rgbaToHsva = (r: number, g: number, b: number, a: number): HSVA => {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	const s = max === 0 ? 0 : d / max;
	const v = max;
	let h = 0;

	if (max !== min) {
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return { h: h * 360, s, v, a };
};

const parseColorToHsva = (color: string): HSVA => {
	const ctx = document.createElement("canvas").getContext("2d");
	if (!ctx) return { h: 0, s: 0, v: 0, a: 1 };

	ctx.fillStyle = color;
	const computed = ctx.fillStyle;

	if (computed.startsWith("#")) {
		let hex = computed.slice(1);
		if (hex.length === 3)
			hex = hex
				.split("")
				.map((c) => c + c)
				.join("");
		const r = parseInt(hex.substring(0, 2), 16);
		const g = parseInt(hex.substring(2, 4), 16);
		const b = parseInt(hex.substring(4, 6), 16);
		return rgbaToHsva(r, g, b, 1);
	}

	if (computed.startsWith("rgba")) {
		const match = computed.match(
			/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)/,
		);
		if (match) {
			return rgbaToHsva(
				Number(match[1]),
				Number(match[2]),
				Number(match[3]),
				Number(match[4] ?? 1),
			);
		}
	}

	return { h: 0, s: 0, v: 0, a: 1 };
};

const useColorDrag = (
	ref: React.RefObject<HTMLDivElement | null>,
	onChange: (position: { x: number; y: number }) => void,
) => {
	useEffect(() => {
		const element = ref.current;
		if (!element) return;

		const update = (clientX: number, clientY: number) => {
			const rect = element.getBoundingClientRect();
			const x = clamp((clientX - rect.left) / rect.width, 0, 1);
			const y = clamp((clientY - rect.top) / rect.height, 0, 1);
			onChange({ x, y });
		};

		const handlePointerDown = (e: PointerEvent) => {
			e.preventDefault();
			update(e.clientX, e.clientY);
			window.addEventListener("pointermove", handlePointerMove);
			window.addEventListener("pointerup", handlePointerUp);
		};

		const handlePointerMove = (e: PointerEvent) => {
			update(e.clientX, e.clientY);
		};

		const handlePointerUp = () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};

		element.addEventListener("pointerdown", handlePointerDown);

		return () => {
			element.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
	}, [ref, onChange]);
};

// --- Sub-Components ---

// 1. Saturation/Value Area (unchanged – keeps custom drag)
const SaturationSquare = ({
	hsva,
	onChange,
}: {
	hsva: HSVA;
	onChange: (s: HSVA) => void;
}) => {
	const ref = useRef<HTMLDivElement>(null);

	useColorDrag(ref, ({ x, y }) => {
		onChange({ ...hsva, s: x, v: 1 - y });
	});

	return (
		<div
			ref={ref}
			className="relative w-full h-40 rounded-md cursor-crosshair overflow-hidden border border-border shadow-sm"
			style={{ backgroundColor: `hsl(${hsva.h}, 100%, 50%)` }}
		>
			<div className="absolute inset-0 bg-linear-to-r from-white to-transparent" />
			<div className="absolute inset-0 bg-linear-to-b from-transparent to-black" />
			<div
				className="absolute w-4 h-4 border-2 border-white rounded-full shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
				style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%` }}
			/>
		</div>
	);
};

// 2. Hue Slider (now uses Radix Slider primitive for better accessibility/keyboard support)
const HueSlider = ({
	hsva,
	onChange,
}: {
	hsva: HSVA;
	onChange: (hsva: HSVA) => void;
}) => {
	return (
		<SliderPrimitive.Root
			className="relative flex w-full touch-none select-none items-center"
			value={[hsva.h]}
			onValueChange={(val) => onChange({ ...hsva, h: val[0] ?? 0 })}
			max={360}
			step={1}
			aria-label="Hue"
		>
			<SliderPrimitive.Track className="relative h-4 w-full grow overflow-hidden rounded-full border border-border">
				<div
					className="absolute inset-0 rounded-full"
					style={{
						background:
							"linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
					}}
				/>
				<SliderPrimitive.Range className="absolute h-full bg-transparent" />
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border border-gray-300 bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
		</SliderPrimitive.Root>
	);
};

// 3. Alpha Slider (now uses Radix Slider primitive)
const AlphaSlider = ({
	hsva,
	onChange,
}: {
	hsva: HSVA;
	onChange: (hsva: HSVA) => void;
}) => {
	const { r, g, b } = hsvaToRgba(hsva);

	return (
		<SliderPrimitive.Root
			className="relative flex w-full touch-none select-none items-center"
			value={[hsva.a]}
			onValueChange={(val) => onChange({ ...hsva, a: val[0] ?? 1 })}
			min={0}
			max={1}
			step={0.01}
			aria-label="Alpha"
		>
			<SliderPrimitive.Track className="relative h-4 w-full grow overflow-hidden rounded-full border border-border">
				<div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlN2U3ZTciLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZTdlN2U3Ii8+PC9zdmc+')] opacity-50" />
				<div
					className="absolute inset-0 rounded-full"
					style={{
						background: `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1))`,
					}}
				/>
				<SliderPrimitive.Range className="absolute h-full bg-transparent" />
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border border-gray-300 bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
		</SliderPrimitive.Root>
	);
};

// --- Main Component ---

const PRESETS = [
	"#000000",
	"#FFFFFF",
	"#FF0000",
	"#00FF00",
	"#0000FF",
	"#FFFF00",
	"#00FFFF",
	"#FF00FF",
	"#C0C0C0",
	"#808080",
	"#800000",
	"#808000",
];

export function ColorPicker({
	value,
	onChange,
	className,
	disabled = false,
	showAlpha = true,
	presets = PRESETS,
}: ColorPickerProps) {
	const [hsva, setHsva] = useState<HSVA>(parseColorToHsva(value));
	const [inputMode, setInputMode] = useState<"hex" | "rgb">("hex");
	const [isCopied, setIsCopied] = useState(false);

	useEffect(() => {
		const currentHex = hsvaToHex(hsva, showAlpha);
		const incomingHsva = parseColorToHsva(value);
		if (hsvaToHex(incomingHsva, showAlpha) !== currentHex) {
			setHsva(incomingHsva);
		}
	}, [value, showAlpha, hsva]);

	const handleHsvaChange = (newHsva: HSVA) => {
		setHsva(newHsva);
		const newColor = showAlpha
			? hsvaToHex(newHsva, true)
			: hsvaToHex({ ...newHsva, a: 1 }, false);
		onChange(newColor);
	};

	const handleCopy = () => {
		navigator.clipboard.writeText(hsvaToHex(hsva, showAlpha));
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 2000);
	};

	const handleEyeDropper = async () => {
		if (!window.EyeDropper) return;
		const eyeDropper = new window.EyeDropper();
		try {
			const result = await eyeDropper.open();
			const newHsva = parseColorToHsva(result.sRGBHex);
			handleHsvaChange({ ...newHsva, a: hsva.a });
		} catch (_e) {
			console.log("Eyedropper canceled");
		}
	};

	const { r, g, b } = hsvaToRgba(hsva);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled}
					className={cn(
						"w-full justify-start text-left font-normal px-2 h-9",
						className,
					)}
				>
					<div className="w-5 h-5 rounded border border-input mr-2 relative overflow-hidden shrink-0">
						<div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlN2U3ZTciLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZTdlN2U3Ii8+PC9zdmc+')] opacity-50" />
						<div
							className="absolute inset-0"
							style={{ backgroundColor: hsvaToHex(hsva, showAlpha) }}
						/>
					</div>
					<span className="truncate flex-1">{value || "Pick a color"}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-3" align="start">
				<div className="space-y-4">
					<SaturationSquare hsva={hsva} onChange={handleHsvaChange} />

					<div className="flex gap-3 items-center">
						<div className="w-8 h-8 rounded-full border border-input relative overflow-hidden shrink-0">
							<div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlN2U3ZTciLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZTdlN2U3Ii8+PC9zdmc+')] opacity-50" />
							<div
								className="absolute inset-0"
								style={{ backgroundColor: hsvaToHex(hsva, showAlpha) }}
							/>
						</div>

						<div className="flex-1 space-y-3">
							<HueSlider hsva={hsva} onChange={handleHsvaChange} />
							{showAlpha && (
								<AlphaSlider hsva={hsva} onChange={handleHsvaChange} />
							)}
						</div>
					</div>

					<Tabs
						defaultValue="hex"
						value={inputMode}
						onValueChange={(v) => setInputMode(v as "hex" | "rgb")}
						className="w-full"
					>
						<div className="flex items-center justify-between mb-2">
							<TabsList className="h-7">
								<TabsTrigger value="hex" className="text-xs h-5 px-2">
									Hex
								</TabsTrigger>
								<TabsTrigger value="rgb" className="text-xs h-5 px-2">
									RGB
								</TabsTrigger>
							</TabsList>

							<div className="flex items-center gap-1">
								{typeof window !== "undefined" && "EyeDropper" in window && (
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7"
										onClick={handleEyeDropper}
										title="Pick color from screen"
									>
										<Pipette className="h-3.5 w-3.5" />
									</Button>
								)}
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									onClick={handleCopy}
									title="Copy to clipboard"
								>
									{isCopied ? (
										<Check className="h-3.5 w-3.5" />
									) : (
										<Copy className="h-3.5 w-3.5" />
									)}
								</Button>
							</div>
						</div>

						<TabsContent value="hex">
							<Input
								value={hsvaToHex(hsva, showAlpha)}
								onChange={(e) => {
									const newHsva = parseColorToHsva(e.target.value);
									handleHsvaChange({
										...newHsva,
										a: showAlpha ? newHsva.a : 1,
									});
								}}
								className="font-mono"
							/>
						</TabsContent>

						<TabsContent value="rgb">
							<div className="flex gap-2">
								<div className="space-y-1 text-center">
									<Input
										value={r}
										onChange={(e) =>
											handleHsvaChange(
												rgbaToHsva(Number(e.target.value), g, b, hsva.a),
											)
										}
										className="text-center font-mono px-0"
									/>
									<span className="text-[10px] text-muted-foreground">R</span>
								</div>
								<div className="space-y-1 text-center">
									<Input
										value={g}
										onChange={(e) =>
											handleHsvaChange(
												rgbaToHsva(r, Number(e.target.value), b, hsva.a),
											)
										}
										className="text-center font-mono px-0"
									/>
									<span className="text-[10px] text-muted-foreground">G</span>
								</div>
								<div className="space-y-1 text-center">
									<Input
										value={b}
										onChange={(e) =>
											handleHsvaChange(
												rgbaToHsva(r, g, Number(e.target.value), hsva.a),
											)
										}
										className="text-center font-mono px-0"
									/>
									<span className="text-[10px] text-muted-foreground">B</span>
								</div>
								{showAlpha && (
									<div className="space-y-1 text-center">
										<Input
											value={Math.round(hsva.a * 100)}
											onChange={(e) =>
												handleHsvaChange({
													...hsva,
													a: Number(e.target.value) / 100,
												})
											}
											className="text-center font-mono px-0"
										/>
										<span className="text-[10px] text-muted-foreground">%</span>
									</div>
								)}
							</div>
						</TabsContent>
					</Tabs>

					{presets.length > 0 && (
						<div className="space-y-1.5 pt-2 border-t">
							<span className="text-xs font-medium text-muted-foreground">
								Presets
							</span>
							<div className="grid grid-cols-6 gap-2">
								{presets.map((color) => (
									<button
										key={color}
										type="button"
										className="w-full aspect-square rounded-md border border-input relative overflow-hidden ring-offset-background hover:ring-2 hover:ring-ring focus:ring-2 focus:outline-none"
										onClick={() => handleHsvaChange(parseColorToHsva(color))}
									>
										<div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNlN2U3ZTciLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZTdlN2U3Ii8+PC9zdmc+')] opacity-50" />
										<div
											className="absolute inset-0"
											style={{ backgroundColor: color }}
										/>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

declare global {
	interface Window {
		// biome-ignore lint/suspicious/noExplicitAny: Not exists always
		EyeDropper?: any;
	}
}
