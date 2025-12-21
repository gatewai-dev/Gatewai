import { prisma } from "@gatewai/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APP_CONFIG } from "./config.js";
import { createMiddleware } from 'hono/factory'
import { HTTPException } from "hono/http-exception";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
      provider: "sqlite",
    }),
    trustedOrigins: [
      "gatewai://",
      "gatewai-staging://",
      "http://localhost:8081",
    ],
    socialProviders: {
      google: {
        clientId: APP_CONFIG.GOOGLE_CLIENT_ID,
        clientSecret: APP_CONFIG.GOOGLE_CLIENT_SECRET,
        accessType: "offline",
        prompt: "select_account+consent",
        redirectURI: "http://localhost:8081/google-callback"
      },
    },
    
}) as ReturnType<typeof betterAuth>

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = c.get('session');
  if (!session) {
    const errorResponse = new Response('Unauthorized', {
      status: 401,
      headers: {
        Authenticate: 'error="invalid_token"',
      },
    })
    throw new HTTPException(401, { res: errorResponse })
  }
  await next()
})

export type AuthHonoTypes = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null
};