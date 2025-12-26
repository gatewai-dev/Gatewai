import type { NodeProcessor } from ".";
import { db, storeClientNodeResult, hashNodeResult, hashConfigSync, cleanupNodeResults } from '../media-db'; // Adjust import path as needed
import type { NodeResult, FileData, ResizeNodeConfig, ResizeResult } from "@gatewai/types";
import type { NodeInputContextData } from "../nodes/hooks/use-handle-value-resolver";
import { getPhotonInstance } from "../ctx/photon-loader";


export type ResizeExtraArgs = {
  nodeInputContextData: NodeInputContextData;
  canvas?: HTMLCanvasElement;
}

const resizeProcessor: NodeProcessor<ResizeExtraArgs> = async ({ node, data, extraArgs }) => {
  const { handles } = data;

  // Extract input image from source result
  const { nodeInputContextData: { result, cachedResult, resultValue, cachedResultValue }, canvas: providedCanvas } = extraArgs
  const imageUrl = (resultValue?.data as FileData).entity?.signedUrl ?? (cachedResultValue?.data as FileData).dataUrl;
  const resultToUse = (result ?? cachedResult) as NodeResult;
  if (!imageUrl || !resultToUse) {
      await cleanupNodeResults(node.id);
      return { success: false, error: 'No image URL available' };
  }

  // Compute inputHash for caching (source result hash + config hash)
  const sourceHash = await hashNodeResult(resultToUse);
  const configHash = hashConfigSync(node.config ?? {});
  const inputStr = sourceHash + configHash;
  const encoder = new TextEncoder();
  const hashData = encoder.encode(inputStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  // Check cache by node.id and inputHash
  const cached = await db.clientNodeResults.where({ id: node.id, inputHash }).first();
  if (cached) {
      // If canvas provided, draw cached image on it
      if (providedCanvas) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = (cached.result.outputs[0].items[0].data as FileData).dataUrl;
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
        });
        providedCanvas.width = img.width;
        providedCanvas.height = img.height;
        providedCanvas.style.width = '100%';
        providedCanvas.style.height = 'auto';
        const ctx = providedCanvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }
      }

      return { success: true, newResult: cached.result };
  }

  // No cache hit: load image and process with Canvas
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = imageUrl;
  await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
  });

  const canvas = providedCanvas ?? document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  if (providedCanvas) {
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { success: false, error: 'Failed to get Canvas context' };
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const config: ResizeNodeConfig = (node.config as ResizeNodeConfig ?? {
    height: 100,
    maintainAspect: true,
    width: 100,
  });
  if (!config) {
      throw new Error("Config is missing");
  }

  ctx.drawImage(img, 0, 0);
  const photonInstance = await getPhotonInstance();

  if (!photonInstance) {
    throw new Error("Photon instance not found");
    
  }
  console.log({photonInstance})
  const photonImage = photonInstance.open_image(canvas, ctx);
  photonInstance.resize(photonImage, config.width, config.height, 4);
  photonInstance.putImageData(canvas, ctx, photonImage);

  // Convert to data URL
  const dataUrl = canvas.toDataURL('image/png');

  // Find output handle (assuming single source handle for output)
  const outputHandle = handles.find(h => h.nodeId === node.id && h.type === 'Output');
  if (!outputHandle) {
      return { success: false, error: 'No output handle found' };
  }

  // Build new result
  const newResult: ResizeResult = {
      selectedOutputIndex: 0,
      outputs: [{
          items: [{
              type: 'Image',
              data: { dataUrl },
              outputHandleId: outputHandle.id
          }]
      }]
  };

  // Store in cache
  await storeClientNodeResult(node, newResult, inputHash);

  return { success: true, newResult };
}

export default resizeProcessor;