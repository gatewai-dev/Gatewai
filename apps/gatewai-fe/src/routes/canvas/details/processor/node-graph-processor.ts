import { EventEmitter } from 'events';
import type { NodeResult, FileData } from '@gatewai/types';
import type { EdgeEntityType } from '@/store/edges';
import type { NodeEntityType } from '@/store/nodes';
import { hashConfigSync, hashNodeResult, getCachedNodeResult, updateCachedNodeResultAge, storeClientNodeResult } from '../media-db';
import { pixiProcessor } from './pixi-service';

interface ProcessorConfig {
  nodes: Map<string, NodeEntityType>;
  edges: EdgeEntityType[];
}

interface NodeState {
  isDirty: boolean;
  isProcessing: boolean;
  result: NodeResult | null;
  error: string | null;
  abortController: AbortController | null;
}

type NodeProcessor = (params: {
  node: NodeEntityType;
  inputs: Map<string, NodeResult>;
  signal: AbortSignal;
}) => Promise<NodeResult>;

/**
 * Centralized graph processor - handles all node computation outside React lifecycle
 */
export class NodeGraphProcessor extends EventEmitter {
  private nodes = new Map<string, NodeEntityType>();
  private edges: EdgeEntityType[] = [];
  private nodeStates = new Map<string, NodeState>();
  private processors = new Map<string, NodeProcessor>();
  private dependencyGraph = new Map<string, Set<string>>(); // nodeId -> downstream nodeIds
  private reverseDependencyGraph = new Map<string, Set<string>>(); // nodeId -> upstream nodeIds
  private isProcessing = false;

  constructor() {
    super();
    this.registerBuiltInProcessors();
  }

  /**
   * Update graph structure from Redux store
   */
  updateGraph(config: ProcessorConfig): void {
    console.log('updateGraph called - checking for changes');
    const prevNodes = new Map(this.nodes);
    this.nodes = config.nodes;
    this.edges = config.edges;
    
    // Rebuild dependency graphs
    this.buildDependencyGraphs();
    
    // Find changed nodes and mark as dirty
    config.nodes.forEach((node, id) => {
      const prev = prevNodes.get(id);
      this.getOrCreateNodeState(id);
      
      if (!prev || this.hasNodeChanged(prev, node)) {
        this.markDirty(id, true);
      }
    });
  }

  /**
   * Get current result for a node
   */
  getNodeResult(nodeId: string): NodeResult | null {
    return this.nodeStates.get(nodeId)?.result ?? null;
  }

  /**
   * Get processing state for a node
   */
  getNodeState(nodeId: string): NodeState | null {
    return this.nodeStates.get(nodeId) ?? null;
  }

  /**
   * Manually trigger processing for a node
   */
  async processNode(nodeId: string): Promise<void> {
    this.markDirty(nodeId, true);
    await this.startProcessing();
  }

  /**
   * Register a custom processor for a node type
   */
  registerProcessor(nodeType: string, processor: NodeProcessor): void {
    this.processors.set(nodeType, processor);
  }

  // ==================== PRIVATE METHODS ====================

