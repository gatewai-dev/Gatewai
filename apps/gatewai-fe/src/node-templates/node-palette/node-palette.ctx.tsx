// src/node-palette/NodePaletteContext.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

interface NodePaletteContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  fromTypes: string[];
  setFromTypes: (types: string[]) => void;
  toTypes: string[];
  setToTypes: (types: string[]) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
}

const NodePaletteContext = createContext<NodePaletteContextType | undefined>(undefined);

export function NodePaletteProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [fromTypes, setFromTypes] = useState<string[]>([]);
  const [toTypes, setToTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('featured');

  return (
    <NodePaletteContext.Provider
      value={{ searchQuery, setSearchQuery, fromTypes, setFromTypes, toTypes, setToTypes, sortBy, setSortBy }}
    >
      {children}
    </NodePaletteContext.Provider>
  );
}

export function useNodePalette() {
  const context = useContext(NodePaletteContext);
  if (!context) {
    throw new Error('useNodePalette must be used within a NodePaletteProvider');
  }
  return context;
}