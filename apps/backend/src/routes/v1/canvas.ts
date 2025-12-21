import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator'
import z from "zod";
import { streamSSE } from 'hono/streaming'
import { HTTPException } from "hono/http-exception";
import { prisma } from "@gatewai/db";
import type { AuthHonoTypes } from "../../auth.js";

const canvasRoutes = new Hono<{Variables: AuthHonoTypes}>({
    strict: false,
});

const createSchema = z.object({
    name: z.string().max(20),
});
canvasRoutes.post('/',
    zValidator(
      'json',
      createSchema
    ),
    async (c) => {
        const validated = c.req.valid('json')
        const user = c.get('user');
        const canvas = await prisma.canvas.create({
            data: {
                userId: user!.id,
                name: validated.name,
            },
        });
        return c.json({
            canvas
        });
    })

canvasRoutes.get('/:id', async (c) => {
    const id = c.req.param('id');
    const canvas = await prisma.canvas.findFirst({
        where: {
            id
        },
        include: {
            nodes: {
                include: {
                    edgesFrom: true,
                    edgesTo: true,
                    template: {
                        include: {
                            inputTypes: {
                                include: {
                                    template: true
                                }
                            },
                            outputTypes: {
                                include: {
                                    template: true
                                }
                            },
                        }
                    }
                }
            },

        }
    })
    return c.json({
        canvas
    });
})



export { canvasRoutes };