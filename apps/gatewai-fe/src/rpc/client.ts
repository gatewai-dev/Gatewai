import type { AppType } from './../../backend/src/index';

import { hc } from 'hono/client'

const rpcClient = hc<AppType>("/", {
    init: {
        credentials: "include",
    }
})
export { rpcClient }