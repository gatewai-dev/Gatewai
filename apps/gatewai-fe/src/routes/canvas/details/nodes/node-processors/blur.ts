import type { NodeProcessor } from ".";
import { db, storeClientNodeResult, hashNodeResult, hashConfigSync } from '../../media-db'; // Adjust import path as needed
import type { NodeResult, FileData, BlurNodeConfig, BlurResult } from "@gatewai/types";

const boxBlurCanvasRGB = (
  ctx: OffscreenCanvasRenderingContext2D,
  top_x: number,
  top_y: number,
  width: number,
  height: number,
  radius: number
) => {
  if (radius < 1) return;
  
  radius = Math.floor(radius);
  
  const imageData = ctx.getImageData(top_x, top_y, width, height);
  const pixels = imageData.data;
  const tempPixels = new Uint8ClampedArray(pixels);
  
  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      
      for (let kx = -radius; kx <= radius; kx++) {
        const px = x + kx;
        if (px >= 0 && px < width) {
          const idx = (y * width + px) * 4;
          r += pixels[idx];
          g += pixels[idx + 1];
          b += pixels[idx + 2];
          count++;
        }
      }
      
      const idx = (y * width + x) * 4;
      tempPixels[idx] = r / count;
      tempPixels[idx + 1] = g / count;
      tempPixels[idx + 2] = b / count;
      tempPixels[idx + 3] = pixels[idx + 3];
    }
  }
  
  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, count = 0;
      
      for (let ky = -radius; ky <= radius; ky++) {
        const py = y + ky;
        if (py >= 0 && py < height) {
          const idx = (py * width + x) * 4;
          r += tempPixels[idx];
          g += tempPixels[idx + 1];
          b += tempPixels[idx + 2];
          count++;
        }
      }
      
      const idx = (y * width + x) * 4;
      pixels[idx] = r / count;
      pixels[idx + 1] = g / count;
      pixels[idx + 2] = b / count;
    }
  }
  
  ctx.putImageData(imageData, top_x, top_y);
};

const blurProcessor: NodeProcessor = async ({ node, data }) => {
        const { nodes, edges, handles } = data;

        // Find input handle (assuming single target handle for input)
        const inputHandle = handles.find(h => h.nodeId === node.id && h.type === 'Input');
        if (!inputHandle) {
            return { success: false, error: 'No input handle found' };
        }

        // Find connected edge
        const edge = edges.find(e => e.target === node.id && e.targetHandleId === inputHandle.id);
        if (!edge) {
            return { success: false, error: 'No input connection found' };
        }

        // Find source node
        const sourceNode = nodes.find(n => n.id === edge.source);
        if (!sourceNode) {
            return { success: false, error: 'Source node not found' };
        }

        // Ensure source has a processed result (previous nodes should be processed in topological order)
        if (!sourceNode.result) {
            return { success: false, error: 'Source node has no processed result' };
        }

        // Find source handle
        const sourceHandle = handles.find(h => h.id === edge.sourceHandleId);
        if (!sourceHandle) {
            return { success: false, error: 'Source handle not found' };
        }

        // Extract input image from source result
        const sourceResult = sourceNode.result as NodeResult;
        const output = sourceResult.outputs[sourceResult.selectedOutputIndex];
        const inputItem = output.items.find(item => item.outputHandleId === sourceHandle.id);
        if (!inputItem || inputItem.type !== 'Image') {
            return { success: false, error: 'Invalid or missing input image' };
        }

        const inputFileData = inputItem.data as FileData;
        const imageUrl = inputFileData.dataUrl || inputFileData.entity?.signedUrl;
        if (!imageUrl) {
            return { success: false, error: 'No image URL available' };
        }

        // Compute inputHash for caching (source result hash + config hash)
        const sourceHash = await hashNodeResult(sourceResult);
        const configHash = hashConfigSync(node.config);
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

        const offscreen = new OffscreenCanvas(img.width, img.height);
        const ctx = offscreen.getContext('2d');
        if (!ctx) {
            return { success: false, error: 'Failed to get OffscreenCanvas context' };
        }

        const config: BlurNodeConfig = node.config as BlurNodeConfig;
        if (!config) {
            throw new Error("Config is missing");
        }
        if (config.blurType === 'Gaussian' && config.size > 0) {
            ctx.filter = `blur(${config.size}px)`;
        }
        ctx.drawImage(img, 0, 0);

        if (config.blurType === 'Box' && config.size > 0) {
            boxBlurCanvasRGB(ctx, 0, 0, img.width, img.height, config.size);
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

        // Store in cache
        await storeClientNodeResult(node, newResult, inputHash);

        return { success: true, newResult };
    }

export default blurProcessor;
