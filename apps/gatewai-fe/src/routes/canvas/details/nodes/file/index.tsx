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
import { useAppDispatch } from '@/store'; // Add this if you need to dispatch updates
import { UploadDropzone } from '@/components/util/file-dropzone';
import { makeSelectHandleByNodeId } from '@/store/handles';
import { toast } from 'sonner';

const FileNodeComponent = memo((props: NodeProps<FileNode>) => {
  const node = useAppSelector(makeSelectNodeById(props.id));

  const result = node?.result as unknown as FileResult;
  const showResult = useHasOutputItems(props);
  const dispatch = useAppDispatch(); // Add this if updating the store
  const outputHandle = useAppSelector(makeSelectHandleByNodeId(props.id));
  const firstHandle = outputHandle[0];

  return (
    <BaseNode {...props}>
        <div className='flex flex-col gap-2'>
            {showResult && <MediaContent node={props} result={result} />}
            {!showResult && <div className='flex justify-center items-center'>
              <UploadDropzone
                onUploadSuccess={(asset) => {
                  console.log('File uploaded successfully:', asset);
                  dispatch(updateNodeResult({ 
                    id: props.id, 
                    newResult: { 
                      selectedOutputIndex: 0,
                      outputs: [
                        ...(result.outputs ?? []),
                        {
                          items: [
                            {
                              outputHandleId: firstHandle.id,
                              data: {
                                entity: asset,
                              },
                              type: 'File'
                            }
                          ]
                        }
                      ]
                    }
                  }));
                }}
                onUploadError={(error) => {
                  console.error('Upload failed:', error);
                  // Handle error, e.g., show toast
                  toast.error('An error occured when uploading file, please try again later.')
                }}
              />
              </div>}
        </div>
    </BaseNode>
  );
});
FileNodeComponent.displayName = 'GPTIMage1Node';

export { FileNodeComponent }