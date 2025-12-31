import { Box } from '@mui/material';
import { useCallback, useEffect } from 'react';
import { useUpdateNodeInternals } from 'reactflow';
import { useTranslation } from 'react-i18next';
import { ButtonContained } from '@/UI/Buttons/AppButton';
import { I18N_KEYS } from '@/language/keys';
import { Flex } from '@/UI/styles';
import { PencilLineIcon } from '@/UI/Icons/PencilLineIcon';
import { useUserWorkflowRole } from '@/state/workflow.state';
import { useCompositorView } from '../Recipe/FlowContext';
import { DynamicNode2 } from './DynamicNode/DynamicNode2';
import { hasEditingPermissions } from './Utils';
import { NodeViewer } from './Shared/FileViewer';
import type { CompositorNodeV3 } from '@/types/nodes/compositor';
import type { NodeId } from 'web';

const TRANSITION_DURATION = '0.1s';

function CompNodeV3Content({
  id,
  data,
  handleOpenEditWindow,
  isSelected,
  locked,
  handleAddInputHandle,
}: {
  id: string;
  data: CompositorNodeV3;
  handleOpenEditWindow: () => void;
  isSelected: boolean;
  locked: boolean;
  handleAddInputHandle: () => void;
}) {
  const { t } = useTranslation();
  const { input } = data.data;

  return (
    <>
      <Flex sx={{ cursor: 'default', position: 'relative', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
        <NodeViewer id={id} />
      </Flex>
      {input.some(([_key, value]) => value != undefined) && !locked ? (
        <Box
          data-testid={`open-compositor-edit-button-container-${id}`}
          sx={{
            opacity: isSelected ? 1 : 0,
            transition: `all ${TRANSITION_DURATION} ease-in-out`,
            pointerEvents: isSelected ? 'auto' : 'none',
            cursor: isSelected ? 'auto' : 'default',
          }}
        >
          <Flex sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <ButtonContained mode="text" size="small" onClick={handleAddInputHandle}>
              {t(I18N_KEYS.RECIPE_MAIN.NODES.COMPOSITOR.ADD_ANOTHER_LAYER_CTA)}
            </ButtonContained>
            <ButtonContained
              mode="outlined"
              onClick={handleOpenEditWindow}
              sx={{ height: '36px', borderRadius: 2, px: 1.5, py: 1 }}
              startIcon={<PencilLineIcon height="16px" width="16px" />}
            >
              {t(I18N_KEYS.RECIPE_MAIN.NODES.COMPOSITOR.EDIT_CTA)}
            </ButtonContained>
          </Flex>
        </Box>
      ) : null}
    </>
  );
}

interface CompNodeV3Props {
  id: NodeId;
  data: CompositorNodeV3;
  openEditWindow: (id: string) => void;
  isSelected: boolean;
}

export function CompNodeV3({ id, data, openEditWindow, isSelected }: CompNodeV3Props) {
  const compositorView = useCompositorView(id);
  const updateNodeInternals = useUpdateNodeInternals();

  const role = useUserWorkflowRole();
  const { handles } = data;

  useEffect(() => {
    updateNodeInternals(id);
  }, [handles.input, id, updateNodeInternals]);

  const handleAddInputHandle = useCallback(() => {
    compositorView.addNodeInputHandle();
  }, [compositorView]);

  const handleOpenEditWindow = useCallback(() => {
    openEditWindow(id);
    compositorView.enableNodeEditor();
    compositorView.setUndoBarrier();
  }, [openEditWindow, id, compositorView]);

  const locked = !hasEditingPermissions(role, data);

  return (
    <DynamicNode2 id={id} data={data} className="edit">
      <CompNodeV3Content
        id={id}
        data={data}
        handleOpenEditWindow={handleOpenEditWindow}
        isSelected={isSelected}
        locked={locked}
        handleAddInputHandle={handleAddInputHandle}
      />
    </DynamicNode2>
  );
}
