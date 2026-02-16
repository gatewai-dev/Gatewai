import {
	type NodeEntityType,
	selectSelectedNodes,
	useAppSelector,
} from "@gatewai/react-store";
import { cn, Separator } from "@gatewai/ui-kit";
import { Panel } from "@xyflow/react";
import { Fragment, memo, type ReactNode, useMemo } from "react";
import { PiCube } from "react-icons/pi";
import { useNodeRegistry } from "@/node-registry-ctx";

type NodeConfigComponentProps = {
	node: NodeEntityType;
};

const NodeConfigItem = memo(({ node }: NodeConfigComponentProps) => {
	const { configMap, iconMap } = useNodeRegistry();
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
	const selectedNodes = useAppSelector(selectSelectedNodes);
	const { configMap } = useNodeRegistry();
	const NodesWithConfigForm = Object.keys(configMap);

	const isVisible = useMemo(() => {
		return (
			selectedNodes &&
			selectedNodes.length > 0 &&
			selectedNodes.some((n) => NodesWithConfigForm.includes(n.type))
		);
	}, [selectedNodes, NodesWithConfigForm]);

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
						selectedNodes?.map((node) => (
							<Fragment key={`${node.id}_cfg_section`}>
								<NodeConfigItem node={node} />
							</Fragment>
						))}
				</div>
			</div>
		</Panel>
	);
});

export { NodeConfigPanel };
