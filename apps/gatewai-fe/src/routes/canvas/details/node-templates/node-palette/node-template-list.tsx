import type { DataType } from "@gatewai/db";
import { memo } from "react";
import type { NodeTemplateListRPC } from "@/rpc/types";
import { NodeItem } from "./node-item";
import { useNodePalette } from "./node-palette.ctx";

interface NodeListProps {
	templates: NodeTemplateListRPC;
}

const NodeTemplateList = memo(({ templates }: NodeListProps) => {
	const { searchQuery, fromTypes, toTypes, categoryRefs } = useNodePalette();

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

	// First — normal categories
	filtered.forEach((t) => {
		const cat = t.category || "Other";
		const sub = t.subcategory || "";

		if (!groups[cat]) groups[cat] = {};
		if (!groups[cat][sub]) groups[cat][sub] = [];

		groups[cat][sub].push(t);
	});

	// Then — Quick Access (add copies of qualifying items)
	filtered.forEach((t) => {
		if (t.showInQuickAccess) {
			const quickCat = "Quick Access";
			const sub = ""; // usually no subcategory in quick access

			if (!groups[quickCat]) groups[quickCat] = {};
			if (!groups[quickCat][sub]) groups[quickCat][sub] = [];

			groups[quickCat][sub].push(t);
		}
	});

	// Sort category keys
	const catKeys = Object.keys(groups).sort((a, b) => {
		if (a === "Quick Access") return -1;
		if (b === "Quick Access") return 1;
		return a.localeCompare(b);
	});

	return (
		<div className="flex flex-col gap-3 w-50">
			{catKeys.map((cat) => (
				<div
					key={cat}
					// ATTACH REF HERE
					ref={categoryRefs.current[cat]}
					// ATTACH DATA ATTRIBUTE FOR OBSERVER
					data-category={cat}
				>
					<h2 className="font-bold mb-4">{cat}</h2>
					{Object.entries(groups[cat])
						.sort(([subA], [subB]) => subA.localeCompare(subB))
						.map(([sub, temps]) => (
							<div key={sub} className="mb-4">
								{sub && (
									<h3 className="text-xs font-light text-muted-foreground mb-2">
										{sub}
									</h3>
								)}
								<div className="grid grid-cols-2 gap-2">
									{temps.map((t) => (
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
