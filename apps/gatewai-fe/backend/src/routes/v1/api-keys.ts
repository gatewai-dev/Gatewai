import { prisma } from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthorizedHonoTypes } from "../../auth.js";

const apiKeysRoutes = new Hono<{ Variables: AuthorizedHonoTypes }>()
	/**
	 * GET /api/v1/api-keys
	 * List all API keys for the user
	 */
	.get("/", async (c) => {
		const user = c.get("user");
		const keys = await prisma.apiKey.findMany({
			where: { userId: user.id },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				name: true,
				start: true,
				createdAt: true,
				lastUsedAt: true,
				prefix: true,
			},
		});

		return c.json({ keys });
	})
	/**
	 * POST /api/v1/api-keys
	 * Create a new API key
	 */
	.post(
		"/",
		zValidator(
			"json",
			z.object({
				name: z.string().min(1).max(50).default("API Key"),
			}),
		),
		async (c) => {
			const user = c.get("user");
			const { name } = c.req.valid("json");

			const key = `gte_${crypto.randomUUID().replace(/-/g, "")}`;
			const newKey = await prisma.apiKey.create({
				data: {
					key,
					name,
					userId: user.id,
					start: key.substring(0, 4),
					prefix: "gte",
				},
			});

			return c.json(
				{
					key: newKey,
					fullKey: key, // Return full key only once
				},
				201,
			);
		},
	)
	/**
	 * DELETE /api/v1/api-keys/:id
	 * Delete an API key (unless it's the last one)
	 */
	.delete("/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");

		// Count existing keys
		const count = await prisma.apiKey.count({
			where: { userId: user.id },
		});

		if (count <= 1) {
			return c.json(
				{
					error:
						"Cannot delete the last API key. Please create a new one first.",
				},
				400,
			);
		}

		await prisma.apiKey.delete({
			where: { id, userId: user.id },
		});

		return c.json({ success: true });
	});

export { apiKeysRoutes };
