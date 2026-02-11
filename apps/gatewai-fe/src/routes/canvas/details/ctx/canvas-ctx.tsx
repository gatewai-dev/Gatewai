import type {
	BatchEntity,
	CanvasDetailsRPC,
	NodeTemplateListItemRPC,
	PatchCanvasRPCParams,
} from "@gatewai/react-store";
import {
	addManyHandleEntities,
	createHandleEntity,
	createNode,
	createNodeEntity,
	deleteManyEdgeEntity,
	deleteManyHandleEntity,
	deleteManyNodeEntity,
	type EdgeEntityType,
	type HandleEntityType,
	handleSelectors,
	type NodeEntityType,
	onEdgeChange,
	onNodeChange,
	type RootState,
	selectRFEdges,
	selectRFNodes,
	setAllEdgeEntities,
	setAllHandleEntities,
	setAllNodeEntities,
	setEdges,
	setNodes,
	setSelectedNodeIds,
	updateNodeConfig,
	updateNodeConfigWithoutHistory,
	updateNodeResult,
	useAppDispatch,
	useApplyPatchMutation,
	useAppSelector,
	useGetCanvasDetailsQuery,
	useLazyGetPatchQuery,
	usePatchCanvasMutation,
	useProcessNodesMutation,
	useRejectPatchMutation,
} from "@gatewai/react-store";
import type {
	AllNodeConfig,
	BulkUpdatePayload,
	NodeResult,
} from "@gatewai/types";
import {
	type Connection,
	type Edge,
	type EdgeChange,
	getConnectedEdges,
	getOutgoers,
	type Node,
	type NodeChange,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
	type ReactFlowInstance,
	useUpdateNodeInternals,
	type XYPosition,
} from "@xyflow/react";
import {
	createContext,
	type PropsWithChildren,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useStore } from "react-redux";
import { toast } from "sonner";
import { generateId } from "@/lib/idgen";
import { useNodeTemplates } from "../node-templates/node-templates.ctx";
import { useTaskManagerCtx } from "./task-manager-ctx";

interface CanvasContextType {
	canvas: CanvasDetailsRPC["canvas"] | undefined;
	onNodesChange: OnNodesChange<Node>;
	onEdgesChange: OnEdgesChange<Edge>;
	isLoading: boolean;
	isError: boolean;
	onConnect: OnConnect;
	runNodes: (node_ids?: Node["id"][]) => Promise<void>;
	rfInstance: RefObject<ReactFlowInstance | undefined>;
	createNewNode: (
		template: NodeTemplateListItemRPC,
		position: XYPosition,
		initialResult?: NodeResult,
	) => void;
	onNodesDelete: (nodeIds: Node["id"][]) => void;
	onEdgesDelete: (edgeIds: Edge["id"][]) => void;
	duplicateNodes: (nodeIds: Node["id"][]) => void;
	onNodeConfigUpdate: (payload: {
		id: string;
		newConfig: Partial<AllNodeConfig>;
		appendHistory?: boolean;
	}) => void;
	createNewHandle: (newHandle: HandleEntityType) => void;
	onNodeResultUpdate: (payload: { id: string; newResult: NodeResult }) => void;
	moveViewportToNode: (
		nodeId: string,
		options?: {
			zoom?: number;
			duration?: number;
		},
	) => void;

