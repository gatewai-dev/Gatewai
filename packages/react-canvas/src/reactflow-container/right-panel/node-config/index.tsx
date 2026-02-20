import {
	makeSelectAllNodes,
	makeSelectNodeById,
	selectSelectedNodeIds,
	useAppSelector,
} from "@gatewai/react-store";
import { cn, Separator } from "@gatewai/ui-kit";
import { Panel } from "@xyflow/react";
import { Fragment, memo, type ReactNode, useMemo } from "react";
import { PiCube } from "react-icons/pi";
import { useNodeRegistry } from "../../../node-registry-ctx";

type NodeConfigComponentProps = {
	id: string;
};

const NodeConfigItem = memo(({ id }: NodeConfigComponentProps) => {
	const selectNode = useMemo(() => makeSelectNodeById(id), [id]);
	const node = useAppSelector(selectNode);
	const { configMap, iconMap } = useNodeRegistry();

	if (!node) return null;
	const ConfigComponent = configMap[node.type];
	if (!ConfigComponent) {
		return null;
	}
	const { mainIcon: MainIcon } = iconMap[node?.type] ?? {
		mainIcon: PiCube,
	};

	return (
		<div className="flex flex-col gap-4" key={`${node.id}_cfg_component`}>
			<div className="flex items-center gap-2">
				<MainIcon />
				<h3 className="text-sm font-semibold">{node.name}</h3>
			</div>
			<ConfigComponent key={node.id} node={node} />
			<Separator className="my-5" />
		</div>
	);
});

const NodeConfigPanel = memo(() => {
	const selectedNodeIds = useAppSelector(selectSelectedNodeIds);
	const nodes = useAppSelector(makeSelectAllNodes);
	const { configMap } = useNodeRegistry();
	const NodesWithConfigForm = Object.keys(configMap);

	const isVisible = useMemo(() => {
		if (!selectedNodeIds || selectedNodeIds.length === 0) return false;

		const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
		return selectedNodes.some((n) => NodesWithConfigForm.includes(n.type));
	}, [selectedNodeIds, nodes, NodesWithConfigForm]);

	return (
		<Panel position="top-right" className="m-0! h-full pointer-events-none ">
			<div
				className={cn(
					"h-full w-80 border border-white/10 bg-background/80 shadow-2xl backdrop-blur-xl border-l p-4 overflow-y-auto pointer-events-auto",
					"transition-all duration-500 ease-in-out transform",
					isVisible
						? "translate-x-0 opacity-100"
						: "translate-x-full opacity-0",
				)}
			>
				<div className="flex flex-col">
					{/* We only map if visible to prevent unnecessary renders while hidden */}
					{isVisible &&
						selectedNodeIds?.map((id) => (
							<Fragment key={`${id}_cfg_section`}>
								<NodeConfigItem id={id} />
							</Fragment>
						))}
				</div>
			</div>
		</Panel>
	);
});

export { NodeConfigPanel };
