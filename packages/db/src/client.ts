
import { PrismaClient } from "../generated/client/client.js";
// Instantiate the extended Prisma client to infer its type
const extendedPrisma = new PrismaClient({ datasources: {
  db: {
    url: 'file:../prisma/game.db'
  }
}})

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