import { z } from "zod";

export const NodePricingSchema = z.object({
	price: z.number().min(0).default(0),
	variantPrices: z
		.record(z.string(), z.number())
		.optional()
		.describe("Price overrides for specific model variants"),
});

export type NodePricing = z.infer<typeof NodePricingSchema>;

export type PriceCalculatorFn = (config: Record<string, unknown>) => number;

export interface PriceCalculatorInput {
	nodeType: string;
	config: Record<string, unknown>;
	pricing: NodePricing | undefined;
}

export interface PriceCalculatorOptions {
	input: PriceCalculatorInput;
	isDevMode: boolean;
}

export function calculateNodePrice(options: PriceCalculatorOptions): number {
	const { input, isDevMode } = options;

	if (isDevMode) {
		return 0;
	}

	const { config, pricing } = input;
	if (!pricing) {
		return 0;
	}

	const variantPrices = pricing.variantPrices ?? {};
	const model = config.model as string | undefined;

	if (model && variantPrices[model] !== undefined) {
		return variantPrices[model];
	}

	return pricing.price ?? 0;
}

export function calculateTotalPrice(
	nodes: Array<PriceCalculatorInput>,
	isDevMode: boolean,
): number {
	if (isDevMode) {
		return 0;
	}

	return nodes.reduce((total, node) => {
		return total + calculateNodePrice({ input: node, isDevMode: false });
	}, 0);
}

export function getNodePriceFromConfig(
	config: Record<string, unknown>,
	pricing: NodePricing | undefined,
	isDevMode: boolean,
): number {
	return calculateNodePrice({
		input: { nodeType: "", config, pricing },
		isDevMode,
	});
}
