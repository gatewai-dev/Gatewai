export const dataTypeColors: Record<
	string,
	{ bg: string; stroke: string; hex: string; text: string; border: string }
> = {
	Text: {
		bg: "bg-blue-500",
		stroke: "stroke-blue-500",
		hex: "#3b82f6",
		text: "text-blue-500",
		border: "border-blue-500",
	},
	Image: {
		bg: "bg-purple-500",
		stroke: "stroke-purple-500",
		hex: "#a855f7",
		text: "text-purple-500",
		border: "border-purple-500",
	},
	Video: {
		bg: "bg-teal-500",
		stroke: "stroke-teal-500",
		hex: "oklch(60% 0.118 184.704)",
		text: "text-teal-500",
		border: "border-teal-500",
	},
	Audio: {
		bg: "bg-orange-500",
		stroke: "stroke-orange-500",
		hex: "#f97316",
		text: "text-orange-500",
		border: "border-orange-500",
	},
	Number: {
		bg: "bg-green-500",
		stroke: "stroke-green-500",
		hex: "#22c55e",
		text: "text-green-500",
		border: "border-green-500",
	},
	Boolean: {
		bg: "bg-yellow-500",
		stroke: "stroke-yellow-500",
		hex: "#eab308",
		text: "text-yellow-500",
		border: "border-yellow-500",
	},
};
