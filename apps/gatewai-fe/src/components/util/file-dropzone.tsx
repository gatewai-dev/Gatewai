import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUploadAssetMutation } from '@/store/assets';
import type { UserAssetsUploadRPC } from '@/rpc/types';


interface DropzoneProps {
    className?: string;
    onUploadSuccess?: (asset: UserAssetsUploadRPC) => void;
    onUploadError?: (error: Error) => void;
}

export const UploadDropzone = ({ className, onUploadSuccess, onUploadError }: DropzoneProps) => {
  const [upload, { isLoading }] = useUploadAssetMutation();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      try {
        const asset = await upload(file).unwrap();
        onUploadSuccess?.(asset);
      } catch (error) {
        if (error instanceof Error) {
            onUploadError?.(error);
        }
      }
    },
    [upload, onUploadSuccess, onUploadError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex justify-center items-center border-2 border-dashed rounded-md p-4 cursor-pointer ${className ?? ''}`}
    >
      <input {...getInputProps()} />
      <Button variant="ghost" disabled={isLoading}>
        <UploadIcon className="mr-2 h-4 w-4" />
        {isLoading ? 'Uploading...' : isDragActive ? 'Drop the file here' : 'Upload file'}
      </Button>
    </div>
  );
};