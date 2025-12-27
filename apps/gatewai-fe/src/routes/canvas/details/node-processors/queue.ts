import type { NodeResult } from "@gatewai/types";
import type { EdgeEntityType } from "@/store/edges";

interface QueueItem {
  nodeId: string;
  task: (signal: AbortSignal) => Promise<{ success: boolean; error?: string; newResult?: NodeResult }>;
  resolve: (value: { success: boolean; error?: string; newResult?: NodeResult }) => void;
  reject: (reason?: any) => void;
  abortController: AbortController;
}

class ProcessingQueue {
  private queue: QueueItem[] = [];
  private activeProcessing: Map<string, AbortController> = new Map();
  private isProcessing = false;

  /**
   * Adds a new task to the queue. Automatically cancels any existing
   * processing for the same node and all downstream dependencies.
   */
  public add(
    nodeId: string,
    edges: EdgeEntityType[],
    task: (signal: AbortSignal) => Promise<{ success: boolean; error?: string; newResult?: NodeResult }>
  ): Promise<{ success: boolean; error?: string; newResult?: NodeResult }> {
    // Cancel this node and all downstream nodes
    this.cancelNodeChain(nodeId, edges);

    // Create new abort controller for this task
    const abortController = new AbortController();

    return new Promise((resolve, reject) => {
      this.queue.push({ nodeId, task, resolve, reject, abortController });
      this.process();
    });
  }

  /**
   * Cancels a specific node's processing
   */
  public cancelNode(nodeId: string): void {
    // Cancel active processing
    const controller = this.activeProcessing.get(nodeId);
    if (controller) {
      controller.abort();
      this.activeProcessing.delete(nodeId);
    }

    // Remove from queue
    this.queue = this.queue.filter(item => {
      if (item.nodeId === nodeId) {
        item.abortController.abort();
        item.reject(new Error(`Processing cancelled for node ${nodeId}`));
        return false;
      }
      return true;
    });
  }

  /**
   * Cancels a node and all its downstream dependencies
   */
  private cancelNodeChain(nodeId: string, edges: EdgeEntityType[]): void {
    const nodesToCancel = new Set<string>([nodeId]);
    const downstream = this.findDownstreamNodes(nodeId, edges);
    downstream.forEach(id => nodesToCancel.add(id));

    nodesToCancel.forEach(id => this.cancelNode(id));
  }

  /**
   * Finds all downstream nodes (recursively) from a given node
   */
  private findDownstreamNodes(nodeId: string, edges: EdgeEntityType[]): Set<string> {
    const downstream = new Set<string>();
    const visited = new Set<string>();
    
    const traverse = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);

      // Find all edges where source is current node
      const outgoingEdges = edges.filter(edge => edge.source === currentNodeId);
      
      outgoingEdges.forEach(edge => {
        if (edge.target && !visited.has(edge.target)) {
          downstream.add(edge.target);
          traverse(edge.target);
        }
      });
    };

    traverse(nodeId);
    return downstream;
  }

  /**
   * Processes the queue sequentially
   */
  private async process(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      const { nodeId, task, resolve, reject, abortController } = item;

      // Mark as active
      this.activeProcessing.set(nodeId, abortController);

      try {
        // Check if already cancelled before starting
        if (abortController.signal.aborted) {
          reject(new Error(`Processing cancelled for node ${nodeId}`));
          continue;
        }

        const result = await task(abortController.signal);
        
        // Check if cancelled during execution
        if (abortController.signal.aborted) {
          reject(new Error(`Processing cancelled for node ${nodeId}`));
        } else {
          resolve(result);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          reject(new Error(`Processing cancelled for node ${nodeId}`));
        } else {
          reject(error);
        }
      } finally {
        this.activeProcessing.delete(nodeId);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Clears all processing (useful for cleanup)
   */
  public clearAll(): void {
    // Cancel all active processing
    this.activeProcessing.forEach(controller => controller.abort());
    this.activeProcessing.clear();

    // Clear queue
    this.queue.forEach(item => {
      item.abortController.abort();
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

const processingQueue = new ProcessingQueue();

export { processingQueue };