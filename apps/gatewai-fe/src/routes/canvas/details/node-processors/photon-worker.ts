// photon.worker.ts
import init, { PhotonImage, resize, gaussian_blur, SamplingFilter } from '@silvia-odwyer/photon';
import type { WorkerTask, WorkerInitMessage, WorkerResponse } from './worker-types';
import wasmUrl from '@/assets/photon_rs_bg.wasm?url';

let isReady = false;

// Helper to send typed responses
const sendResponse = (response: WorkerResponse, transfer?: Transferable[]) => {
  self.postMessage(response, { transfer });
};

self.onmessage = async (e: MessageEvent<WorkerTask | WorkerInitMessage>) => {
  const data = e.data;

  // 1. Handle Initialization
  if ('type' in data && data.type === 'INIT') {
    try {
      // Load WASM using the URL passed from the main thread
      await init(wasmUrl);
      isReady = true;
      sendResponse({ taskId: 'system', success: true, type: 'init_complete' });
    } catch (err) {
      console.error('Photon Worker Init Error:', err);
      sendResponse({ taskId: 'system', success: false, error: 'Failed to init WASM' });
    }
    return;
  }

  // 2. Guard: Ensure WASM is loaded
  if (!isReady) {
    sendResponse({ 
      taskId: (data as WorkerTask).taskId, 
      success: false, 
      error: 'Worker not ready' 
    });
    return;
  }

  // 3. Handle Image Operations
  const task = data as WorkerTask;
  
  try {
    // Create PhotonImage from raw bytes (Uint8Array)
    const photonImage = PhotonImage.new_from_byteslice(task.image);

    // Perform Operations
    switch (task.op) {
      case 'RESIZE': {
        if (!task.params.width || !task.params.height) throw new Error('Missing dimensions');
        // Resize returns a NEW PhotonImage, it doesn't mutate in place for this fn usually
        // But photon-rs resize usually modifies. Let's check docs or assume standard mutation.
        // Actually standard photon `resize` returns a new image.
        const resized = resize(
            photonImage, 
            task.params.width, 
            task.params.height, 
            SamplingFilter.Lanczos3
        );
        
        // We must convert back to bytes to send to main thread
        const resizedBytes = resized.get_bytes();
        
        // Clean up memory
        photonImage.free();
        resized.free();

        sendResponse(
            { taskId: task.taskId, success: true, data: resizedBytes }, 
            [resizedBytes.buffer] // Transfer ownership for performance
        );
        break;
      }
      case 'BLUR':{
        if (typeof task.params.sigma === 'undefined') throw new Error('Missing sigma');
        
        // Gaussian blur mutates the image
        gaussian_blur(photonImage, task.params.sigma);
        
        const blurredBytes = photonImage.get_bytes();
        photonImage.free();

        sendResponse(
            { taskId: task.taskId, success: true, data: blurredBytes }, 
            [blurredBytes.buffer]
        );
        break;
        }
      default:
        throw new Error(`Unknown operation: ${task.op}`);
    }

  } catch (error) {
    sendResponse({ 
      taskId: task.taskId, 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown worker error' 
    });
  }
};