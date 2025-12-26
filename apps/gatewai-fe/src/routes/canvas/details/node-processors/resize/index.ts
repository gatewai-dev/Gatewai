import type { NodeProcessor } from "..";
import { db, storeClientNodeResult, hashNodeResult, hashConfigSync, cleanupNodeResults } from '../../media-db';
import type { NodeResult, FileData, ResizeNodeConfig, ResizeResult } from "@gatewai/types";
import type { NodeInputContextData } from "../../nodes/hooks/use-handle-value-resolver";
import { pixiProcessor } from "../../pixi-service";

export type ResizeExtraArgs = {
  nodeInputContextData: NodeInputContextData;
  canvas?: HTMLCanvasElement | null;
}

const resizeProcessor: NodeProcessor<ResizeExtraArgs> = async ({ node, data, extraArgs }) => {
  const { handles } = data;
  const { nodeInputContextData: { result, cachedResult, resultValue, cachedResultValue }, canvas: providedCanvas } = extraArgs
  
  // 1. Extract input image URL
  let imageUrl: string | undefined;
  const resultEntity = (resultValue?.data as FileData)?.entity;
  
  if (resultEntity) {
    imageUrl = resultEntity.signedUrl;
  } else {
    imageUrl = (cachedResultValue?.data as FileData)?.dataUrl;
  }

  const resultToUse = (result ?? cachedResult) as NodeResult;

  if (!imageUrl || !resultToUse) {
      await cleanupNodeResults(node.id);
      return { success: false, error: 'No image URL available' };
  }

  // 2. Caching Logic
  const sourceHash = await hashNodeResult(resultToUse);
  const configHash = hashConfigSync(node.config ?? {});
  const inputStr = sourceHash + configHash;
  
  // Simple SHA-256 hash generation
  const encoder = new TextEncoder();
  const hashData = encoder.encode(inputStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  let inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (cachedResult?.hash) {
    inputHash += cachedResult?.hash;
  }

  const cached = await db.clientNodeResults.where({ id: node.id, inputHash }).first();
  
  // Helper to draw result to the UI canvas
  const drawToCanvas = async (url: string) => {
    if (!providedCanvas) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for canvas'));
    });
    
    // We maintain a 2D context for the UI canvas to be compatible 
    // with standard caching strategies
    providedCanvas.width = img.width;
    providedCanvas.height = img.height;
    providedCanvas.style.width = '100%';
    providedCanvas.style.height = 'auto';
    
    const ctx = providedCanvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, providedCanvas.width, providedCanvas.height);
      ctx.drawImage(img, 0, 0);
    }
  };

  // Cache Hit
  if (cached) {
      await db.clientNodeResults.update(cached.id, { age: Date.now() });
      const cachedUrl = (cached.result.outputs[0].items[0].data as FileData).dataUrl;
      await drawToCanvas(cachedUrl);
      return { success: true, newResult: cached.result };
  }

  // 3. Pixi Processing (Cache Miss)
  try {
    if (!node.config) {
        throw new Error("Node config required");
    }
    const config: ResizeNodeConfig = node.config as ResizeNodeConfig;
  
    // Use the shared Pixi processor
    const dataUrl = await pixiProcessor.processResize(imageUrl, {
      width: config.width,
      height: config.height,
    });

    // 4. Update the provided Canvas
    await drawToCanvas(dataUrl);

    // 5. Return Result
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
    console.error("Pixi processing failed:", err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export default resizeProcessor;