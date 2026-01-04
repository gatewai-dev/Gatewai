import type { DataType } from "@gatewai/db";
import { memo, useMemo } from "react";
import type { NodeTemplateListRPC } from "@/rpc/types";
import { NodeItem } from "./node-item";
import { useNodePalette } from "./node-palette.ctx";

interface NodeListProps {
	templates: NodeTemplateListRPC;
}

const getLevenshteinDistance = (a: string, b: string): number => {
	const matrix = Array.from({ length: a.length + 1 }, () =>
		new Array(b.length + 1).fill(0),
	);

	for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
	for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1, // deletion
				matrix[i][j - 1] + 1, // insertion
				matrix[i - 1][j - 1] + cost, // substitution
			);
		}
	}
	return matrix[a.length][b.length];
};

const NodeTemplateList = memo(({ templates }: NodeListProps) => {
	const { searchQuery, fromTypes, toTypes } = useNodePalette();

	// Memoize the filtering/sorting logic to prevent heavy recalculations on render
	const filtered = useMemo(() => {
		let result = templates;

		// 1. Connection Type Filtering
		if (fromTypes.length > 0) {
			result = result.filter((t) =>
				t.templateHandles.some(
					(inp) =>
						fromTypes.some((ft) => inp.dataTypes.includes(ft as DataType)) &&
						inp.type === "Input",
				),
			);
		}

		if (toTypes.length > 0) {
			result = result.filter((t) =>
				t.templateHandles.some(
					(out) =>
						toTypes.some((ft) => out.dataTypes.includes(ft as DataType)) &&
						out.type === "Output",
				),
			);
		}

		// 2. Fuzzy Search & Sorting
		if (searchQuery) {
			const q = searchQuery.toLowerCase();

			// Map items to a temporary structure with a relevance score
			const scored = result.map((t) => {
				const name = t.displayName.toLowerCase();
				const desc = t.description?.toLowerCase() || "";

				// Calculate distance against the Display Name
				const distance = getLevenshteinDistance(q, name);

				let score = distance;

				// HEURISTICS:
				// 1. Exact substring matches get a huge boost (-100 score)
				//    This ensures "graph" finds "Graph Node" before "giraffe"
				if (name.includes(q)) score -= 100;
				else if (desc.includes(q)) score -= 50;

				// 2. "Starts with" gets a small boost
				if (name.startsWith(q)) score -= 20;

				return { template: t, score, distance };
			});

			// Filter out irrelevant results
			// We keep items if:
			// a) The score is very low (boosted by substring match)
			// b) The raw Levenshtein distance is small (allow simple typos, max 3 edits)
			const filteredScored = scored.filter(
				(item) => item.score < 0 || item.distance <= 3,
			);

			// Sort by score (ascending)
			filteredScored.sort((a, b) => a.score - b.score);

			// Unwrap back to templates
			result = filteredScored.map((item) => item.template);
		}

		return result;
	}, [templates, searchQuery, fromTypes, toTypes]);

	// Grouping Logic
	// We use useMemo here as well so we don't regroup on every render if data hasn't changed
	const groups = useMemo(() => {
		const g: Record<string, Record<string, NodeTemplateListRPC>> = {};

		// Helper to add to group
		const addToGroup = (cat: string, sub: string, item: any) => {
			if (!g[cat]) g[cat] = {};
			if (!g[cat][sub]) g[cat][sub] = [];
			g[cat][sub].push(item);
		};

		if (searchQuery) {
			// When searching, flatten into a single "Search Results" group
			filtered.forEach((t) => {
				addToGroup("Search Results", "", t);
			});
		} else {
			// 1. Normal Categories
			filtered.forEach((t) => {
				const cat = t.category || "Other";
				const sub = t.subcategory || "";
				addToGroup(cat, sub, t);
			});

			// 2. Quick Access
			filtered.forEach((t) => {
				if (t.showInQuickAccess) {
					addToGroup("Quick Access", "", t);
				}
			});
		}

		return g;
	}, [filtered, searchQuery]);

	const catKeys = Object.keys(groups).sort((a, b) => {
		if (a === "Quick Access") return -1;
		if (b === "Quick Access") return 1;
		return a.localeCompare(b);
	});

	if (filtered.length === 0) {
		return (
			<div className="text-sm text-muted-foreground p-4 text-center">
				No nodes found.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 w-50">
			{catKeys.map((cat) => (
				<div key={cat} data-category={cat}>
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
