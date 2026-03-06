export interface IPricingService {
	canAfford(userId: string, price: number): Promise<boolean>;
	deductTokens(userId: string, price: number, taskId: string): Promise<void>;
	creditTokens(
		userId: string,
		amount: number,
		type: "PURCHASE" | "SUBSCRIPTION_REFILL" | "BONUS" | "REFUND",
		metadata?: any,
	): Promise<void>;
	trackUsage(
		userId: string,
		type: "tasksUsed" | "tokensUsed" | "apiCallsUsed",
		amount: number,
	): Promise<void>;
}
