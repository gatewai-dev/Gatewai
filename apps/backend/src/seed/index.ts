import { prisma } from "@gatewai/db";
import { SEED_createNodeTemplates } from "./node-templates.js";

// Entry point for seeding the database
async function main() {
    SEED_createNodeTemplates(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });