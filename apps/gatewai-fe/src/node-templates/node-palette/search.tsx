// src/node-palette/SearchInput.tsx
import { Input } from '@/components/ui/input';
import { useNodePalette } from './node-palette.ctx';

export function SearchInput() {
  const { searchQuery, setSearchQuery } = useNodePalette();

  return (
    <Input
      placeholder="Search"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  );
}