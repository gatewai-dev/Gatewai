import { DataType } from '@gatewai/db';
import type { FileData, PaintNodeConfig, PaintResult } from '@gatewai/types';
import { getImageBuffer, applyPaint, bufferToDataUrl, getMimeType } from '../../utils/image.js';
import type { NodeProcessor } from './types.js';
import { getInputValue } from '../resolvers.js';

const paintProcessor: NodeProcessor = async ({ node, data }) => {
  try {
    // Get optional background image input
    const backgroundInput = getInputValue(data, node.id, false, {
      dataType: DataType.Image, 
      label: 'Background Image' 
    }) as FileData | null;

    const paintConfig = node.config as PaintNodeConfig;
    const backgroundColor = paintConfig.backgroundColor ?? '#000';

    // Get mask from node's existing result (from painting interaction)
    const existingResult = node.result as unknown as PaintResult;
    const currentOutput = existingResult?.outputs?.[existingResult.selectedOutputIndex ?? 0];
    const maskItem = currentOutput?.items?.find(item => item.type === DataType.Mask);

    if (!maskItem?.data?.dataUrl) {
      return { success: false, error: 'No mask data found in node result' };
    }

    // Convert mask dataUrl to buffer
    const maskDataUrl = maskItem.data.dataUrl;
    const maskBase64 = maskDataUrl.split(';base64,').pop() ?? '';
    const maskBuffer = Buffer.from(maskBase64, 'base64');

    // Get output handles
    const outputHandles = data.handles.filter(h => h.nodeId === node.id && h.type === 'Output');
    const imageOutputHandle = outputHandles.find(h => h.dataTypes.includes(DataType.Image));
    const maskOutputHandle = outputHandles.find(h => h.dataTypes.includes(DataType.Mask));

    if (!maskOutputHandle) {
      throw new Error('Mask output handle is missing');
    }

    const items: Array<{
      type: string;
      data: { dataUrl: string };
      outputHandleId: string;
    }> = [];

    // Process background + mask composite if background image provided
    if (backgroundInput && imageOutputHandle) {
      const backgroundBuffer = await getImageBuffer(backgroundInput);
      const mimeType = getMimeType(backgroundInput);

      // Composite mask onto background
      const compositeBuffer = await applyPaint(backgroundBuffer, maskBuffer, {
        backgroundColor,
      });

      const compositeDataUrl = bufferToDataUrl(compositeBuffer, mimeType);

      items.push({
        type: DataType.Image,
        data: { dataUrl: compositeDataUrl },
        outputHandleId: imageOutputHandle.id,
      });
    }

    // Always output the mask
    items.push({
      type: DataType.Mask,
      data: { dataUrl: maskDataUrl },
      outputHandleId: maskOutputHandle.id,
    });

    // Build new result
    const newResult: PaintResult = {
      outputs: [{ items }],
      selectedOutputIndex: 0,
    };

    return { success: true, newResult };
  } catch (err: unknown) {
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Paint processing failed' 
    };
  }
};

export default paintProcessor;