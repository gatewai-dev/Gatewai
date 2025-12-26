import { BLUR_TYPES } from '@gatewai/types';
// worker-types.ts

export enum WorkerStatus {
  LOADING = 'LOADING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export type PhotonOp = 'RESIZE' | 'BLUR';

export interface WorkerTask {
  taskId: string;
  op: PhotonOp;
  image: Uint8Array; // The raw image bytes (e.g. from a File)
  params: {
    // Union of all possible params
    width?: number;
    height?: number;
    blurSize?: number; // for blur
  };
}

export interface WorkerResponse {
  taskId: string;
  success: boolean;
  data?: Uint8Array; // Resulting image bytes
  error?: string;
  type?: 'init_complete'; // Special message type for initialization
}

export interface WorkerInitMessage {
  type: 'INIT';
  wasmUrl: string;
}