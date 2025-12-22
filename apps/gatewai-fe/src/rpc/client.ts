import type { AppType } from './../../backend/src/index';

import { hc } from 'hono/client'

const rpcClient = hc<AppType>('http://localhost:8787/', {
    init: {
        credentials: "include",
    }
})
export { rpcClient }