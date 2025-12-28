import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client";

export * from "../generated/client/client.js";

let prismaInstance: PrismaClient | null = null;

function createPrismaClient() {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL environment variable is not set");
	}
	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
	return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as typeof globalThis & {
	prisma?: PrismaClient;
};

export const prisma = new Proxy({} as PrismaClient, {
	get(target, prop) {
		if (!prismaInstance) {
			prismaInstance = globalForPrisma.prisma ?? createPrismaClient();

			if (process.env.NODE_ENV !== "production") {
				globalForPrisma.prisma = prismaInstance;
			}
		}

		return prismaInstance[prop as keyof PrismaClient];
	},
});
