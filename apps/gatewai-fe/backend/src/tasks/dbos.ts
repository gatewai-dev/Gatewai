import { PrismaDataSource } from "@dbos-inc/prisma-datasource";
import { type PrismaClient, prisma } from "@gatewai/db";

const dbosPrismaDataSource = new PrismaDataSource<PrismaClient>(
	"app-db",
	prisma,
);
