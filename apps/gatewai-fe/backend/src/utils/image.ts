// imageUtils.ts
import sharp from 'sharp';
import type { FileData } from '@gatewai/types';

export async function getImageBuffer(imageInput: FileData): Promise<Buffer> {
  if (imageInput.dataUrl) {
    const base64 = imageInput.dataUrl.split(';base64,').pop() ?? '';
    return Buffer.from(base64, 'base64');
  } else if (imageInput.entity?.signedUrl) {
    const response = await fetch(imageInput.entity.signedUrl);
    return Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error('Invalid image input');
  }
}

export function getMimeType(imageInput: FileData): string {
  if (imageInput.entity?.mimeType) return imageInput.entity.mimeType;
  if (imageInput.dataUrl) {
    const match = imageInput.dataUrl.match(/^data:(image\/[^;]+);base64,/);
    return match ? match[1] : 'image/png';
  }
  return 'image/png';
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export async function applyBlur(buffer: Buffer, blurAmount: number, blurType: 'Gaussian' | 'Box'): Promise<Buffer> {
  if (blurAmount <= 0) return buffer;
  if (blurType === 'Gaussian') {
    return sharp(buffer).blur(blurAmount).toBuffer();
  } else if (blurType === 'Box') {
    const kernelSize = Math.max(1, Math.round(blurAmount) * 2 + 1);
    const kernel = new Array(kernelSize * kernelSize).fill(1 / (kernelSize * kernelSize));
    return sharp(buffer).convolve({ width: kernelSize, height: kernelSize, kernel }).toBuffer();
  } else {
    throw new Error('Invalid blur type');
  }
}

export async function applyResize(buffer: Buffer, width: number, height: number): Promise<Buffer> {
  if (width <= 0 && height <= 0) return buffer;
  return sharp(buffer).resize(width, height).toBuffer();
}