import { EventEmitter } from 'events';
import type { NodeResult, FileData } from '@gatewai/types';
import type { EdgeEntityType } from '@/store/edges';
import type { NodeEntityType } from '@/store/nodes';
import { db, hashConfigSync, hashNodeResult } from '../media-db';
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
  private processingQueue: string[] = [];
  private isProcessing = false;

  constructor() {
    super();
    this.registerBuiltInProcessors();
  }

  /**
   * Update graph structure from Redux store
   */
  updateGraph(config: ProcessorConfig): void {
    const prevNodes = new Map(this.nodes);
    this.nodes = config.nodes;
    this.edges = config.edges;
    
    // Rebuild dependency graph
    this.buildDependencyGraph();
    
    // Find changed nodes and mark as dirty
    config.nodes.forEach((node, id) => {
      const prev = prevNodes.get(id);
      const state = this.getOrCreateNodeState(id);
      
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
      const cached = await db.clientNodeResults.where({ id: node.id, inputHash: cacheKey }).first();
      
      if (cached) {
        await db.clientNodeResults.update(cached.id, { age: Date.now() });
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
      await db.clientNodeResults.add({
        id: node.id,
        inputHash: cacheKey,
        result: newResult,
        name: node.name,
        hash: await hashNodeResult(newResult),
        age: Date.now()
      });

      return newResult;
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
      const cached = await db.clientNodeResults.where({ id: node.id, inputHash: cacheKey }).first();
      
      if (cached) {
        await db.clientNodeResults.update(cached.id, { age: Date.now() });
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
      await db.clientNodeResults.add({
        id: node.id,
        inputHash: cacheKey,
        result: newResult,
        name: node.name,
        hash: await hashNodeResult(newResult),
        age: Date.now()
      });

      return newResult;
    });
  }

  private getOrCreateNodeState(nodeId: string): NodeState {
    if (!this.nodeStates.has(nodeId)) {
      this.nodeStates.set(nodeId, {
        isDirty: true,
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

  private buildDependencyGraph(): void {
    this.dependencyGraph.clear();
    
    this.edges.forEach(edge => {
      if (!this.dependencyGraph.has(edge.source)) {
        this.dependencyGraph.set(edge.source, new Set());
      }
      this.dependencyGraph.get(edge.source)!.add(edge.target);
    });
  }

  private markDirty(nodeId: string, cascade: boolean): void {
    const state = this.getOrCreateNodeState(nodeId);
    
    // Cancel if already processing
    if (state.isProcessing && state.abortController) {
      state.abortController.abort();
      state.isProcessing = false;
    }
    
    state.isDirty = true;
    
    // Add to queue if not already there
    if (!this.processingQueue.includes(nodeId)) {
      this.processingQueue.push(nodeId);
    }
    
    // Cascade to downstream nodes
    if (cascade) {
      const downstream = this.dependencyGraph.get(nodeId) ?? new Set();
      downstream.forEach(downstreamId => this.markDirty(downstreamId, true));
    }
    
    // Trigger processing
    this.startProcessing();
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const nodeId = this.processingQueue.shift()!;
      const node = this.nodes.get(nodeId);
      
      if (!node) continue;
      
      const state = this.getOrCreateNodeState(nodeId);
      if (!state.isDirty) continue;

      try {
        // Ensure all inputs are ready
        const inputsReady = await this.ensureInputsReady(nodeId);
        if (!inputsReady) {
          // Re-queue for later
          this.processingQueue.push(nodeId);
          continue;
        }

        // Process the node
        state.isProcessing = true;
        state.abortController = new AbortController();
        state.error = null;

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
        state.isProcessing = false;
        
        this.emit('node:processed', { nodeId, result });
        
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // Cancelled - will be re-queued if needed
          state.isDirty = true;
        } else {
          state.error = error instanceof Error ? error.message : 'Unknown error';
          state.isDirty = false;
        }
        state.isProcessing = false;
        
        this.emit('node:error', { nodeId, error: state.error });
      } finally {
        state.abortController = null;
      }
    }

    this.isProcessing = false;
  }

  private async ensureInputsReady(nodeId: string): Promise<boolean> {
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
    this.processingQueue = [];
    this.removeAllListeners();
  }
}