  private registerBuiltInProcessors(): void {
    // Blur processor
    this.registerProcessor('Blur', async ({ node, inputs, signal }) => {
      const inputHandle = this.getInputHandles(node.id)[0];
      if (!inputHandle) throw new Error('No input handle');

      const sourceNodeId = this.getSourceNodeId(node.id, inputHandle);
      if (!sourceNodeId) throw new Error('No connected source');

      const inputResult = inputs.get(sourceNodeId);
      if (!inputResult) throw new Error('No input result');

      // Extract image URL
      const output = inputResult.outputs[inputResult.selectedOutputIndex ?? 0];
      const fileData = output?.items[0]?.data as FileData;
      const imageUrl = fileData?.entity?.signedUrl ?? fileData?.dataUrl;
      
      if (!imageUrl) throw new Error('No image URL');

      // Check cache
      const cacheKey = await this.computeCacheKey(node, inputs);
      const cached = await getCachedNodeResult(node.id, cacheKey);
      
      if (cached) {
        await updateCachedNodeResultAge(cached);
        return cached.result;
      }

      // Process with Pixi
      const config = node.config as { size?: number };
      const dataUrl = await pixiProcessor.processBlur(
        imageUrl,
        { blurSize: config.size ?? 1 },
        signal
      );

      // Build result
      const outputHandle = this.getOutputHandles(node.id)[0];
      const newResult: NodeResult = {
        selectedOutputIndex: 0,
        outputs: [{
          items: [{
            type: 'Image',
            data: { dataUrl },
            outputHandleId: outputHandle
          }]
        }]
      };

      // Cache it
      await storeClientNodeResult(node, newResult, cacheKey);

      return newResult;
    });

    // File processor (no computation, just return existing; cache based on config if needed)
    this.registerProcessor('File', async ({ node }) => {
      // For File nodes, compute cacheKey based on config (file info), no inputs
      const cacheKey = hashConfigSync(node.config ?? {});
      const cached = await getCachedNodeResult(node.id, cacheKey);
      
      if (cached) {
        await updateCachedNodeResultAge(cached);
        return cached.result;
      }

      // If no cached, use existing node.result (assuming it's set)
      const result = node.result as unknown as NodeResult;
      if (!result) throw new Error('No result for File node');

      // Cache it
      await storeClientNodeResult(node, result, cacheKey);

      return result;
    });

    // Resize processor
    this.registerProcessor('Resize', async ({ node, inputs, signal }) => {
      const inputHandle = this.getInputHandles(node.id)[0];
      if (!inputHandle) throw new Error('No input handle');

      const sourceNodeId = this.getSourceNodeId(node.id, inputHandle);
      if (!sourceNodeId) throw new Error('No connected source');

      const inputResult = inputs.get(sourceNodeId);
      if (!inputResult) throw new Error('No input result');

      // Extract image URL
      const output = inputResult.outputs[inputResult.selectedOutputIndex ?? 0];
      const fileData = output?.items[0]?.data as FileData;
      const imageUrl = fileData?.entity?.signedUrl ?? fileData?.dataUrl;
      
      if (!imageUrl) throw new Error('No image URL');

      // Check cache
      const cacheKey = await this.computeCacheKey(node, inputs);
      const cached = await getCachedNodeResult(node.id, cacheKey);
      
      if (cached) {
        await updateCachedNodeResultAge(cached);
        return cached.result;
      }

      // Process with Pixi
      const config = node.config as { width?: number; height?: number };
      const dataUrl = await pixiProcessor.processResize(
        imageUrl,
        { width: config.width ?? 512, height: config.height ?? 512 },
        signal
      );

      // Build result
      const outputHandle = this.getOutputHandles(node.id)[0];
      const newResult: NodeResult = {
        selectedOutputIndex: 0,
        outputs: [{
          items: [{
            type: 'Image',
            data: { dataUrl },
            outputHandleId: outputHandle
          }]
        }]
      };

      // Cache it
      await storeClientNodeResult(node, newResult, cacheKey);

      return newResult;
    });
  }

  private getOrCreateNodeState(nodeId: string): NodeState {
    if (!this.nodeStates.has(nodeId)) {
      this.nodeStates.set(nodeId, {
        isDirty: false,
        isProcessing: false,
        result: null,
        error: null,
        abortController: null
      });
    }
    return this.nodeStates.get(nodeId)!;
  }

  private hasNodeChanged(prev: NodeEntityType, curr: NodeEntityType): boolean {
    return JSON.stringify(prev.config) !== JSON.stringify(curr.config);
  }

