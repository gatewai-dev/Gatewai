import type { InferResponseType, InferRequestType } from "hono";
import type { rpcClient } from "./client";

export type CanvasDetailsRPC = InferResponseType<
	(typeof rpcClient.api.v1.canvas)[":id"]["$get"]
>;
export type CanvasDetailsRPCParams = InferRequestType<
	(typeof rpcClient.api.v1.canvas)[":id"]["$get"]
>;
export type CanvasDetailsNode = CanvasDetailsRPC["nodes"][number];

export type CanvasListRPC = InferResponseType<
	typeof rpcClient.api.v1.canvas.$get
>;
export type CanvasListRPCParams = InferRequestType<
	typeof rpcClient.api.v1.canvas.$get
>;

export type CreateCanvasRPC = InferResponseType<
	typeof rpcClient.api.v1.canvas.$post
>;
export type CreateCanvasRPCParams = InferRequestType<
	typeof rpcClient.api.v1.canvas.$post
>;

export type PatchCanvasRPC = InferResponseType<
	(typeof rpcClient.api.v1.canvas)[":id"]["$patch"]
>;
export type PatchCanvasRPCParams = InferRequestType<
	(typeof rpcClient.api.v1.canvas)[":id"]["$patch"]
>;

export type UpdateCanvasNameRPC = InferResponseType<
	(typeof rpcClient.api.v1.canvas)[":id"]["update-name"]["$patch"]
>;
export type UpdateCanvasNameRPCParams = InferRequestType<
	(typeof rpcClient.api.v1.canvas)[":id"]["update-name"]["$patch"]
>;

export type ProcessNodesRPC = InferResponseType<
	(typeof rpcClient.api.v1.canvas)[":id"]["process"]["$post"]
>;
export type ProcessNodesRPCParams = InferRequestType<
	(typeof rpcClient.api.v1.canvas)[":id"]["process"]["$post"]
>;

export type NodeTemplateListRPC = InferResponseType<
	(typeof rpcClient.api.v1)["node-templates"]["$get"]
>;
export type NodeTemplateListItemRPC = NodeTemplateListRPC[number];

export type UserAssetsListRPC = InferResponseType<
	typeof rpcClient.api.v1.assets.$get
>;
export type UserAssetsListRPCParams = InferRequestType<
	typeof rpcClient.api.v1.assets.$get
>;

export type UserAssetsUploadRPC = InferResponseType<
	typeof rpcClient.api.v1.assets.$post
>;

export type UploadFileNodeAssetRPC = InferResponseType<
	(typeof rpcClient.api.v1.assets)["node"][":nodeId"]["$post"]
>;
export type UploadFileNodeAssetRPCParams = InferRequestType<
	(typeof rpcClient.api.v1.assets)["node"][":nodeId"]["$post"]
>;

export type ActiveCanvasBatchListRPC = InferResponseType<
	(typeof rpcClient.api.v1.tasks)[":canvasId"]["$get"]
>;
export type ActiveCanvasBatchListRPCParams = InferRequestType<
	(typeof rpcClient.api.v1.tasks)[":canvasId"]["$get"]
>;

export type BatchDetailsRPC = InferResponseType<
	(typeof rpcClient.api.v1.tasks)["filterby-batch"]["$get"]
>;
export type BatchDetailsRPCParams = InferRequestType<
	(typeof rpcClient.api.v1.tasks)["filterby-batch"]["$get"]
>;
