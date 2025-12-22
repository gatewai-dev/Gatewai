// src/node-palette/NodeList.tsx
import type { NodeTemplate } from '@gatewai/types';
import { NodeItem } from './node-item';
import { useNodePalette } from './node-palette.ctx';

interface NodeListProps {
  templates: NodeTemplate[];
}

function sortTemplates(templates: NodeTemplate[], sortBy: string): NodeTemplate[] {
  const sorted = [...templates];
  if (sortBy === 'price_asc') {
    sorted.sort((a, b) => (a.tokenPrice || 0) - (b.tokenPrice || 0));
  } else if (sortBy === 'price_desc') {
    sorted.sort((a, b) => (b.tokenPrice || 0) - (a.tokenPrice || 0));
  } else {
    // Default to alphabetical by displayName
    sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return sorted;
}

export function NodeTemplateList({ templates }: NodeListProps) {
  const { searchQuery, selectedFilter, sortBy } = useNodePalette();

  let filtered = templates;

  if (selectedFilter !== 'All') {
    filtered = filtered.filter((t) => t.category === selectedFilter);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.displayName.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }

  // Grouping: Quick Access if showInQuickAccess, else by category/subcategory
  const groups: Record<string, Record<string, NodeTemplate[]>> = {};
  filtered.forEach((t) => {
    let cat = t.category || 'Other';
    if (t.showInQuickAccess) {
      cat = 'Quick Access';
    }
    const sub = t.subcategory || '';
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
  if (sortBy === 'featured') {
    catKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Quick Access') return -1;
      if (b === 'Quick Access') return 1;
      return a.localeCompare(b);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {catKeys.map((cat) => (
        <div key={cat}>
          <h2 className="text-xl font-bold mb-4">{cat}</h2>
          {Object.entries(groups[cat])
            .sort(([subA], [subB]) => subA.localeCompare(subB))
            .map(([sub, temps]) => (
              <div key={sub} className="mb-4">
                {sub && <h3 className="text-lg font-semibold mb-2">{sub}</h3>}
                <div className="grid grid-cols-2 gap-4">
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
}