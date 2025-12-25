import type { NodeProcessor } from ".";
import { db, storeClientNodeResult, hashNodeResult, hashConfigSync } from '../../media-db'; // Adjust import path as needed
import type { NodeResult, FileData, ResizeNodeConfig, ResizeResult } from "@gatewai/types";

export type ResizeExtraArgs = {
  resolvedInputResult: NodeResult;
  originalWidth: number;
  originalHeight: number;
  maintainAspect: boolean;
}

const resizeProcessor: NodeProcessor<ResizeExtraArgs> = async ({ node, data, extraArgs }) => {
      const { handles } = data;

      // Extract input image from source result
      const {resolvedInputResult, originalWidth, originalHeight, maintainAspect} = extraArgs
      const inputFileData = resolvedInputResult.outputs[resolvedInputResult.selectedOutputIndex].items[0].data as FileData;
      const imageUrl = inputFileData.dataUrl || inputFileData.entity?.signedUrl;

      if (!imageUrl) {
          return { success: false, error: 'No image URL available' };
      }

      // Compute inputHash for caching (source result hash + config hash)
      const sourceHash = await hashNodeResult(resolvedInputResult);
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
          // Update age for LRU-like cleanup
          await db.clientNodeResults.update(cached.id, { age: Date.now() });
          return { success: true, newResult: cached.result };
      }

      // No cache hit: load image and process with OffscreenCanvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image'));
      });

      const config = (node.config ?? {}) as ResizeNodeConfig;

      const targetWidth = config.width ?? originalWidth;
      const targetHeight = config.height ?? originalHeight;

      const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
          return { success: false, error: 'Failed to get OffscreenCanvas context' };
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (maintainAspect) {
        const scale = Math.min(targetWidth / originalWidth, targetHeight / originalHeight);
        const drawWidth = originalWidth * scale;
        const drawHeight = originalHeight * scale;
        const dx = (targetWidth - drawWidth) / 2;
        const dy = (targetHeight - drawHeight) / 2;
        ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
      } else {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      }

      // Convert to blob and then data URL
      const blob = await offscreen.convertToBlob({ type: 'image/png' });
      const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read blob'));
          reader.readAsDataURL(blob);
      });

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