	// Patch System
	isReviewing: boolean;
	previewPatch: (patchId: string) => Promise<void>;
	applyPatch: (patchId: string) => Promise<void>;
	rejectPatch: (patchId: string) => Promise<void>;
	cancelPreview: () => void;
	onHandlesDelete: (handleIds: string[]) => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

const CanvasProvider = ({
	canvasId,
	children,
}: PropsWithChildren<{
	canvasId: string;
}>) => {
	const { addBatch } = useTaskManagerCtx();
	const updateNodeInternals = useUpdateNodeInternals();
	const dispatch = useAppDispatch();
	const store = useStore();
	const rfInstance = useRef<ReactFlowInstance | undefined>(undefined);
	const rfNodes = useAppSelector(selectRFNodes);
	const rfEdges = useAppSelector(selectRFEdges);

	const handleEntities = useAppSelector(handleSelectors.selectAll);

	const [patchCanvasAsync] = usePatchCanvasMutation();
	const [runNodesMutateAsync] = useProcessNodesMutation();

	const [triggerGetPatch] = useLazyGetPatchQuery();
	const [applyPatchMutation] = useApplyPatchMutation();
	const [rejectPatchMutation] = useRejectPatchMutation();

	const { nodeTemplates } = useNodeTemplates();

	const {
		data: canvasDetailsResponse,
		isLoading,
		isError,
		refetch: refetchCanvas,
	} = useGetCanvasDetailsQuery({
		param: {
			id: canvasId,
		},
	});

	// Use useRef instead of useState for isReviewing to prevent unnecessary re-renders
	const isReviewingRef = useRef(false);
	const previewPatchIdRef = useRef<string | null>(null);

	// Track state changes to force re-render when needed
	const [reviewingStateVersion, setReviewingStateVersion] = useState(0);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const timeoutFireTimeRef = useRef<number | null>(null);

	const { initialEdges, initialNodes } = useMemo(() => {
		if (!canvasDetailsResponse?.nodes) {
			return { initialEdges: [], initialNodes: [] };
		}

		const initialNodes: Node[] = canvasDetailsResponse.nodes.map((node) => ({
			id: node.id,
			position: node.position as XYPosition,
			data: node,
			type: node.type,
			width: node.width ?? undefined,
			height: node.height ?? undefined,
			draggable: true,
			selectable: true,
			deletable: true,
		}));

		const initialEdges: Edge[] = canvasDetailsResponse.edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			sourceHandle: edge.sourceHandleId || undefined,
			targetHandle: edge.targetHandleId || undefined,
		}));

