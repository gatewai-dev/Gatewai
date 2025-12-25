import { useRef } from 'react';
import { PlusIcon, Loader2 } from 'lucide-react';
import { useUploadAssetMutation } from '@/store/assets';
import type { UserAssetsUploadRPC } from '@/rpc/types';
import type { ChangeEvent } from 'react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface UploadButtonProps {
    className?: string;
    onUploadSuccess?: (asset: UserAssetsUploadRPC) => void;
    onUploadError?: (error: Error) => void;
    onUploadStart?: () => void;
    accept?: string[];
    label?: string;
}

export const UploadButton = ({ className, onUploadStart, onUploadSuccess, onUploadError, accept, label }: UploadButtonProps) => {
  const [upload, { isLoading }] = useUploadAssetMutation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!isLoading) {
      inputRef.current?.click();
    }
  };

  const handleChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onUploadStart?.();
      const asset = await upload(file).unwrap();
      onUploadSuccess?.(asset);
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        onUploadError?.(error);
      }
    }
    e.target.value = '';
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isLoading}
        variant="outline"
        size="xs"
        className={cn(className)}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <PlusIcon className="h-3 w-3" />
            {label ?? 'Click to upload a file'}
          </>
        )}
      </Button>
      <input
        type="file"
        ref={inputRef}
        onChange={handleChange}
        style={{ display: 'none' }}
        multiple={false}
        accept={accept?.join(',')}
      />
    </>
  );
};