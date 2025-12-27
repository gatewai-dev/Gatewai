import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  FileResult,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectNodeById, updateNodeEntity, updateNodeResult } from '@/store/nodes';
import { BaseNode } from '../base';
import { MediaContent } from '../media-content';
import type { FileNode } from '../node-props';
import { useHasOutputItems } from '@/routes/canvas/hooks';
import { useAppDispatch } from '@/store';
import { UploadDropzone } from '@/components/util/file-dropzone';
import { toast } from 'sonner';
import { UploadButton } from '@/components/util/file-button';
import type { UploadFileNodeAssetRPC, UserAssetsUploadRPC } from '@/rpc/types';

// Extract types that have specific success properties
type SuccessfulUploadFileNodeAssetRPC = Extract<
  UploadFileNodeAssetRPC,
  { handles: unknown } | { someOtherSuccessProperty: unknown }
>;


const FileNodeComponent = memo((props: NodeProps<FileNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));
  const showResult = useHasOutputItems(node);
  const dispatch = useAppDispatch();

  const result = node?.result as unknown as FileResult;

  const existingMimeType = result?.outputs?.[0]?.items?.[0]?.data?.entity?.mimeType;
  const existingType = existingMimeType?.startsWith('image/') ? 'image' : existingMimeType?.startsWith('video/') ? 'video' : null;

  const accept = showResult && existingType
    ? { [`${existingType}/*`]: [] }
    : { 'image/*': [], 'video/*': [] };

  const buttonAccept = showResult && existingType
    ? [`${existingType}/*`]
    : ['image/*', 'video/*'];

  const buttonLabel = showResult && existingType
    ? `Upload another ${existingType}`
    : 'Click to upload a file';

  const dropzoneLabel = 'Click or drag & drop an image or video here';

  const onUploadSuccess = (uploadResult: UploadFileNodeAssetRPC) => {
    if (Object.hasOwn(uploadResult, 'error')) {
      const errorResult = uploadResult as { error: string };
      console.error('Upload failed:', errorResult.error);
      toast.error('An error occured when uploading file, please try again later.')
      return;
    }
    const successResult = uploadResult as SuccessfulUploadFileNodeAssetRPC;
    // Assuming uploadResult is now the updated node
    dispatch(updateNodeResult({id: props.id, newResult: successResult.result as unknown as FileResult}));
  }

  const onUploadError = (error: Error) => {
    console.error('Upload failed:', error);
    toast.error('An error occured when uploading file, please try again later.')
  }

  return (
    <BaseNode {...props}>
      <div className='flex flex-col gap-2'>
        {showResult && <MediaContent node={props} result={result} />}
        {!showResult &&
          <UploadDropzone
            className='w-full py-16'
            onUploadSuccess={onUploadSuccess}
            onUploadError={onUploadError}
            accept={accept}
            nodeId={props.id}
            label={dropzoneLabel}
          />
        }
        {showResult &&
          <UploadButton
            className='py-0'
            onUploadSuccess={onUploadSuccess}
            onUploadError={onUploadError}
            accept={buttonAccept}
            label={buttonLabel}
            nodeId={props.id}
          />}
      </div>
    </BaseNode>
  );
});
FileNodeComponent.displayName = 'FileNode';

export { FileNodeComponent }