import init, { PhotonImage, resize, gaussian_blur, SamplingFilter, box_blur } from '@silvia-odwyer/photon';
import type { WorkerTask, WorkerInitMessage, WorkerResponse } from './worker-types';
import wasmUrl from '@/assets/photon_rs_bg.wasm?url';

let isReady = false;

// Helper to send typed responses
const sendResponse = (response: WorkerResponse, transfer?: Transferable[]) => {
  self.postMessage(response, { transfer });
};

self.onmessage = async (e: MessageEvent<WorkerTask | WorkerInitMessage>) => {
  const data = e.data;

  // Handle Initialization
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

  //Ensure WASM is loaded
  if (!isReady) {
    sendResponse({ 
      taskId: (data as WorkerTask).taskId, 
      success: false, 
      error: 'Worker not ready' 
    });
    return;
  }

  const task = data as WorkerTask;
  
  try {
    const photonImage = PhotonImage.new_from_byteslice(task.image);

    switch (task.op) {
      case 'RESIZE': {
        if (!task.params.width || !task.params.height) throw new Error('Missing dimensions');
        const resized = resize(
            photonImage,
            task.params.width,
            task.params.height,
            SamplingFilter.Lanczos3
        );

        const resizedBytes = resized.get_bytes();

        photonImage.free();
        resized.free();

        sendResponse(
            { taskId: task.taskId, success: true, data: resizedBytes }, 
            [resizedBytes.buffer]
        );
        break;
      }
      case 'BLUR': {
        const blurType = task.params.blurType ?? 'Box';
        if (blurType === 'Gaussian') {
            if (typeof task.params.blurSize === 'undefined') throw new Error('Missing blurSize');
            // Gaussian blur mutates the image
            gaussian_blur(photonImage, task.params.blurSize);
        } else {
            if (typeof task.params.blurSize === 'undefined') throw new Error('Missing size');
            box_blur(photonImage)
        }
        
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