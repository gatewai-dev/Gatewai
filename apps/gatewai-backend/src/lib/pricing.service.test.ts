import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingService } from "./pricing.service";

// Mock dependencies
const mockPrisma = {
	user: {
		findUnique: vi.fn(),
		update: vi.fn(),
	},
	tokenTransaction: {
		create: vi.fn(),
	},
	usageRecord: {
		upsert: vi.fn(),
	},
	$transaction: vi.fn((cb) => cb(mockPrisma)),
};

vi.mock("@gatewai/core", () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
	TOKENS: {
		PRISMA: Symbol.for("PRISMA"),
	},
}));

// We need to mock the dynamic import in pricing.service.ts
// Since it's a dynamic import of "../polar.js", we mock that module.
vi.mock("../polar.js", () => ({
	ingestUsageEvent: vi.fn(),
}));

describe("PricingService", () => {
	let service: PricingService;

	beforeEach(() => {
		vi.clearAllMocks();
		service = new PricingService(mockPrisma as any);
	});

	describe("canAfford", () => {
		it("should return true if price is 0", async () => {
			const result = await service.canAfford("user1", 0);
			expect(result).toBe(true);
			expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
		});

		it("should return true if user has enough tokens", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ tokens: 100 });
			const result = await service.canAfford("user1", 50);
			expect(result).toBe(true);
			expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
				where: { id: "user1" },
				select: { tokens: true },
			});
		});

		it("should return false if user doesn't have enough tokens", async () => {
			mockPrisma.user.findUnique.mockResolvedValue({ tokens: 30 });
			const result = await service.canAfford("user1", 50);
			expect(result).toBe(false);
		});

		it("should return false if user is not found", async () => {
			mockPrisma.user.findUnique.mockResolvedValue(null);
			const result = await service.canAfford("user1", 10);
			expect(result).toBe(false);
		});
	});

	describe("deductTokens", () => {
		it("should do nothing if price is 0", async () => {
			await service.deductTokens("user1", 0, "task1");
			expect(mockPrisma.$transaction).not.toHaveBeenCalled();
		});

		it("should deduct tokens and create transaction", async () => {
			mockPrisma.user.update.mockResolvedValue({ id: "user1", tokens: 50 });

			await service.deductTokens("user1", 50, "task1");

			expect(mockPrisma.user.update).toHaveBeenCalledWith({
				where: { id: "user1" },
				data: { tokens: { decrement: 50 } },
			});
			expect(mockPrisma.tokenTransaction.create).toHaveBeenCalledWith({
				data: {
					userId: "user1",
					amount: -50,
					type: "USAGE",
					metadata: { taskId: "task1" },
				},
			});
		});

		it("should throw error if resulting tokens are negative", async () => {
			mockPrisma.user.update.mockResolvedValue({ id: "user1", tokens: -10 });

			await expect(service.deductTokens("user1", 50, "task1")).rejects.toThrow(
				"Insufficient tokens",
			);
		});
	});

	describe("creditTokens", () => {
		it("should credit tokens and create transaction", async () => {
			await service.creditTokens("user1", 100, "PURCHASE", { orderId: "123" });

			expect(mockPrisma.user.update).toHaveBeenCalledWith({
				where: { id: "user1" },
				data: { tokens: { increment: 100 } },
			});
			expect(mockPrisma.tokenTransaction.create).toHaveBeenCalledWith({
				data: {
					userId: "user1",
					amount: 100,
					type: "PURCHASE",
					metadata: { orderId: "123" },
				},
			});
		});
	});

	describe("trackUsage", () => {
		it("should upsert usage record", async () => {
			const userId = "user1";
			const type = "tokensUsed";
			const amount = 100;
			const month = new Date().toISOString().slice(0, 7);

			await service.trackUsage(userId, type, amount);

			expect(mockPrisma.usageRecord.upsert).toHaveBeenCalledWith({
				where: {
					userId_month: {
						userId,
						month,
					},
				},
				update: {
					[type]: { increment: amount },
				},
				create: {
					userId,
					month,
					[type]: amount,
				},
			});
		});
	});
});
