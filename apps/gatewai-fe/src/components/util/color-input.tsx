import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface ColorInputProps {
	id?: string;
	value: string;
	onChange: (color: string) => void;
	className?: string;
	disabled?: boolean;
}

interface HSVA {
	h: number;
	s: number;
	v: number;
	a: number;
}

function parseColor(color: string): HSVA {
	if (color.startsWith("#")) {
		let hex = color.slice(1);
		let a = 1;
		if (hex.length === 3 || hex.length === 4) {
			hex = hex
				.split("")
				.map((c) => c + c)
				.join("");
		}
		if (hex.length === 8) {
			a = parseInt(hex.slice(6, 8), 16) / 255;
			hex = hex.slice(0, 6);
		}
		const r = parseInt(hex.slice(0, 2), 16);
		const g = parseInt(hex.slice(2, 4), 16);
		const b = parseInt(hex.slice(4, 6), 16);
		return rgbToHsva(r, g, b, a);
	} else if (color.startsWith("rgba")) {
		const match = color.match(
			/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\)/,
		);
		if (match) {
			const [, r, g, b, a] = match;
			return rgbToHsva(Number(r), Number(g), Number(b), Number(a));
		}
	} else if (color.startsWith("rgb")) {
		const match = color.match(/rgb?\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (match) {
			const [, r, g, b] = match;
			return rgbToHsva(Number(r), Number(g), Number(b), 1);
		}
	}
	return { h: 0, s: 0, v: 1, a: 1 };
}

function rgbToHsva(r: number, g: number, b: number, a: number): HSVA {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	let h = 0;
	const s = max === 0 ? 0 : d / max;
	const v = max;
	if (d !== 0) {
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
}

function hsvaToRgba(hsva: HSVA): {
	r: number;
	g: number;
	b: number;
	a: number;
} {
	let { h, s, v, a } = hsva;
	h /= 360;
	const i = Math.floor(h * 6);
	const f = h * 6 - i;
	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);
	let r = 0,
		g = 0,
		b = 0;
	switch (i % 6) {
		case 0:
			r = v;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = v;
			b = p;
			break;
		case 2:
			r = p;
			g = v;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = v;
			break;
		case 4:
			r = t;
			g = p;
			b = v;
			break;
		case 5:
			r = v;
			g = p;
			b = q;
			break;
	}
	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255),
		a,
	};
}

function hsvaToRgbaString(hsva: HSVA): string {
	const { r, g, b, a } = hsvaToRgba(hsva);
	return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

function hsvToRgbString(hsva: HSVA): string {
	const { r, g, b } = hsvaToRgba(hsva);
	return `rgb(${r}, ${g}, ${b})`;
}

export function ColorInput({
	id,
	value,
	onChange,
	className,
	disabled,
}: ColorInputProps) {
	const [hsva, setHsva] = React.useState<HSVA>(parseColor(value));
	const svRef = React.useRef<HTMLDivElement>(null);
	const hueRef = React.useRef<HTMLDivElement>(null);
	const alphaRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		setHsva(parseColor(value));
	}, [value]);

	const handleChange = (newHsva: HSVA) => {
		setHsva(newHsva);
		onChange(hsvaToRgbaString(newHsva));
	};

	const handlePointerDown = (
		e: React.PointerEvent,
		ref: React.RefObject<HTMLDivElement | null>,
		updater: (x: number, y: number, rect: DOMRect) => Partial<HSVA>,
	) => {
		e.preventDefault();
		const target = ref.current;
		if (!target) return;

		const onPointerMove = (e: PointerEvent) => {
			const rect = target.getBoundingClientRect();
			let x = e.clientX - rect.left;
			let y = e.clientY - rect.top;
			x = Math.max(0, Math.min(x, rect.width));
			y = Math.max(0, Math.min(y, rect.height));
			const updates = updater(x, y, rect);
			handleChange({ ...hsva, ...updates });
		};

		const onPointerUp = () => {
			document.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerup", onPointerUp);
		};

		onPointerMove(e.nativeEvent);
		document.addEventListener("pointermove", onPointerMove);
		document.addEventListener("pointerup", onPointerUp);
	};

	const handleSvDown = (e: React.PointerEvent) => {
		handlePointerDown(e, svRef, (x, y, rect) => ({
			s: x / rect.width,
			v: 1 - y / rect.height,
		}));
	};

	const handleHueDown = (e: React.PointerEvent) => {
		handlePointerDown(e, hueRef, (x, _, rect) => ({
			h: (x / rect.width) * 360,
		}));
	};

	const handleAlphaDown = (e: React.PointerEvent) => {
		handlePointerDown(e, alphaRef, (x, _, rect) => ({
			a: x / rect.width,
		}));
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					id={id}
					variant="outline"
					className={`w-8 h-8 p-0 rounded border ${className ?? ""}`}
					style={{ backgroundColor: value }}
					disabled={disabled}
				>
					<span className="sr-only">Open color picker</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-72">
				<div className="space-y-4">
					{/* Saturation/Value picker */}
					<div
						ref={svRef}
						className="relative w-full h-48 rounded cursor-crosshair overflow-hidden"
						onPointerDown={handleSvDown}
					>
						<div
							className="absolute inset-0"
							style={{ backgroundColor: `hsl(${hsva.h}, 100%, 50%)` }}
						/>
						<div
							className="absolute inset-0"
							style={{
								background:
									"linear-gradient(to right, #fff, rgba(255,255,255,0))",
							}}
						/>
						<div
							className="absolute inset-0"
							style={{
								background: "linear-gradient(to bottom, rgba(0,0,0,0), #000)",
							}}
						/>
						<div
							className="pointer-events-none absolute w-5 h-5 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2"
							style={{
								left: `${hsva.s * 100}%`,
								top: `${(1 - hsva.v) * 100}%`,
							}}
						/>
					</div>

					{/* Hue slider */}
					<div
						ref={hueRef}
						className="relative w-full h-5 rounded cursor-pointer"
						onPointerDown={handleHueDown}
					>
						<div
							className="absolute inset-0 rounded"
							style={{
								background:
									"linear-gradient(to right, #f00 0%, #ff0 16.66%, #0f0 33.33%, #0ff 50%, #00f 66.66%, #f0f 83.33%, #f00 100%)",
							}}
						/>
						<div
							className="pointer-events-none absolute w-5 h-5 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2"
							style={{
								left: `${(hsva.h / 360) * 100}%`,
								top: "50%",
							}}
						/>
					</div>

					{/* Alpha slider */}
					<div
						ref={alphaRef}
						className="relative w-full h-5 rounded cursor-pointer"
						style={{
							backgroundImage:
								"repeating-conic-gradient(#ccc 0 25%, #fff 0 50%)",
							backgroundSize: "20px 20px",
							backgroundPosition: "0 0",
						}}
						onPointerDown={handleAlphaDown}
					>
						<div
							className="absolute inset-0 rounded"
							style={{
								background: `linear-gradient(to right, transparent, ${hsvToRgbString(hsva)})`,
							}}
						/>
						<div
							className="pointer-events-none absolute w-5 h-5 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2"
							style={{
								left: `${hsva.a * 100}%`,
								top: "50%",
							}}
						/>
					</div>

					{/* Text input for manual entry */}
					<Input
						value={hsvaToRgbaString(hsva)}
						onChange={(e) => {
							const newHsva = parseColor(e.target.value);
							if (
								newHsva.h !== 0 ||
								newHsva.s !== 0 ||
								newHsva.v !== 0 ||
								newHsva.a !== 1
							) {
								handleChange(newHsva);
							}
						}}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
