import type { InferResponseType, InferRequestType } from "hono";
import type { rpcClient } from "./client";

export type CanvasDetailsRPC = InferResponseType<typeof rpcClient.api.v1.canvas[":id"]["$get"]>;
export type CanvasListRPC = InferResponseType<typeof rpcClient.api.v1.canvas.$get>
export type CreateCanvasRPC = InferResponseType<typeof rpcClient.api.v1.canvas.$post>
export type PatchCanvasRPC = InferResponseType<typeof rpcClient.api.v1.canvas[":id"]["$patch"]>
export type PatchCanvasRPCReq = InferRequestType<typeof rpcClient.api.v1.canvas[":id"]["$patch"]>