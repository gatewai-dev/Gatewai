import type { NodeProcessor } from "..";
import { db, storeClientNodeResult, hashNodeResult, hashConfigSync, cleanupNodeResults } from '../../media-db';
import type { NodeResult, FileData, ResizeNodeConfig, ResizeResult } from "@gatewai/types";
import type { NodeInputContextData } from "../../nodes/hooks/use-handle-value-resolver";
import { photonPool } from "../photon-worker-pool";

export type ResizeExtraArgs = {
  nodeInputContextData: NodeInputContextData;
  canvas?: HTMLCanvasElement | null;
}

const resizeProcessor: NodeProcessor<ResizeExtraArgs> = async ({ node, data, extraArgs }) => {
  const { handles } = data;

  // 1. Extract input image URL
  const { nodeInputContextData: { result, cachedResult, resultValue, cachedResultValue }, canvas: providedCanvas } = extraArgs
  const imageUrl = (resultValue?.data as FileData).entity?.signedUrl ?? (cachedResultValue?.data as FileData).dataUrl;
  const resultToUse = (result ?? cachedResult) as NodeResult;
  
  if (!imageUrl || !resultToUse) {
      await cleanupNodeResults(node.id);
      return { success: false, error: 'No image URL available' };
  }

  // 2. Caching Logic (Kept mostly the same)
  const sourceHash = await hashNodeResult(resultToUse);
  const configHash = hashConfigSync(node.config ?? {});
  const inputStr = sourceHash + configHash;
  const encoder = new TextEncoder();
  const hashData = encoder.encode(inputStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const cached = await db.clientNodeResults.where({ id: node.id, inputHash }).first();
  
  if (cached) {
      await db.clientNodeResults.update(cached.id, { age: Date.now() });

      // If canvas provided, draw cached image on it
      if (providedCanvas) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = (cached.result.outputs[0].items[0].data as FileData).dataUrl;
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load cached image'));
        });
        
        providedCanvas.width = img.width;
        providedCanvas.height = img.height;
        providedCanvas.style.width = '100%';
        providedCanvas.style.height = 'auto';
        
        const ctx = providedCanvas.getContext('2d', { willReadFrequently: true });
        if (ctx) ctx.drawImage(img, 0, 0);
      }

      return { success: true, newResult: cached.result };
  }

  // 3. Worker Processing (Cache Miss)
  try {
    if (!node.config) {
        throw new Error("Node config required");
    }
    const config: ResizeNodeConfig = node.config as ResizeNodeConfig;
  
    // Fetch the image as raw bytes (Uint8Array) to pass to Worker
    // This avoids decoding the image on the main thread
    const fetchResponse = await fetch(imageUrl, { credentials: 'include' });
    const fileBlob = await fetchResponse.blob();
    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Input = new Uint8Array(arrayBuffer);

    // Call the Worker Pool
    const resultBytes = await photonPool.process(uint8Input, 'RESIZE', {
      width: config.width,
      height: config.height,
    });

    // 4. Handle Worker Result
    const resultBlob = new Blob([resultBytes], { type: 'image/png' });

    // Convert Blob to Base64 DataURL for storage/cache
    const reader = new FileReader();
    const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
    });
    reader.readAsDataURL(resultBlob);
    const dataUrl = await dataUrlPromise;

    // 5. Update the provided Canvas (if visible in UI)
    if (providedCanvas) {
      // createImageBitmap is off-main-thread friendly for decoding
      const imgBitmap = await createImageBitmap(resultBlob);
      
      providedCanvas.width = imgBitmap.width;
      providedCanvas.height = imgBitmap.height;
      providedCanvas.style.width = '100%';
      providedCanvas.style.height = 'auto';
      
      const ctx = providedCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imgBitmap, 0, 0);
      }
    }

    // 6. Return Result
    const outputHandle = handles.find(h => h.nodeId === node.id && h.type === 'Output');
    if (!outputHandle) {
        return { success: false, error: 'No output handle found' };
    }

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

    await storeClientNodeResult(node, newResult, inputHash);

    return { success: true, newResult };

  } catch (err) {
    console.error("Worker processing failed:", err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown worker error' };
  }
}

export default resizeProcessor;