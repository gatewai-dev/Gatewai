import { prisma } from "@gatewai/db";

export async function getUserDefaultApiKey(
	userId: string,
): Promise<string | undefined> {
	const userKey = await prisma.apiKey.findFirst({
		where: { userId },
		orderBy: { createdAt: "asc" },
	});
	return userKey?.key ?? undefined;
}
