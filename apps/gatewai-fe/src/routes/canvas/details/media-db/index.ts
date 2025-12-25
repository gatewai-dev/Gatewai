import type { NodeEntityType } from '@/store/nodes';
import type { AllNodeConfig, FileData, NodeResult } from '@gatewai/types';
import { Dexie, type EntityTable } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';

export interface ClientNodeResult {
  /**
   * Node ID
   */
  id: string;
  name: string;
  // Result hash
  hash: string;
  // Timestamp for cleanup
  age: number;
  // Store the actual result data
  result: NodeResult;
  // Optional: blob reference if stored separately
  blobId?: string;
  // Input hash for cache invalidation
  inputHash?: string;
}

// Database declaration
export const db = new Dexie('GatewaiClientDB') as Dexie & {
  clientNodeResults: EntityTable<ClientNodeResult, 'id'>;
};

db.version(1).stores({
  clientNodeResults: 'id, hash, age, inputHash, [id+inputHash]',
});

// Creates a deterministic hash for NodeResult objects.
// File data is hashed based on entity ID or dataUrl to ensure consistency.
export async function hashNodeResult(result: NodeResult): Promise<string> {
  const normalized = normalizeResult(result);
  const str = JSON.stringify(normalized);
  
  // Use Web Crypto API for hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Synchronous version using a simple hash algorithm (djb2)
 * Use this if you need immediate hash without async
 */
export function hashNodeResultSync(result: NodeResult): string {
  const normalized = normalizeResult(result);
  const str = JSON.stringify(normalized);
  
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return (hash >>> 0).toString(36); // Convert to base36 for shorter string
}

/**
 * Normalizes the result to ensure consistent hashing:
 * - Sorts object keys
 * - Handles FileData specially (uses entity.id or truncated dataUrl)
 * - Removes undefined values
 */
function normalizeResult(result: NodeResult): any {
  return {
    selectedOutputIndex: result.selectedOutputIndex ?? 0,
    outputs: result.outputs.map(output => ({
      items: output.items.map(item => ({
        type: item.type,
        data: normalizeData(item.data),
        outputHandleId: item.outputHandleId
      }))
    }))
  };
}

/**
 * Normalizes data for consistent hashing
 */
function normalizeData(data: any): any {
  // Handle FileData objects
  if (data && typeof data === 'object' && ('entity' in data || 'dataUrl' in data)) {
    const fileData = data as FileData;
    return {
      entityId: fileData.entity?.id,
      // Only include first 100 chars of dataUrl to avoid huge hashes
      // but enough to differentiate different files
      dataUrlPrefix: fileData.dataUrl?.substring(0, 100)
    };
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(normalizeData);
  }
  
  // Handle objects
  if (data && typeof data === 'object') {
    const normalized: any = {};
    // Sort keys for deterministic ordering
    Object.keys(data).sort().forEach(key => {
      const value = data[key];
      if (value !== undefined) {
        normalized[key] = normalizeData(value);
      }
    });
    return normalized;
  }
  
  // Primitives
  return data;
}

/**
 * Creates a short hash suitable for cache keys (first 12 characters)
 */
export async function hashNodeResultShort(result: NodeResult): Promise<string> {
  const fullHash = await hashNodeResult(result);
  return fullHash.substring(0, 12);
}

/**
 * Synchronous short hash
 */
export function hashNodeResultShortSync(result: NodeResult): string {
  return hashNodeResultSync(result);
}

/**
 * Example usage with IndexedDB cache key
 */
export async function getCacheKey(nodeId: string, result: NodeResult): Promise<string> {
  const hash = await hashNodeResultShort(result);
  return `${nodeId}-${hash}`;
}

/**
 * Builds hash from node entity's result
 */
export async function nodeResultHashBuilder(node: NodeEntityType): Promise<string | null> {
  if (!node.result) {
    return null;
  }
  
  return await hashNodeResult(node.result as NodeResult);
}

/**
 * Synchronous config hash using djb2
 */
export function hashConfigSync(config: AllNodeConfig): string {
  const str = JSON.stringify(config, Object.keys(config).sort());
  
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  
  return (hash >>> 0).toString(36);
}

/**
 * Stores or updates a node result in IndexedDB
 */
export async function storeClientNodeResult(
  node: NodeEntityType,
  result: NodeResult,
  inputHash: string
): Promise<string> {
  const hash = await hashNodeResult(result);
  
  await db.clientNodeResults.put({
    id: node.id,
    name: node.name || 'Unnamed Node',
    hash,
    age: Date.now(),
    result,
    inputHash
  });
  
  return node.id;
}

/**
 * Gets client node result by node ID
 */
export async function getClientNodeResultById(id: NodeEntityType["id"]) {
  return await db.clientNodeResults.where('id').equals(id).first();
}



export function useClientCacheNodeResultById(id: NodeEntityType["id"]) {
  const nodeResult = useLiveQuery(() =>
    db.clientNodeResults.where('id').equals(id).first(),
    [id]
  );
  return nodeResult;
}

export function useClientCacheNodeResults(ids: NodeEntityType["id"][]) {
  const nodeResult = useLiveQuery(() =>
    db.clientNodeResults.where('id').anyOf(ids).toArray(),
    [...ids]
  );
  return nodeResult;
}
/**
 * Gets client node result by hash
 */
export function getClientNodeResultByHash(hash: string) {
  return db.clientNodeResults.where('hash').equals(hash).first();
}

/**
 * Checks if a result with this hash already exists (cache hit)
 */
export async function hasResultCached(result: NodeResult): Promise<boolean> {
  const hash = await hashNodeResult(result);
  const existing = await getClientNodeResultByHash(hash);
  return !!existing;
}

/**
 * Gets or creates a cached result
 */
export async function getOrCreateClientNodeResult(
  node: NodeEntityType,
  result: NodeResult
): Promise<ClientNodeResult> {
  const hash = await hashNodeResult(result);
  
  // Try to get existing
  const existing = await getClientNodeResultByHash(hash);
  if (existing) {
    // Update age
    await db.clientNodeResults.update(existing.id, {
      age: Date.now()
    });
    return existing;
  }
  
  // Create new
  const id = await storeClientNodeResult(node, result, ''); // inputHash not used here
  const created = await db.clientNodeResults.get(id);
  if (!created) {
    throw new Error('Failed to create client node result');
  }
  
  return created;
}

/**
 * Cleanup old results (default: older than 1 hour)
 */
export async function cleanupOldResults(maxAge: number = 3600000): Promise<number> {
  const cutoff = Date.now() - maxAge;
  return await db.clientNodeResults
    .where('age')
    .below(cutoff)
    .delete();
}

/**
 * Cleanup results for a specific node
 */
export async function cleanupNodeResults(nodeId: NodeEntityType["id"]): Promise<number> {
  return await db.clientNodeResults
    .where('id')
    .equals(nodeId)
    .delete();
}

export async function cleanupBulkNodeResults(nodeIds: NodeEntityType["id"][]): Promise<void> {
  return await db.clientNodeResults
    .bulkDelete(nodeIds)
}

/**
 * Get storage usage estimate
 */
export async function getStorageEstimate() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    return await navigator.storage.estimate();
  }
  return null;
}