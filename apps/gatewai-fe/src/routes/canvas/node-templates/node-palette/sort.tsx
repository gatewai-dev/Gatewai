// src/node-palette/SortSelect.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNodePalette } from './node-palette.ctx';

export function SortSelect() {
  const { sortBy, setSortBy } = useNodePalette();

  return (
    <Select value={sortBy} onValueChange={setSortBy}>
      <SelectTrigger>
        <SelectValue placeholder="Order by" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="featured">Featured</SelectItem>
        <SelectItem value="price_asc">Price: low to high</SelectItem>
        <SelectItem value="price_desc">Price: high to low</SelectItem>
      </SelectContent>
    </Select>
  );
}