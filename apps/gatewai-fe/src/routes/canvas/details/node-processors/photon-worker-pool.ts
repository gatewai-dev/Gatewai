// PhotonWorkerPool.ts
import type { WorkerTask, WorkerResponse } from './worker-types';


interface QueueItem {
  task: WorkerTask;
  resolve: (data: Uint8Array) => void;
  reject: (err: Error) => void;
}

export class PhotonWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: QueueItem[] = [];
  private workerStatus: boolean[] = []; // true = busy, false = idle
  private taskMap = new Map<string, QueueItem>();
  private size: number;

  constructor(size: number = navigator.hardwareConcurrency || 4) {
    this.size = size;
    this.initWorkers();
  }

  private initWorkers() {
    for (let i = 0; i < this.size; i++) {
        // Vite worker import syntax
      const worker = new Worker(new URL('./photon-worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(i, e.data);
      };

      // Initialize the worker with the WASM URL
      worker.postMessage({ type: 'INIT' });

      this.workers.push(worker);
      this.workerStatus.push(false); // Initially idle (but waiting for init)
    }
  }

  private handleWorkerMessage(workerIndex: number, response: WorkerResponse) {
    // Handle Init Complete
    if (response.type === 'init_complete') {
        // Worker is technically ready now
        this.workerStatus[workerIndex] = false; 
        this.processQueue(); // Check if any tasks were waiting
        return;
    }

    const { taskId, success, data, error } = response;
    
    // Find the task in our map
    const promiseHandlers = this.taskMap.get(taskId);

    if (promiseHandlers) {
      if (success && data) {
        promiseHandlers.resolve(data);
      } else {
        promiseHandlers.reject(new Error(error || 'Unknown worker error'));
      }
      this.taskMap.delete(taskId);
    }

    // Mark worker as free and check queue
    this.workerStatus[workerIndex] = false;
    this.processQueue();
  }

  private processQueue() {
    // Find first idle worker
    const idleWorkerIndex = this.workerStatus.findIndex((busy) => !busy);

    if (idleWorkerIndex === -1) return; // All busy
    if (this.taskQueue.length === 0) return; // No tasks

    const item = this.taskQueue.shift();
    if (!item) return;

    const { task, resolve, reject } = item;
    
    // Register promise handlers in map
    this.taskMap.set(task.taskId, { task, resolve, reject });

    // Mark busy and send
    this.workerStatus[idleWorkerIndex] = true;
    
    // Transfer the buffer if possible to save copy time
    // We send a copy of the slice usually, unless we use SharedArrayBuffer
    this.workers[idleWorkerIndex].postMessage(task);
  }

  public process(
    image: Uint8Array, 
    op: WorkerTask['op'], 
    params: WorkerTask['params']
  ): Promise<Uint8Array> {
    
    const taskId = crypto.randomUUID();
    const task: WorkerTask = { taskId, op, image, params };

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  public terminate() {
    this.workers.forEach(w => w.terminate());
    this.workers = [];
  }
}

// Singleton instance (optional, or manage via Context)
export const photonPool = new PhotonWorkerPool();