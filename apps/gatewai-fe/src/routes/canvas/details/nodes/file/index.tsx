import { memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type {
  FileResult,
} from '@gatewai/types';
import { useAppSelector } from '@/store';
import { makeSelectNodeById, updateNodeResult } from '@/store/nodes';
import { BaseNode } from '../base';
import { MediaContent } from '../media-content';
import type { FileNode } from '../node-props';
import { useHasOutputItems } from '@/routes/canvas/hooks';
import { useAppDispatch } from '@/store';
import { UploadDropzone } from '@/components/util/file-dropzone';
import { makeSelectHandleByNodeId } from '@/store/handles';
import { toast } from 'sonner';
import { UploadButton } from '@/components/util/file-button';
import type { UserAssetsUploadRPC } from '@/rpc/types';
import { GetDataTypeFromMimetype } from '@/utils/file';

const FileNodeComponent = memo((props: NodeProps<FileNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));

  const result = node?.result as unknown as FileResult;
  const showResult = useHasOutputItems(node);
  const dispatch = useAppDispatch();
  const outputHandles = useAppSelector(makeSelectHandleByNodeId(props.id));
  const firstHandle = outputHandles[0];

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

  const onUploadSuccess = (asset: UserAssetsUploadRPC) => {
    let newIndex = 0;
    if (result?.outputs && result.outputs.length) {
      newIndex = result.outputs.length;
    }
    dispatch(updateNodeResult({
      id: props.id,
      newResult: {
        selectedOutputIndex: newIndex,
        outputs: [
          ...(result?.outputs ?? []),
          {
            items: [
              {
                outputHandleId: firstHandle.id,
                data: {
                  entity: asset,
                },
                type: GetDataTypeFromMimetype(asset.mimeType)
              }
            ]
          }
        ]
      }
    }));
  }

  const onUploadError = (error: Error) => {
    console.error('Upload failed:', error);
    // Handle error, e.g., show toast
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
            label={dropzoneLabel}
          />
        }
        {showResult &&
          <UploadButton
            className='w-32 text-[8px] py-0'
            onUploadSuccess={onUploadSuccess}
            onUploadError={onUploadError}
            accept={buttonAccept}
            label={buttonLabel}
          />}
      </div>
    </BaseNode>
  );
});
FileNodeComponent.displayName = 'FileNode';

export { FileNodeComponent }