  private buildDependencyGraphs(): void {
    this.dependencyGraph.clear();
    this.reverseDependencyGraph.clear();
    
    this.nodes.forEach((_, id) => {
      this.dependencyGraph.set(id, new Set());
      this.reverseDependencyGraph.set(id, new Set());
    });
    
    this.edges.forEach(edge => {
      if (this.nodes.has(edge.source) && this.nodes.has(edge.target)) {
        this.dependencyGraph.get(edge.source)!.add(edge.target);
        this.reverseDependencyGraph.get(edge.target)!.add(edge.source);
      }
    });
  }

  private buildSubgraphDepGraphs(necessaryIds: string[]): {
    depGraph: Map<string, string[]>;
    revDepGraph: Map<string, string[]>;
  } {
    const selectedSet = new Set(necessaryIds);
    const depGraph = new Map(necessaryIds.map(id => [id, new Set<string>()]));
    const revDepGraph = new Map(necessaryIds.map(id => [id, new Set<string>()]));

    for (const edge of this.edges) {
      if (selectedSet.has(edge.source) && selectedSet.has(edge.target)) {
        depGraph.get(edge.source)!.add(edge.target);
        revDepGraph.get(edge.target)!.add(edge.source);
      }
    }

    // Convert Sets to arrays for topological sort
    const depArray = new Map<string, string[]>();
    const revArray = new Map<string, string[]>();
    depGraph.forEach((value, key) => depArray.set(key, Array.from(value)));
    revDepGraph.forEach((value, key) => revArray.set(key, Array.from(value)));

    return { depGraph: depArray, revDepGraph: revArray };
  }

  private topologicalSort(
    nodes: string[],
    depGraph: Map<string, string[]>,
    revDepGraph: Map<string, string[]>
  ): string[] | null {
    const indegree = new Map(nodes.map(id => [id, (revDepGraph.get(id) ?? []).length]));
    const queue: string[] = nodes.filter(id => indegree.get(id)! === 0);
    const order: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      order.push(current);

      const downstream = depGraph.get(current) ?? [];
      for (const ds of downstream) {
        const deg = indegree.get(ds)! - 1;
        indegree.set(ds, deg);
        if (deg === 0) {
          queue.push(ds);
        }
      }
    }

