import type { NodeType } from "@gatewai/db";
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
import type {
	CanvasDetailsRPC,
	NodeTemplateListItemRPC,
	PatchCanvasRPCParams,
} from "@/rpc/types";
import { type RootState, useAppDispatch, useAppSelector } from "@/store";
import {
	useApplyPatchMutation,
	useGetCanvasDetailsQuery,
	useLazyGetPatchQuery,
	usePatchCanvasMutation,
	useProcessNodesMutation,
	useRejectPatchMutation,
} from "@/store/canvas";
import {
	deleteManyEdgeEntity,
	type EdgeEntityType,
	setAllEdgeEntities,
} from "@/store/edges";
import {
	addManyHandleEntities,
	createHandleEntity,
	deleteManyHandleEntity,
	type HandleEntityType,
	handleSelectors,
	setAllHandleEntities,
} from "@/store/handles";
import { setSelectedNodeIds } from "@/store/node-meta";
import {
	createNodeEntity,
	deleteManyNodeEntity,
	type NodeEntityType,
	setAllNodeEntities,
	updateNodeConfig,
	updateNodeConfigWithoutHistory,
	updateNodeResult,
} from "@/store/nodes";
import {
	createNode,
	onEdgeChange,
	onNodeChange,
	selectRFEdges,
	selectRFNodes,
	setEdges,
	setNodes,
} from "@/store/rfstate";
import type { BatchEntity } from "@/store/tasks";
import { batchActions } from "@/store/undo-redo";
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

	const [isReviewing, setIsReviewing] = useState(false);
	const [previewPatchId, setPreviewPatchId] = useState<string | null>(null);

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
			draggable: node.draggable ?? true,
			selectable: node.selectable ?? true,
			deletable: node.deletable ?? true,
		}));

		// Map backend edges to React Flow edges with handle support
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
		if (canvasDetailsResponse?.nodes && !isReviewing) {
			dispatch(setAllNodeEntities(canvasDetailsResponse.nodes));
			dispatch(setAllEdgeEntities(canvasDetailsResponse.edges));
			dispatch(setAllHandleEntities(canvasDetailsResponse.handles));
			dispatch(setNodes(initialNodes));
			dispatch(setEdges(initialEdges));
		}
	}, [
		dispatch,
		canvasDetailsResponse,
		initialNodes,
		initialEdges,
		isReviewing,
	]);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	const save = useCallback(() => {
		if (!canvasId || isReviewing) return;
		const state = store.getState() as RootState;
		const currentNodeEntities = Object.values(
			state.flow.present.nodes.entities,
		);
		const currentRfNodes = Object.values(state.flow.present.reactFlow.nodes);
		const currentEdgeEntities = Object.values(
			state.flow.present.edges.entities,
		);
		const currentRfEdges = Object.values(state.flow.present.reactFlow.edges);
		const currentHandleEntities = Object.values(
			state.flow.present.handles.entities,
		);
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
					zIndex: n.zIndex ?? undefined,
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

		return patchCanvasAsync({
			json: body,
			param: {
				id: canvasId,
			},
		});
	}, [canvasId, patchCanvasAsync, store, isReviewing]);

	const scheduleSave = useCallback(
		(delay?: number) => {
			if (isReviewing) return;
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			timeoutRef.current = setTimeout(() => {
				save();
			}, delay ?? 2500);
		},
		[save, isReviewing],
	);

	const createNewHandle = useCallback(
		(newHandle: HandleEntityType) => {
			dispatch(createHandleEntity(newHandle));
			// When adding handles, we need to notify React Flow to update its internals
			updateNodeInternals(newHandle.nodeId);
			scheduleSave();
		},
		[dispatch, scheduleSave, updateNodeInternals],
	);

	const onNodesChange = useCallback(
		(changes: NodeChange<Node>[]) => {
			dispatch(onNodeChange(changes));
			scheduleSave();
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
			scheduleSave();
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

			// Calculate center position of the node
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

			// Self-connection is always invalid
			if (connection.source === connection.target) {
				return {
					isValid: false,
					error: "Self-connection is not a valid connection.",
				};
			}

			// Find source node
			const sourceNode = rfNodes.find((n) => n.id === connection.source);
			if (!sourceNode) {
				return { isValid: false, error: "Source node could not be found." };
			}

			// Find target node
			const targetNode = rfNodes.find((n) => n.id === connection.target);
			if (!targetNode) {
				return { isValid: false, error: "Target node could not be found." };
			}

			// Check for cycles: adding this edge (source -> target) creates a cycle if there's already a path from target to source
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

			// Validate if data types for handles match
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

			// Ensure source is output and target is input
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
				// Remove edge if target handle is already occupied (existing logic)
				// Remove edge if source handle is already connected to THIS target node (new requirement)
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

				// Add the new edge
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

			// Map to entities for DB sync
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

			scheduleSave();
		},
		[rfEdges, dispatch, scheduleSave],
	);

	const runNodes = useCallback(
		async (node_ids?: Node["id"][]) => {
			// Save before running
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

	useEffect(() => {
		dispatch(setNodes(initialNodes));
		dispatch(setEdges(initialEdges));
	}, [dispatch, initialEdges, initialNodes]);

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
				type: template.type as NodeType,
				position,
				width: 340,
				height: null,
				isDirty: false,
				canvasId: canvasId,
				zIndex: 1,
				draggable: true,
				selectable: true,
				deletable: true,
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
				type: template.type as NodeType,
				width: 340,
				height: undefined,
				draggable: true,
				selectable: true,
				deletable: true,
			};
			const createBatch = batchActions([
				createNode(newNode),
				createNodeEntity(nodeEntity),
				addManyHandleEntities(handles),
			]);
			dispatch(createBatch);
			let saveDelay: number | undefined;
			// I have a lidl suspicion that this will fucking bite me asp
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

				const nodeEntityToDuplicate =
					rootState.flow.present.nodes.entities[nodeId];
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
					type: template.type as NodeType,
					position,
					width: 340,
					height: null,
					isDirty: false,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					originalNodeId: null,
					canvasId: canvasId,
					zIndex: 1,
					draggable: true,
					selectable: true,
					deletable: true,
					config: template.defaultConfig || {},
					result: initialResult as unknown as NodeEntityType["result"],
				};
				const newNode: Node = {
					id: newNodeId,
					position,
					data: nodeEntity,
					type: template.type as NodeType,
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
			const createBatch = batchActions(batchActionsList);
			dispatch(createBatch);
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

				const patchData = patch.patch as unknown as BulkUpdatePayload;

				// Convert patch data to React Flow and Entity format
				// This mimics the initial load logic
				const patchNodes: NodeEntityType[] = (patchData.nodes || []).map(
					(n) => ({
						...n,
						// Ensure defaults for missing fields if any
						isDirty: false,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						canvasId,
						template: (n as any).template, // Assuming template data is included or we need to fetch it?
					}),
				) as any;

				// We need to hydrate the nodes with template info for the UI to render correctly
				const hydratedNodes = patchNodes.map((n) => {
					const template = nodeTemplates?.find((t) => t.id === n.templateId);
					return {
						...n,
						template: template || (n as any).template, // Fallback if already present
						// Add other required fields
						draggable: true,
						selectable: true,
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

				// Update Redux Store ATOMICALLY to avoid inconsistent states in GraphProcessor
				dispatch(
					batchActions([
						setAllNodeEntities(hydratedNodes as NodeEntityType[]),
						setAllEdgeEntities(patchData.edges as EdgeEntityType[]),
						setAllHandleEntities(patchData.handles as HandleEntityType[]),
						setNodes(rfPatchNodes),
						setEdges(rfPatchEdges),
					]),
				);

				setIsReviewing(true);
				setPreviewPatchId(patchId);
				toast.info("Previewing patch...");
			} catch (error) {
				console.error("Error previewing patch:", error);
				toast.error("Failed to preview patch");
			}
		},
		[canvasId, dispatch, nodeTemplates, triggerGetPatch],
	);

	const cancelPreview = useCallback(() => {
		// Explicitly revert to the original server state BEFORE unsetting 'isReviewing'.
		// This ensures that if any auto-save mechanism triggers (via onNodesChange etc.),
		// it sees the original 'valid' state and not the patch state.

		if (!canvasDetailsResponse?.nodes) {
			setIsReviewing(false);
			setPreviewPatchId(null);
			return;
		}

		const originalNodes = canvasDetailsResponse.nodes.map((node) => ({
			id: node.id,
			position: node.position as XYPosition,
			data: node,
			type: node.type,
			width: node.width ?? undefined,
			height: node.height ?? undefined,
			draggable: node.draggable ?? true,
			selectable: node.selectable ?? true,
			deletable: node.deletable ?? true,
		}));

		const originalEdges = canvasDetailsResponse.edges.map((edge) => ({
			id: edge.id,
			source: edge.source,
			target: edge.target,
			sourceHandle: edge.sourceHandleId || undefined,
			targetHandle: edge.targetHandleId || undefined,
		}));

		// Atomic revert of the entire state
		dispatch(
			batchActions([
				setAllNodeEntities(canvasDetailsResponse.nodes),
				setAllEdgeEntities(canvasDetailsResponse.edges),
				setAllHandleEntities(canvasDetailsResponse.handles),
				setNodes(originalNodes),
				setEdges(originalEdges),
			]),
		);

		// Now it's safe to disable reviewing mode
		setIsReviewing(false);
		setPreviewPatchId(null);

		// Refetch to ensure strict consistency with backend
		refetchCanvas();
		toast.info("Preview cancelled");
	}, [canvasDetailsResponse, dispatch, refetchCanvas]);

	const applyPatch = useCallback(
		async (patchId: string) => {
			try {
				await applyPatchMutation({ param: { id: canvasId, patchId } }).unwrap();
				setIsReviewing(false);
				setPreviewPatchId(null);
				refetchCanvas();
				toast.success("Patch applied successfully");
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

				// Similar to cancelPreview, strictly revert state before allowing interactions/saves
				if (canvasDetailsResponse?.nodes) {
					const originalNodes = canvasDetailsResponse.nodes.map((node) => ({
						id: node.id,
						position: node.position as XYPosition,
						data: node,
						type: node.type,
						width: node.width ?? undefined,
						height: node.height ?? undefined,
						draggable: node.draggable ?? true,
						selectable: node.selectable ?? true,
						deletable: node.deletable ?? true,
					}));

					const originalEdges = canvasDetailsResponse.edges.map((edge) => ({
						id: edge.id,
						source: edge.source,
						target: edge.target,
						sourceHandle: edge.sourceHandleId || undefined,
						targetHandle: edge.targetHandleId || undefined,
					}));

					dispatch(
						batchActions([
							setAllNodeEntities(canvasDetailsResponse.nodes),
							setAllEdgeEntities(canvasDetailsResponse.edges),
							setAllHandleEntities(canvasDetailsResponse.handles),
							setNodes(originalNodes),
							setEdges(originalEdges),
						]),
					);
				}

				setIsReviewing(false);
				setPreviewPatchId(null);
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
			// Patch System
			isReviewing,
			previewPatch,
			applyPatch,
			rejectPatch,
			cancelPreview,
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
			onNodeConfigUpdate,
			createNewHandle,
			onNodeResultUpdate,
			moveViewportToNode,
			isReviewing,
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
