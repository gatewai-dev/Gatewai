import type { NodeProcessor } from "..";
import { db, storeClientNodeResult, hashNodeResult, hashConfigSync, cleanupNodeResults } from '../../media-db';
import type { NodeResult, FileData, BlurNodeConfig, BlurResult } from "@gatewai/types";
import type { NodeInputContextData } from "../../nodes/hooks/use-handle-value-resolver";
import { pixiProcessor } from "../../processor/pixi-service";

export type BlurExtraArgs = {
  nodeInputContextData: NodeInputContextData;
  canvas?: HTMLCanvasElement | null;
}

const blurProcessor: NodeProcessor<BlurExtraArgs> = async ({ node, data, extraArgs, signal }) => {
  const { handles } = data;
  const { nodeInputContextData: { result, cachedResult, resultValue, cachedResultValue }, canvas: providedCanvas } = extraArgs;
  
  // Check cancellation at the start
  if (signal?.aborted) {
    throw new DOMException('Processing cancelled', 'AbortError');
  }
  
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

  // Check cancellation before heavy operations
  if (signal?.aborted) {
    throw new DOMException('Processing cancelled', 'AbortError');
  }

  // 2. Caching Logic
  const sourceHash = await hashNodeResult(resultToUse);
  const configHash = hashConfigSync(node.config ?? {});
  let inputStr = sourceHash + configHash;

  if (cachedResult?.hash) {
    inputStr += cachedResult.hash;
  }

  // Simple SHA-256 hash generation
  const encoder = new TextEncoder();
  const hashData = encoder.encode(inputStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Check cancellation before database operations
  if (signal?.aborted) {
    throw new DOMException('Processing cancelled', 'AbortError');
  }

  const cached = await db.clientNodeResults.where({ id: node.id, inputHash }).first();
  console.log({ cached });

  // Helper to draw result to the UI canvas
  const drawToCanvas = async (url: string) => {
    if (!providedCanvas) return;
    
    // Check cancellation before drawing
    if (signal?.aborted) {
      throw new DOMException('Processing cancelled', 'AbortError');
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image for canvas'));
      
      // Handle cancellation during image loading
      if (signal) {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Processing cancelled', 'AbortError'));
        });
      }
    });
    
    // Check cancellation after image loads
    if (signal?.aborted) {
      throw new DOMException('Processing cancelled', 'AbortError');
    }
    
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
    const config: BlurNodeConfig = (node.config ?? {
      size: 1,
    }) as BlurNodeConfig;
  
    // Check cancellation before Pixi processing
    if (signal?.aborted) {
      throw new DOMException('Processing cancelled', 'AbortError');
    }

    // Use the shared Pixi processor with cancellation signal
    const dataUrl = await pixiProcessor.processBlur(
      imageUrl, 
      {
        blurSize: config.size ?? 1,
      },
      signal
    );

    // Check cancellation after Pixi processing
    if (signal?.aborted) {
      throw new DOMException('Processing cancelled', 'AbortError');
    }

    // 4. Update the provided Canvas
    await drawToCanvas(dataUrl);

    // Check cancellation before storing result
    if (signal?.aborted) {
      throw new DOMException('Processing cancelled', 'AbortError');
    }

    // 5. Return Result
    const outputHandle = handles.find(h => h.nodeId === node.id && h.type === 'Output');
    if (!outputHandle) {
      return { success: false, error: 'No output handle found' };
    }

    const newResult: BlurResult = {
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
    // Distinguish between cancellation and real errors
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.log('Blur processing cancelled for node:', node.id);
      throw err; // Re-throw to be handled by queue
    }
    
    console.error("Pixi processing failed:", err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export default blurProcessor;