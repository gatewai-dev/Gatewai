import type { DataType } from "@gatewai/db";
import { memo } from "react";
import type { NodeTemplateListRPC } from "@/rpc/types";
import { NodeItem } from "./node-item";
import { useNodePalette } from "./node-palette.ctx";

interface NodeListProps {
	templates: NodeTemplateListRPC;
}

function sortTemplates(
	templates: NodeTemplateListRPC,
	sortBy: string,
): NodeTemplateListRPC {
	const sorted = [...templates];
	if (sortBy === "price_asc") {
		sorted.sort((a, b) => (a.tokenPrice || 0) - (b.tokenPrice || 0));
	} else if (sortBy === "price_desc") {
		sorted.sort((a, b) => (b.tokenPrice || 0) - (a.tokenPrice || 0));
	} else {
		// Default to alphabetical by displayName
		sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
	}
	return sorted;
}

const NodeTemplateList = memo(({ templates }: NodeListProps) => {
	const { searchQuery, fromTypes, toTypes, sortBy } = useNodePalette();

	let filtered = templates;

	if (fromTypes.length > 0) {
		filtered = filtered.filter((t) =>
			t.templateHandles.some(
				(inp) =>
					fromTypes.some((ft) => inp.dataTypes.includes(ft as DataType)) &&
					inp.type === "Input",
			),
		);
	}

	if (toTypes.length > 0) {
		filtered = filtered.filter((t) =>
			t.templateHandles.some(
				(out) =>
					toTypes.some((ft) => out.dataTypes.includes(ft as DataType)) &&
					out.type === "Output",
			),
		);
	}

	if (searchQuery) {
		const q = searchQuery.toLowerCase();
		filtered = filtered.filter(
			(t) =>
				t.displayName.toLowerCase().includes(q) ||
				t.description?.toLowerCase().includes(q),
		);
	}

	// Grouping: Quick Access if showInQuickAccess, else by category/subcategory
	const groups: Record<string, Record<string, NodeTemplateListRPC>> = {};
	filtered.forEach((t) => {
		let cat = t.category || "Other";
		if (t.showInQuickAccess) {
			cat = "Quick Access";
		}
		const sub = t.subcategory || "";
		if (!groups[cat]) {
			groups[cat] = {};
		}
		if (!groups[cat][sub]) {
			groups[cat][sub] = [];
		}
		groups[cat][sub].push(t);
	});

	// Sort category keys
	let catKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));
	if (sortBy === "featured") {
		catKeys = Object.keys(groups).sort((a, b) => {
			if (a === "Quick Access") return -1;
			if (b === "Quick Access") return 1;
			return a.localeCompare(b);
		});
	}

	return (
		<div className="flex flex-col gap-3 w-60">
			{catKeys.map((cat) => (
				<div key={cat}>
					<h2 className="font-bold mb-4">{cat}</h2>
					{Object.entries(groups[cat])
						.sort(([subA], [subB]) => subA.localeCompare(subB))
						.map(([sub, temps]) => (
							<div key={sub} className="mb-4">
								{sub && <h3 className="text-lg font-semibold mb-2">{sub}</h3>}
								<div className="grid grid-cols-2 gap-2">
									{sortTemplates(temps, sortBy).map((t) => (
										<NodeItem key={t.id} template={t} />
									))}
								</div>
							</div>
						))}
				</div>
			))}
		</div>
	);
});

export { NodeTemplateList };
