import type { DataType } from "@gatewai/db";
import { memo, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
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
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost,
			);
		}
	}
	return matrix[a.length][b.length];
};

const NodeTemplateList = memo(({ templates }: NodeListProps) => {
	const { searchQuery, fromTypes, toTypes } = useNodePalette();

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

		// 2. Fuzzy Search
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			const scored = result.map((t) => {
				const name = t.displayName.toLowerCase();
				const desc = t.description?.toLowerCase() || "";
				const distance = getLevenshteinDistance(q, name);
				let score = distance;

				if (name.includes(q)) score -= 100;
				else if (desc.includes(q)) score -= 50;
				if (name.startsWith(q)) score -= 20;

				return { template: t, score, distance };
			});

			const filteredScored = scored.filter(
				(item) => item.score < 0 || item.distance <= 3,
			);
			filteredScored.sort((a, b) => a.score - b.score);
			result = filteredScored.map((item) => item.template);
		}

		return result;
	}, [templates, searchQuery, fromTypes, toTypes]);

	const groups = useMemo(() => {
		const g: Record<string, Record<string, NodeTemplateListRPC>> = {};

		const addToGroup = (
			cat: string,
			sub: string,
			item: NodeTemplateListRPC[number],
		) => {
			if (!g[cat]) g[cat] = {};
			if (!g[cat][sub]) g[cat][sub] = [];
			g[cat][sub].push(item);
		};

		if (searchQuery) {
			filtered.forEach((t) => {
				addToGroup("Search Results", "", t);
			});
		} else {
			filtered.forEach((t) => {
				const cat = t.category || "General";
				const sub = t.subcategory || "";
				addToGroup(cat, sub, t);
			});
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
		if (a === "Search Results") return -1;
		return a.localeCompare(b);
	});

	if (filtered.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center pt-12 text-center">
				<div className="rounded-full bg-muted p-4">
					<span className="text-2xl">🔍</span>
				</div>
				<p className="mt-3 text-sm font-medium text-foreground">
					No nodes found
				</p>
				<p className="text-xs text-muted-foreground">
					Try adjusting your search
				</p>
			</div>
		);
	}

	return (
		<ScrollArea viewPortCn="h-[calc(100%-1rem)]" className="h-full!">
			{catKeys.map((cat) => (
				<div key={cat} className="flex flex-col gap-2">
					{/* Category Header */}
					<h2
						className={cn(
							"sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md",
							"border-b border-border/40 px-5",
						)}
					>
						{cat}
					</h2>

					<div className="flex flex-col gap-4 pl-1">
						{Object.entries(groups[cat])
							.sort(([subA], [subB]) => subA.localeCompare(subB))
							.map(([sub, temps]) => (
								<div key={sub} className="flex flex-col gap-1">
									{sub && (
										<h3 className="mb-1 px-2 text-[10px] font-medium text-primary/70">
											{sub}
										</h3>
									)}
									<div className="flex flex-col gap-1">
										{temps.map((t) => (
											<NodeItem
												id_suffix={`${t.id}_${sub}_${cat}`}
												key={`${t.id}_${sub}_${cat}`}
												template={t}
											/>
										))}
									</div>
								</div>
							))}
					</div>
				</div>
			))}
		</ScrollArea>
	);
});

export { NodeTemplateList };
