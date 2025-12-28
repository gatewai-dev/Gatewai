export * from "../generated/client/client.js"; // Remove 'type' to export values too

// Export both types AND values from the generated client
export * from "../generated/client/models.js";
export { prisma } from "./client.js";

// Or be more explicit:
// export {
//   PrismaClient,
//   NodeType,
//   DataType,
//   TaskStatus,
//   ProcessEnvironment,
//   type Prisma
// } from '../generated/client/client.js';
