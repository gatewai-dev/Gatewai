import type { InferResponseType, InferRequestType } from "hono";
import type { rpcClient } from "./client";

export type CanvasDetailsRPC = InferResponseType<typeof rpcClient.api.v1.canvas[":id"]["$get"]>;
export type CanvasDetailsNode = CanvasDetailsRPC["nodes"][number];

export type CanvasListRPC = InferResponseType<typeof rpcClient.api.v1.canvas.$get>
export type CanvasListRPCParams = InferRequestType<typeof rpcClient.api.v1.canvas.$get>

export type CreateCanvasRPC = InferResponseType<typeof rpcClient.api.v1.canvas.$post>
export type CreateCanvasRPCParams = InferRequestType<typeof rpcClient.api.v1.canvas.$post>


export type PatchCanvasRPC = InferResponseType<typeof rpcClient.api.v1.canvas[":id"]["$patch"]>
export type PatchCanvasRPCReq = InferRequestType<typeof rpcClient.api.v1.canvas[":id"]["$patch"]>

export type NodeTemplateListRPC = InferResponseType<typeof rpcClient.api.v1["node-templates"]["$get"]>;
export type NodeTemplateListItemRPC = NodeTemplateListRPC[number];


export type UserAssetsListRPC = InferResponseType<typeof rpcClient.api.v1.assets.$get>;
export type UserAssetsListRPCParams = InferRequestType<typeof rpcClient.api.v1.assets.$get>

export type UserAssetsUploadRPC = InferResponseType<typeof rpcClient.api.v1.assets.$post>


export type CanvasTaskListRPC = InferResponseType<typeof rpcClient.api.v1.tasks[":canvasId"]["$get"]>;
export type CanvasTaskListRPCParams = InferRequestType<typeof rpcClient.api.v1.tasks[":canvasId"]["$get"]>;