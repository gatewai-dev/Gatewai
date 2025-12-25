
import { PrismaClient } from "../generated/client/client.js";
import { PrismaPg } from '@prisma/adapter-pg'

console.log(process.env.DATABASE_URL);
// Instantiate the extended Prisma client to infer its type
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const extendedPrisma = new PrismaClient({ adapter })

// Use globalThis for broader environment compatibility
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

// Named export with global memoization
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? extendedPrisma;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}