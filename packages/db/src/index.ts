export { prisma } from "./client.js";

// Export both types AND values from the generated client
export * from '../generated/client/models.js';
export * from '../generated/client/client.js'; // Remove 'type' to export values too

// Or be more explicit:
// export { 
//   PrismaClient,
//   NodeType,
//   DataType,
//   TaskStatus,
//   ProcessEnvironment,
//   type Prisma
// } from '../generated/client/client.js';