    return order.length === nodes.length ? order : null;
  }

  private markDirty(nodeId: string, cascade: boolean): void {
    console.log(`Dirty marked for ${nodeId}, triggering startProcessing`);
    const state = this.getOrCreateNodeState(nodeId);
    
    // Cancel if already processing
    if (state.isProcessing && state.abortController) {
      state.abortController.abort();
      state.isProcessing = false;
    }
    
    state.isDirty = true;
    
    // Cascade to downstream nodes
    if (cascade) {
      const downstream = Array.from(this.dependencyGraph.get(nodeId) ?? new Set());
      downstream.forEach(downstreamId => this.markDirty(downstreamId, true));
    }
    
    // Trigger processing
    this.startProcessing();
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Collect dirty node IDs
      const dirtyIds = Array.from(this.nodeStates.entries())
        .filter(([, state]) => state.isDirty)
        .map(([id]) => id);

      if (dirtyIds.length === 0) return;

      // Compute necessary nodes: dirty + upstream dependencies that need processing
      const necessary = new Set<string>();
      const queue: string[] = [...dirtyIds];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (necessary.has(curr)) continue;
        necessary.add(curr);
        const ups = Array.from(this.reverseDependencyGraph.get(curr) ?? []);
        ups.forEach(up => {
          const upState = this.getOrCreateNodeState(up);
          if (!upState.result || upState.isDirty) {
            queue.push(up);
          }
        });
      }

      const necessaryIds = Array.from(necessary);

      // Mark upstream nodes as dirty if they lack results
      necessaryIds.forEach(id => {
        const state = this.getOrCreateNodeState(id);
        if (!state.result) {
          state.isDirty = true;
        }
      });

      // Build subgraph dependency graphs
      const { depGraph, revDepGraph } = this.buildSubgraphDepGraphs(necessaryIds);

      // Topological sort
      const topoOrder = this.topologicalSort(necessaryIds, depGraph, revDepGraph);
      if (!topoOrder) {
        this.emit('graph:error', { message: 'Cycle detected in dependency graph' });
        return;
      }

      // Process nodes in topological order
      for (const nodeId of topoOrder) {
        const state = this.getOrCreateNodeState(nodeId);
        if (!state.isDirty) continue;

        // Inputs should be ready due to topo order, but verify
        if (!this.ensureInputsReady(nodeId)) {
          console.warn(`Inputs not ready for ${nodeId} despite topological order`);
          continue;
        }
        // Skip if already processing
        console.log({state})
        if (state.isProcessing) continue;

        state.isProcessing = true;
        state.abortController = new AbortController();
        state.error = null;

        try {
          const node = this.nodes.get(nodeId);
          if (!node) throw new Error(`Node ${nodeId} missing`);

          const processor = this.processors.get(node.type);
          if (!processor) {
            throw new Error(`No processor for node type: ${node.type}`);
          }

          const inputs = this.collectInputs(nodeId);
          const result = await processor({
            node,
            inputs,
            signal: state.abortController.signal
          });

          state.result = result;
          state.isDirty = false;
          console.log('node:processed', { nodeId, result })
          this.emit('node:processed', { nodeId, result });
          
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            // Cancelled - will be re-queued if needed via future markDirty
            state.isDirty = true;
          } else {
            state.error = error instanceof Error ? error.message : 'Unknown error';
            state.isDirty = false;
          }
          
          this.emit('node:error', { nodeId, error: state.error });
        } finally {
          state.isProcessing = false;
          state.abortController = null;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private ensureInputsReady(nodeId: string): boolean {
    const sourceNodeIds = this.getSourceNodeIds(nodeId);
    
    for (const sourceId of sourceNodeIds) {
      const sourceState = this.nodeStates.get(sourceId);
      if (!sourceState?.result || sourceState.isDirty || sourceState.isProcessing) {
        return false;
      }
    }
    
    return true;
  }

  private collectInputs(nodeId: string): Map<string, NodeResult> {
    const inputs = new Map<string, NodeResult>();
    const sourceNodeIds = this.getSourceNodeIds(nodeId);
    
    sourceNodeIds.forEach(sourceId => {
      const state = this.nodeStates.get(sourceId);
      if (state?.result) {
        inputs.set(sourceId, state.result);
      }
    });
    
    return inputs;
  }

  private getSourceNodeIds(nodeId: string): string[] {
    return this.edges
      .filter(e => e.target === nodeId)
      .map(e => e.source);
  }

  private getSourceNodeId(nodeId: string, handleId: string): string | null {
    const edge = this.edges.find(e => e.target === nodeId && e.targetHandleId === handleId);
    return edge?.source ?? null;
  }

  private getInputHandles(nodeId: string): string[] {
    return Array.from(new Set(
      this.edges
        .filter(e => e.target === nodeId)
        .map(e => e.targetHandleId)
    ));
  }

  private getOutputHandles(nodeId: string): string[] {
    return Array.from(new Set(
      this.edges
        .filter(e => e.source === nodeId)
        .map(e => e.sourceHandleId)
    ));
  }

  private async computeCacheKey(node: NodeEntityType, inputs: Map<string, NodeResult>): Promise<string> {
    const sortedInputKeys = Array.from(inputs.keys()).sort((a, b) => a.localeCompare(b));
    const inputHashes = await Promise.all(
      sortedInputKeys.map(async (key) => `${key}:${await hashNodeResult(inputs.get(key)!)}`)
    );
    const inputsHash = inputHashes.join(',');
    const configHash = hashConfigSync(node.config ?? {});
    const inputStr = inputsHash + configHash;
    
    const encoder = new TextEncoder();
    const hashData = encoder.encode(inputStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.nodeStates.forEach(state => {
      if (state.abortController) {
        state.abortController.abort();
      }
    });
    this.nodeStates.clear();
    this.removeAllListeners();
  }
}