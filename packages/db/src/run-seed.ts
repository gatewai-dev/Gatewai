import { config } from "dotenv";
import { prisma } from "./client.js";
import { SEED_createNodeTemplates } from "./seed/node-templates.js";

config();

// Entry point for seeding the database
async function main() {
	await SEED_createNodeTemplates(prisma);
}

main()
	.then(() => {
		console.log("Seeding completed successfully.");
	})
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		console.log("Disconnecting from database.");
		await prisma.$disconnect();
	});