		return { initialEdges, initialNodes };
	}, [canvasDetailsResponse]);

	useEffect(() => {
		if (canvasDetailsResponse?.nodes && !isReviewingRef.current) {
			dispatch(setAllNodeEntities(canvasDetailsResponse.nodes));
			dispatch(setAllEdgeEntities(canvasDetailsResponse.edges));
			dispatch(setAllHandleEntities(canvasDetailsResponse.handles));
			dispatch(setNodes(initialNodes));
			dispatch(setEdges(initialEdges));
		}
	}, [dispatch, canvasDetailsResponse, initialNodes, initialEdges]);

	const getSavePayload = useCallback(() => {
		const state = store.getState() as RootState;
		const currentNodeEntities = Object.values(state.nodes.entities);
		const currentRfNodes = Object.values(state.reactFlow.nodes);
		const currentEdgeEntities = Object.values(state.edges.entities);
		const currentRfEdges = Object.values(state.reactFlow.edges);
		const currentHandleEntities = Object.values(state.handles.entities);
		const currentCanvasDetailsNodes = currentNodeEntities
			.map((n) => {
				const rfNode = currentRfNodes.find((f) => f.id === n.id);
				if (!rfNode) {
					return undefined;
				}
				return {
					...n,
					position: rfNode.position,
					width: rfNode.width ?? undefined,
					height: rfNode.height ?? undefined,
					result: n.result ?? undefined,
				};
			})
			.filter((f) => !!f);

		const currentDbEdges: PatchCanvasRPCParams["json"]["edges"] =
			currentEdgeEntities
				.map((e) => {
					const rfEdge = currentRfEdges.find((f) => f.id === e.id);
					if (!rfEdge || !e) {
						return null;
					}
					return {
						id: e.id,
						source: rfEdge.source,
						target: rfEdge.target,
						targetHandleId: rfEdge.targetHandle as string,
						sourceHandleId: rfEdge.sourceHandle as string,
					};
				})
				.filter(Boolean) as PatchCanvasRPCParams["json"]["edges"];

		const body: PatchCanvasRPCParams["json"] = {
			nodes: currentCanvasDetailsNodes,
			edges: currentDbEdges,
			handles: currentHandleEntities,
		};

		return body;
	}, [store]);

	const save = useCallback(async () => {
		if (!canvasId || isReviewingRef.current) {
			return;
		}

		const body = getSavePayload();

		return patchCanvasAsync({
			json: body,
			param: {
				id: canvasId,
			},
		});
	}, [canvasId, patchCanvasAsync, getSavePayload]);

	useEffect(() => {
		const handleBeforeUnload = () => {
			if (!canvasId || isReviewingRef.current) return;

			const body = getSavePayload();
			const url = `/api/v1/canvas/${canvasId}`;

			fetch(url, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
				keepalive: true,
			});
		};

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [canvasId, getSavePayload]);

	const scheduleSave = useCallback(
		(delay?: number, opts?: { preventExtend?: boolean }) => {
			if (isReviewingRef.current) return;

			const duration = delay ?? 2500;
			const fireTime = Date.now() + duration;

			if (timeoutRef.current) {
				if (opts?.preventExtend && timeoutFireTimeRef.current !== null) {
					// If existing timer fires sooner or at same time, keep it
					if (timeoutFireTimeRef.current <= fireTime) {
						return;
					}
				}
				clearTimeout(timeoutRef.current);
			}

			timeoutFireTimeRef.current = fireTime;
			timeoutRef.current = setTimeout(() => {
				timeoutRef.current = null;
				timeoutFireTimeRef.current = null;
				save();
			}, duration);
		},
		[save],
	);

	const createNewHandle = useCallback(
		(newHandle: HandleEntityType) => {
			dispatch(createHandleEntity(newHandle));
			updateNodeInternals(newHandle.nodeId);
			scheduleSave();
		},
		[dispatch, scheduleSave, updateNodeInternals],
	);

	const onNodesChange = useCallback(
		(changes: NodeChange<Node>[]) => {
			dispatch(onNodeChange(changes));
			const shouldSave = changes.some((c) => c.type !== "select");

			if (shouldSave) {
				scheduleSave(undefined, { preventExtend: true });
			}
		},
		[dispatch, scheduleSave],
	);

	const onNodeConfigUpdate = useCallback(
		(payload: {
			id: string;
			newConfig: Partial<AllNodeConfig>;
			appendHistory?: boolean;
		}) => {
			const dispatchAction = payload.appendHistory
				? updateNodeConfig
				: updateNodeConfigWithoutHistory;
			dispatch(dispatchAction(payload));
			scheduleSave();
		},
		[dispatch, scheduleSave],
	);

	const onNodeResultUpdate = useCallback(
		(payload: { id: string; newResult: NodeResult }) => {
			dispatch(updateNodeResult(payload));
			scheduleSave();
		},
		[dispatch, scheduleSave],
	);

	const onEdgesChange = useCallback(
		(changes: EdgeChange<Edge>[]) => {
			dispatch(onEdgeChange(changes));

			const shouldSave = changes.some((c) => c.type !== "select");
			if (shouldSave) {
				scheduleSave(undefined, { preventExtend: true });
			}
		},
		[dispatch, scheduleSave],
	);

	const moveViewportToNode = useCallback(
		(nodeId: string, options?: { zoom?: number; duration?: number }) => {
			if (!rfInstance.current) {
				toast.error("Canvas not initialized");
				return;
			}

			const node = rfNodes.find((n) => n.id === nodeId);
			if (!node) {
				toast.error(`Node ${nodeId} not found`);
				return;
			}

			const x = node.position.x + (node.width ?? 300) / 2;
			const y = node.position.y + (node.height ?? 200) / 2;

			rfInstance.current.setCenter(x, y, {
				zoom: options?.zoom ?? 1,
				duration: options?.duration ?? 500,
			});
		},
		[rfNodes],
	);

	const isValidConnection = useCallback(
		(connection: Connection | Edge): { isValid: boolean; error?: string } => {
			if (!connection.source || !connection.target) {
				return {
					isValid: false,
					error: "Target or source could not be found.",
				};
			}

			if (connection.source === connection.target) {
				return {
					isValid: false,
					error: "Self-connection is not a valid connection.",
				};
			}

			const sourceNode = rfNodes.find((n) => n.id === connection.source);
			if (!sourceNode) {
				return { isValid: false, error: "Source node could not be found." };
			}

			const targetNode = rfNodes.find((n) => n.id === connection.target);
			if (!targetNode) {
				return { isValid: false, error: "Target node could not be found." };
			}

			const isReachable = (fromId: string, toId: string): boolean => {
				const visited = new Set<string>();

				const dfs = (currentId: string): boolean => {
					if (visited.has(currentId)) return false;
					visited.add(currentId);
					if (currentId === toId) return true;

					const currentNode = rfNodes.find((n) => n.id === currentId);
					if (!currentNode) return false;

					const outgoers = getOutgoers(currentNode, rfNodes, rfEdges);
					for (const outgoer of outgoers) {
						if (dfs(outgoer.id)) return true;
					}

					return false;
				};

				return dfs(fromId);
			};

			if (isReachable(targetNode.id, sourceNode.id)) {
				return { isValid: false, error: "Looping connection is not valid." };
			}

			const sourceHandle = handleEntities.find(
				(h) => h.id === connection.sourceHandle,
			);

			const targetHandle = handleEntities.find(
				(h) => h.id === connection.targetHandle,
			);

			if (!sourceHandle || !targetHandle) {
				return {
					isValid: false,
					error: "Source or target handle could not be found.",
				};
			}

			if (sourceHandle.type !== "Output" || targetHandle.type !== "Input") {
				return { isValid: false, error: "Can only connect output to input." };
			}

			return { isValid: true };
		},
		[rfNodes, handleEntities, rfEdges],
	);

	const onConnect = useCallback(
		(params: Connection) => {
			const { isValid, error } = isValidConnection(params);
			if (!isValid) {
				if (error) {
					toast.error(error);
				}
				return;
			}

			const sourceHandle = handleEntities.find(
				(h) => h.id === params.sourceHandle,
			);
			if (!sourceHandle) {
				throw new Error("Source handle could not be found");
			}

			const newEdges = (() => {
				const updatedEdges = rfEdges.filter((e) => {
					const isSameTargetHandle =
						e.target === params.target &&
						e.targetHandle === params.targetHandle;
					const isSameSourceToNode =
						e.source === params.source &&
						e.sourceHandle === params.sourceHandle &&
						e.target === params.target;

					return !isSameTargetHandle && !isSameSourceToNode;
				});

				return [
					...updatedEdges,
					{
						id: `e${params.source}-${params.target}-${Date.now()}`,
						source: params.source,
						target: params.target,
						sourceHandle: params.sourceHandle || undefined,
						targetHandle: params.targetHandle || undefined,
					} as Edge,
				];
			})();

			const edgeEntities: EdgeEntityType[] = newEdges
				.map((ne) => {
					if (ne.sourceHandle && ne.targetHandle) {
						return {
							id: ne.id,
							source: ne.source,
							target: ne.target,
							targetHandleId: ne.targetHandle,
							sourceHandleId: ne.sourceHandle,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
						};
					}
					return null;
				})
				.filter((f): f is EdgeEntityType => !!f);

			dispatch(setEdges(newEdges));
			dispatch(setAllEdgeEntities(edgeEntities));
			scheduleSave();
		},
		[isValidConnection, handleEntities, dispatch, scheduleSave, rfEdges],
	);

	const onNodesDelete = useCallback(
		async (nodeIds: NodeEntityType["id"][]) => {
			const nodesToDelete = rfNodes.filter((n) => nodeIds.includes(n.id));
			const newNodes = rfNodes.filter((f) => !nodeIds.includes(f.id));
			const edgesToRemove = getConnectedEdges(nodesToDelete, rfEdges);
			const deletedEdgeIds = edgesToRemove.map((m) => m.id);
			const newEdges = rfEdges.filter((f) => !deletedEdgeIds.includes(f.id));
			const deletedHandleIds = handleEntities
				.filter((m) => nodeIds.includes(m.nodeId))
				.map((m) => m.id);
			dispatch(deleteManyEdgeEntity(deletedEdgeIds));
			dispatch(deleteManyNodeEntity(nodeIds));
			dispatch(setNodes(newNodes));
			dispatch(setEdges(newEdges));
			dispatch(deleteManyHandleEntity(deletedHandleIds));

			scheduleSave();
		},
		[rfEdges, rfNodes, dispatch, handleEntities, scheduleSave],
	);

	const onEdgesDelete = useCallback(
		async (edgeIds: NodeEntityType["id"][]) => {
			const newEdges = rfEdges.filter((f) => !edgeIds.includes(f.id));
			dispatch(setEdges(newEdges));
			dispatch(deleteManyEdgeEntity(edgeIds));

			scheduleSave();
		},
		[rfEdges, dispatch, scheduleSave],
	);

	const onHandlesDelete = useCallback(
		async (handleIds: string[]) => {
			// Find edges connected to these handles
			const edgesAsString = rfEdges.filter(
				(e) =>
					(e.sourceHandle && handleIds.includes(e.sourceHandle)) ||
					(e.targetHandle && handleIds.includes(e.targetHandle)),
			);
			const edgeIds = edgesAsString.map((e) => e.id);

			// Remove edges
			if (edgeIds.length > 0) {
				const newEdges = rfEdges.filter((f) => !edgeIds.includes(f.id));
				dispatch(setEdges(newEdges));
				dispatch(deleteManyEdgeEntity(edgeIds));
			}

			// Handle Layer Updates for Compositor/VideoGen nodes
			const affectedNodeIds = new Set<string>();
			for (const handleId of handleIds) {
				const handle = handleEntities.find((h) => h.id === handleId);
				if (handle) {
					affectedNodeIds.add(handle.nodeId);
					updateNodeInternals(handle.nodeId);

					const state = store.getState() as RootState;
					const nodeEntity = state.nodes.entities[handle.nodeId];

					if (
						nodeEntity &&
						(nodeEntity.type === "Compositor" ||
							nodeEntity.type === "VideoCompositor")
					) {
						// Check if config has layerUpdates
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const config = nodeEntity.config as any;
						if (
							config &&
							config.layerUpdates &&
							config.layerUpdates[handleId]
						) {
							const newLayerUpdates = { ...config.layerUpdates };
							delete newLayerUpdates[handleId];
							dispatch(
								updateNodeConfig({
									id: handle.nodeId,
									newConfig: {
										layerUpdates: newLayerUpdates,
									},
								}),
							);
						}
					}
				}
			}

			// Remove handles
			dispatch(deleteManyHandleEntity(handleIds));

			scheduleSave();
		},
		[
			rfEdges,
			dispatch,
			scheduleSave,
			handleEntities,
			updateNodeInternals,
			store,
		],
	);

	const runNodes = useCallback(
		async (node_ids?: Node["id"][]) => {
			await save();

			const resp = await runNodesMutateAsync({
				param: {
					id: canvasId,
				},
				json: {
					node_ids,
				},
			});
			addBatch(resp.data as BatchEntity);
		},
		[save, runNodesMutateAsync, canvasId, addBatch],
	);

	const createNewNode = useCallback(
		(
			template: NodeTemplateListItemRPC,
			position: XYPosition,
			initialResult?: NodeResult,
		) => {
			const nodeId = generateId();
			const initialResultToUse: NodeResult = initialResult ?? {
				selectedOutputIndex: 0,
				outputs: [],
			};

			const handles = template.templateHandles.map((tHandle) => ({
				nodeId: nodeId,
				label: tHandle.label,
				templateHandleId: tHandle.id,
				id: generateId(),
				description: null,
				order: tHandle.order,
				required: tHandle.required,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				type: tHandle.type,
				dataTypes: tHandle.dataTypes,
			}));
			if (initialResultToUse.outputs.length) {
				for (let i = 0; i < initialResultToUse.outputs[0].items?.length; i++) {
					const outputItem = initialResultToUse.outputs[0].items[i];
					const respHandle = handles[i];
					if (respHandle) {
						outputItem.outputHandleId = respHandle.id;
					}
				}
			}

			const nodeEntity: NodeEntityType = {
				id: nodeId,
				name: template.displayName,
				templateId: template.id,
				template: template,
				type: template.type,
				position,
				width: 340,
				height: null,
				canvasId: canvasId,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				originalNodeId: null,
				config: template.defaultConfig || {},
				result: initialResult as unknown as NodeEntityType["result"],
			};
			const newNode: Node = {
				id: nodeId,
				position,
				data: nodeEntity,
				type: template.type,
				width: 340,
				height: undefined,
				draggable: true,
				selectable: true,
				deletable: true,
			};
			dispatch(createNode(newNode));
			dispatch(createNodeEntity(nodeEntity));
			dispatch(addManyHandleEntities(handles));

			let saveDelay: number | undefined;
			if (template.type === "File") {
				saveDelay = 50;
			}
			dispatch(setSelectedNodeIds([newNode.id]));
			scheduleSave(saveDelay);
		},
		[canvasId, dispatch, scheduleSave],
	);

	const duplicateNodes = useCallback(
		(nodeIds: Node["id"][]) => {
			const newRfNodes: Node[] = [];
			const newNodeEntities: NodeEntityType[] = [];
			const allNewHandles: HandleEntityType[] = [];

			const rootState = store.getState() as RootState;

			for (const nodeId of nodeIds) {
				const rfNodeToDuplicate = rfNodes.find((n) => n.id === nodeId);
				if (!rfNodeToDuplicate) {
					toast.error(`Node ${nodeId} to duplicate not found`);
					continue;
				}

				const nodeEntityToDuplicate = rootState.nodes.entities[nodeId];
				if (!nodeEntityToDuplicate) {
					toast.error(`Node entity ${nodeId} to duplicate not found`);
					continue;
				}

				const template = nodeEntityToDuplicate.template;
				const templateEntity = nodeTemplates?.find((f) => f.id === template.id);
				if (!templateEntity) {
					toast.error(`Node template for ${nodeId} to duplicate not found`);
					continue;
				}

				const newNodeId = generateId();
				let initialResult: NodeResult | null = null;

				const handles = templateEntity.templateHandles.map((tHandle, i) => ({
					nodeId: newNodeId,
					label: tHandle.label,
					order: i,
					templateHandleId: tHandle.id,
					id: generateId(),
					required: tHandle.required,
					description: null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					type: tHandle.type,
					dataTypes: tHandle.dataTypes,
				}));

				allNewHandles.push(...handles);

				if (template.type === "Text") {
					initialResult = {
						selectedOutputIndex: 0,
						outputs: [
							{
								items: [
									{ type: "Text", outputHandleId: handles[0].id, data: "" },
								],
							},
						],
					};
				} else {
					initialResult = {
						selectedOutputIndex: 0,
						outputs: [],
					};
				}

				const position = {
					x: rfNodeToDuplicate.position.x + 320,
					y: rfNodeToDuplicate.position.y + 320,
				};

				const nodeEntity: NodeEntityType = {
					id: newNodeId,
					name: template.displayName,
					templateId: template.id,
					template: template,
					type: template.type,
					position,
					width: 340,
					height: null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					originalNodeId: null,
					canvasId: canvasId,
					config: template.defaultConfig || {},
					result: initialResult as unknown as NodeEntityType["result"],
				};
				const newNode: Node = {
					id: newNodeId,
					position,
					data: nodeEntity,
					type: template.type,
					width: 340,
					height: undefined,
					draggable: true,
					selectable: true,
					deletable: true,
				};
				newRfNodes.push(newNode);
				newNodeEntities.push(nodeEntity);
			}

			const batchActionsList = [];
			if (newRfNodes.length > 0) {
				batchActionsList.push(setNodes([...rfNodes, ...newRfNodes]));
			}
			for (const newNodeEntity of newNodeEntities) {
				batchActionsList.push(createNodeEntity(newNodeEntity));
			}
			if (allNewHandles.length > 0) {
				batchActionsList.push(addManyHandleEntities(allNewHandles));
			}
			for (const action of batchActionsList) {
				dispatch(action);
			}
			if (newRfNodes.length > 0) {
				scheduleSave();
			}
		},
		[canvasId, dispatch, nodeTemplates, rfNodes, scheduleSave, store],
	);

	// --- Patch System Implementation ---

	const previewPatch = useCallback(
		async (patchId: string) => {
			try {
				const { data: patch } = await triggerGetPatch({
					param: { id: canvasId, patchId },
				});

				if (!patch || !patch.patch) {
					toast.error("Failed to load patch data");
					return;
				}

				const state = store.getState() as RootState;
				const currentNodeEntities = Object.values(state.nodes.entities);

				const patchData = patch.patch as unknown as BulkUpdatePayload;

				const patchNodes: NodeEntityType[] = (patchData.nodes || []).map(
					(n) => ({
						...n,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						canvasId,
						template: (n as any).template,
					}),
				) as any;

				const hydratedNodes = patchNodes.map((n) => {
					const template = nodeTemplates?.find((t) => t.id === n.templateId);
					const prevNode = currentNodeEntities.find((f) => f.id === n.id);
					return {
						...n,
						template: template || (n as any).template,
						draggable: true,
						selectable: true,
						result: n.result ?? prevNode?.result,
						deletable: true,
					};
				});

				const rfPatchNodes: Node[] = hydratedNodes.map((node) => ({
					id: node.id,
					position: node.position as XYPosition,
					data: node,
					type: node.type,
					width: node.width ?? undefined,
					height: node.height ?? undefined,
					draggable: true,
					selectable: true,
					deletable: true,
				}));

				const rfPatchEdges: Edge[] = (patchData.edges || []).map((edge) => ({
					id: edge.id,
					source: edge.source,
					target: edge.target,
					sourceHandle: edge.sourceHandleId || undefined,
					targetHandle: edge.targetHandleId || undefined,
				}));

				// Set reviewing state BEFORE updating Redux to prevent save triggers
				isReviewingRef.current = true;
				previewPatchIdRef.current = patchId;
				dispatch(setAllNodeEntities(hydratedNodes as NodeEntityType[]));
				dispatch(setAllEdgeEntities(patchData.edges as EdgeEntityType[]));
				dispatch(setAllHandleEntities(patchData.handles as HandleEntityType[]));
				dispatch(setNodes(rfPatchNodes));
				dispatch(setEdges(rfPatchEdges));

				// Force re-render to update UI with new reviewing state
				setReviewingStateVersion((v) => v + 1);

				toast.info("Previewing patch...");
			} catch (error) {
				console.error("Error previewing patch:", error);
				toast.error("Failed to preview patch");
				// Reset state on error
				isReviewingRef.current = false;
				previewPatchIdRef.current = null;
				setReviewingStateVersion((v) => v + 1);
			}
		},
		[canvasId, dispatch, nodeTemplates, triggerGetPatch],
	);

	const cancelPreview = useCallback(() => {
		if (!canvasDetailsResponse?.nodes) {
			isReviewingRef.current = false;
			previewPatchIdRef.current = null;
			setReviewingStateVersion((v) => v + 1);
			return;
		}

		const originalNodes = canvasDetailsResponse.nodes.map((node) => ({
			id: node.id,
			position: node.position as XYPosition,
			data: node,
			type: node.type,
			width: node.width ?? undefined,
			height: node.height ?? undefined,
			draggable: true,
			selectable: true,
			deletable: true,
		}));

		const originalEdges = canvasDetailsResponse.edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			sourceHandle: edge.sourceHandleId || undefined,
			targetHandle: edge.targetHandleId || undefined,
		}));

		// Atomic revert
		dispatch(setAllNodeEntities(canvasDetailsResponse.nodes));
		dispatch(setAllEdgeEntities(canvasDetailsResponse.edges));
		dispatch(setAllHandleEntities(canvasDetailsResponse.handles));
		dispatch(setNodes(originalNodes));
		dispatch(setEdges(originalEdges));

		// Clear reviewing state AFTER revert
		isReviewingRef.current = false;
		previewPatchIdRef.current = null;
		setReviewingStateVersion((v) => v + 1);

		refetchCanvas();
		toast.info("Preview cancelled");
	}, [canvasDetailsResponse, dispatch, refetchCanvas]);

	const applyPatch = useCallback(
		async (patchId: string) => {
			try {
				await applyPatchMutation({ param: { id: canvasId, patchId } }).unwrap();

				isReviewingRef.current = false;
				previewPatchIdRef.current = null;
				setReviewingStateVersion((v) => v + 1);

				refetchCanvas();
				toast.success("Applied changes to the canvas succesfully");
			} catch (error) {
				console.error("Error applying patch:", error);
				toast.error("Failed to apply patch");
			}
		},
		[applyPatchMutation, canvasId, refetchCanvas],
	);

	const rejectPatch = useCallback(
		async (patchId: string) => {
			try {
				await rejectPatchMutation({
					param: { id: canvasId, patchId },
				}).unwrap();

				if (canvasDetailsResponse?.nodes) {
					const originalNodes = canvasDetailsResponse.nodes.map((node) => ({
						id: node.id,
						position: node.position as XYPosition,
						data: node,
						type: node.type,
						width: node.width ?? undefined,
						height: node.height ?? undefined,
						draggable: true,
						selectable: true,
						deletable: true,
					}));

					const originalEdges = canvasDetailsResponse.edges.map((edge) => ({
						id: edge.id,
						source: edge.source,
						target: edge.target,
						sourceHandle: edge.sourceHandleId || undefined,
						targetHandle: edge.targetHandleId || undefined,
					}));

					dispatch(setAllNodeEntities(canvasDetailsResponse.nodes));
					dispatch(setAllEdgeEntities(canvasDetailsResponse.edges));
					dispatch(setAllHandleEntities(canvasDetailsResponse.handles));
					dispatch(setNodes(originalNodes));
					dispatch(setEdges(originalEdges));
				}

				isReviewingRef.current = false;
				previewPatchIdRef.current = null;
				setReviewingStateVersion((v) => v + 1);

				await refetchCanvas();
				toast.info("Patch rejected");
			} catch (error) {
				console.error("Error rejecting patch:", error);
				toast.error("Failed to reject patch");
			}
		},
		[
			rejectPatchMutation,
			canvasId,
			refetchCanvas,
			canvasDetailsResponse,
			dispatch,
		],
	);

	const value = useMemo(
		() => ({
			canvas: canvasDetailsResponse?.canvas,
			onNodesChange,
			onEdgesChange,
			isLoading,
			isError,
			onConnect,
			runNodes,
			rfInstance,
			createNewNode,
			duplicateNodes,
			onNodesDelete,
			onEdgesDelete,
			onNodeConfigUpdate,
			createNewHandle,
			onNodeResultUpdate,
			moveViewportToNode,
			// Patch System - expose ref value as boolean
			isReviewing: isReviewingRef.current,
			previewPatch,
			applyPatch,
			rejectPatch,
			cancelPreview,
			onHandlesDelete,
		}),
		[
			canvasDetailsResponse?.canvas,
			onNodesChange,
			onEdgesChange,
			isLoading,
			isError,
			onConnect,
			runNodes,
			createNewNode,
			duplicateNodes,
			onNodesDelete,
			onEdgesDelete,
			onHandlesDelete,
			onNodeConfigUpdate,
			createNewHandle,
			onNodeResultUpdate,
			moveViewportToNode,
			reviewingStateVersion, // Include to force re-compute when reviewing state changes
			previewPatch,
			applyPatch,
			rejectPatch,
			cancelPreview,
		],
	);

	return (
		<CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
	);
};

export function useCanvasCtx() {
	const ctx = useContext(CanvasContext);
	if (!ctx) {
		throw new Error("useCanvasCtx should used inside CanvasProvider");
	}
	return ctx;
}

export { CanvasContext, CanvasProvider };
