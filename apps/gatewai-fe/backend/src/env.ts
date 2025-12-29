import { env, getRuntimeKey } from 'hono/adapter'

if (!process.env.AWS_ASSETS_BUCKET) {
    throw new Error("AWS bucket is not set");
}
export const AWS_ASSETS_BUCKET = process.env.AWS_ASSETS_BUCKET;