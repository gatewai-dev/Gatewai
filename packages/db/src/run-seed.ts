import { config } from "dotenv";
import { prisma } from "./client.js";

config();

// Entry point for seeding the database
async function main() {
	// Node templates are now auto-synced from manifests at application startup.
	// Add other seed logic here if needed.
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
