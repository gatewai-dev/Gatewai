import { useCallback } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import { UploadIcon, Loader2 } from 'lucide-react';
import { useUploadAssetMutation } from '@/store/assets';
import type { UserAssetsUploadRPC } from '@/rpc/types';

interface DropzoneProps {
    className?: string;
    onUploadSuccess?: (asset: UserAssetsUploadRPC) => void;
    onUploadError?: (error: Error) => void;
    onUploadStart?: () => void;
    accept?: Accept
    label?: string;
}

export const UploadDropzone = ({ className, onUploadStart, onUploadSuccess, onUploadError, accept, label }: DropzoneProps) => {
  const [upload, { isLoading }] = useUploadAssetMutation();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      try {
        onUploadStart?.();
        const asset = await upload(file).unwrap();
        onUploadSuccess?.(asset);
      } catch (error) {
        console.error(error)
        if (error instanceof Error) {
          onUploadError?.(error);
        }
      }
    },
    [onUploadStart, upload, onUploadSuccess, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept
  });

  return (
    <div
      {...getRootProps()}
      className={`flex justify-center items-center border-2 border-dashed rounded-md p-4 text-xs cursor-pointer ${className ?? ''}`}
    >
      <input {...getInputProps()} />
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Uploading...
        </>
      ) : (
        <>
          <UploadIcon className="mr-2 h-4 w-4" />
          {isDragActive ? 'Drop the file here' : label ?? 'Click or drag & drop a file here'}
        </>
      )}
    </div>
  );
};