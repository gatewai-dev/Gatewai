import { hc } from "hono/client";
import type { AppType } from "../../../apps/gatewai-fe/backend/src/index";

export type { AppType };

export const createRpcClient = (
    baseUrl: string = "/",
    config: {
        headers: Record<string, string>;
    } = { headers: {} },
) => {
    return hc<AppType>(baseUrl, {
        init: {
            credentials: "include",
            headers: config.headers,
        },
    });
};
