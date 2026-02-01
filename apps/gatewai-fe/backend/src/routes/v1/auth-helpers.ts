import { prisma } from "@gatewai/db";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthHonoTypes } from "../../auth.js";

// Using a loose Context type that works with any Hono context variant
type UserContext = Context<{
    Variables: AuthHonoTypes;
}>;

/**
 * Check if the request is authenticated via API key (service account mode)
 */
export function isApiKeyAuth(c: UserContext): boolean {
    return c.get("isApiKeyAuth") === true;
}

/**
 * Get user from context or throw 401
 * API key authenticated requests will throw (use isApiKeyAuth to check first)
 */
export function requireUser(c: UserContext) {
    const user = c.get("user");
    if (!user) {
        throw new HTTPException(401, { message: "Unauthorized" });
    }
    return user;
}

/**
 * Get user from context if available, or null if API key auth
 */
export function getUserOrNull(c: UserContext) {
    if (isApiKeyAuth(c)) {
        return null;
    }
    return c.get("user") ?? null;
}



/**
 * Assert that user owns the canvas (not just has share access)
 * API key auth bypasses ownership checks
 */
export async function assertCanvasOwnership(c: UserContext, canvasId: string) {
    // API key auth bypasses ownership checks (service account mode)
    if (isApiKeyAuth(c)) {
        const canvas = await prisma.canvas.findFirst({
            where: { id: canvasId },
        });
        if (!canvas) {
            throw new HTTPException(404, { message: "Canvas not found" });
        }
        return canvas;
    }

    const user = requireUser(c);

    const canvas = await prisma.canvas.findFirst({
        where: { id: canvasId, userId: user.id },
    });

    if (!canvas) {
        throw new HTTPException(404, { message: "Canvas not found" });
    }

    return canvas;
}

/**
 * Assert user owns the asset
 * API key auth bypasses ownership checks
 */
export async function assertAssetOwnership(c: UserContext, assetId: string) {
    // API key auth bypasses ownership checks (service account mode)
    if (isApiKeyAuth(c)) {
        const asset = await prisma.fileAsset.findFirst({
            where: { id: assetId },
        });
        if (!asset) {
            throw new HTTPException(404, { message: "Asset not found" });
        }
        return asset;
    }

    const user = requireUser(c);

    const asset = await prisma.fileAsset.findFirst({
        where: { id: assetId, userId: user.id },
    });

    if (!asset) {
        throw new HTTPException(404, { message: "Asset not found" });
    }

    return asset;
}
