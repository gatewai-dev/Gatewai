import { useEffect, useState } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { color } from '@/colors';
import { useIsHovered } from '@/hooks/useIsHovered';

function CompLayer({ name, layer, selectedLayer, setSelectedLayer, updateLayer, isDragged }) {
  const [isSelected, setIsSelected] = useState(false);
  const { isHovered, ...elementProps } = useIsHovered();

  useEffect(() => {
    if (name === selectedLayer) {
      setIsSelected(true);
    } else setIsSelected(false);
  }, [selectedLayer]);

  const toggleVisibility = (e) => {
    e.preventDefault();
    layer.visible = !layer.visible;
    updateLayer(name, layer);
  };

  const toggleLocked = (e) => {
    e.preventDefault();
    layer.locked = !layer.locked;
    updateLayer(name, layer);
    if (!layer.locked) setIsSelected(true);
  };

  return (
    <Box
      id={`comp-layer-container-${name}`}
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        p: 0.2,
        px: 1,
        cursor: 'pointer',
        boxShadow: isHovered ? `inset 0 0 0 1px ${color.Yambo_Black_Stroke}` : 'none',
        borderRadius: '2px',
        background: isSelected ? color.Yambo_Purple : color.Black92,
        opacity: !isDragged ? 1 : 0.4,
      }}
      onClick={() => setSelectedLayer(name)}
      {...elementProps}
    >
      <Box sx={{ ml: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            opacity: layer?.visible && layer?.url ? '1' : '.7',
          }}
        >
          {layer?.url ? (
            <i className="fa-thin fa-image fa-sm"></i>
          ) : (
            <i
              className="fa-kit fa-light-image-slash fa-sm"
              style={{ position: 'relative', left: '-2px', marginRight: '-2px' }}
            ></i>
          )}

          <Typography
            variant="body-sm-rg"
            sx={{
              ml: 1,
              fontWeight: isSelected ? '' : '500',
            }}
          >
            {layer?.name}
          </Typography>
        </Box>
        {!layer?.url && (
          <Tooltip title="Connect a valid image to enable this layer.">
            <Typography variant="body-sm-rg" sx={{ fontSize: '0.7rem', opacity: '.7' }}>
              No media
            </Typography>
          </Tooltip>
        )}
        {isHovered && layer?.url && (
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Box onClick={toggleLocked}>
              {layer?.locked && layer?.locked === true ? (
                <i className="fa-solid fa-lock fa-2xs"></i>
              ) : (
                <i className="fa-light fa-unlock fa-2xs"></i>
              )}
            </Box>
            <Box onClick={toggleVisibility} sx={{ ml: 1 }}>
              {layer?.visible && layer?.visible === true ? (
                <i className="fa-light fa-eye fa-2xs"></i>
              ) : (
                <i className="fa-light fa-eye-slash fa-2xs"></i>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default CompLayer;
