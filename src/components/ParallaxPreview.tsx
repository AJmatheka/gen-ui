import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLayerStore } from '../store/layers';
import type { MaskPayload } from '../store/layers';

type ParallaxPreviewProps = {
  scrollOffset: number;
};

function maskToDataUrl(mask: MaskPayload): string {
  const canvas = document.createElement('canvas');
  canvas.width = mask.width;
  canvas.height = mask.height;
  const context = canvas.getContext('2d');

  if (!context) return '';

  if (mask.data instanceof ImageData) {
    context.putImageData(mask.data, 0, 0);
    return canvas.toDataURL('image/png');
  }

  const image = context.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.data.length; index += 1) {
    const offset = index * 4;
    image.data[offset] = 17;
    image.data[offset + 1] = 17;
    image.data[offset + 2] = 17;
    image.data[offset + 3] = mask.data[index];
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function ParallaxPreview({ scrollOffset }: ParallaxPreviewProps) {
  const mode = useLayerStore((state) => state.mode);
  const background = useLayerStore((state) => state.background);
  const layers = useLayerStore((state) => state.layers);
  const selection = useLayerStore((state) => state.selection);
  const visibleLayers = layers.filter((layer) => layer.visible).sort((left, right) => left.order - right.order);
  const maskUrls = useMemo(
    () => new Map(layers.filter((layer) => layer.mask).map((layer) => [layer.id, maskToDataUrl(layer.mask!)])),
    [layers],
  );
  const selectionMaskUrl = useMemo(
    () => (selection.mask ? maskToDataUrl(selection.mask) : ''),
    [selection.mask],
  );
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  if (!background.src) {
    return (
      <span>
        <strong>Drop image</strong>
        <br />
        Draw rectangles or use SAM Select.
      </span>
    );
  }

  return (
    <motion.div
      className="react-parallax-preview"
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - rect.left) - rect.width / 2) / (rect.width / 2),
          y: ((event.clientY - rect.top) - rect.height / 2) / (rect.height / 2),
        });
      }}
      onPointerLeave={() => setPointer({ x: 0, y: 0 })}
    >
      <img className="base-img" src={background.src} alt="" draggable={false} />
      {visibleLayers.map((layer, index) => {
        const sourceRect = layer.sourceRect ?? {
          x: 0,
          y: 0,
          width: layer.width,
          height: layer.height,
        };
        const left = `${(sourceRect.x / background.width) * 100}%`;
        const top = `${(sourceRect.y / background.height) * 100}%`;
        const width = `${(sourceRect.width / background.width) * 100}%`;
        const height = `${(sourceRect.height / background.height) * 100}%`;
        const backgroundSize = `${(background.width / sourceRect.width) * 100}% ${(background.height / sourceRect.height) * 100}%`;
        const backgroundPosition = `${(-sourceRect.x / sourceRect.width) * 100}% ${(-sourceRect.y / sourceRect.height) * 100}%`;
        const depthMultiplier = mode === 'preview' ? layer.depth : 0;
        const maskUrl = maskUrls.get(layer.id);
        const maskStyles = maskUrl
          ? {
              left: '0',
              top: '0',
              width: '100%',
              height: '100%',
              backgroundSize: '100% 100%',
              backgroundPosition: '0 0',
              maskImage: `url("${maskUrl}")`,
              maskSize: '100% 100%',
              WebkitMaskImage: `url("${maskUrl}")`,
              WebkitMaskSize: '100% 100%',
            }
          : {};

        return (
          <motion.div
            key={layer.id}
            className="parallax-layer"
            animate={{
              x: pointer.x * depthMultiplier * 28,
              y: pointer.y * depthMultiplier * 28 + scrollOffset * depthMultiplier * 0.3,
            }}
            transition={{ type: 'spring', stiffness: 160, damping: 24, mass: 0.35 }}
            style={{
              left,
              top,
              width,
              height,
              inset: 'auto',
              opacity: layer.opacity,
              zIndex: 20 + index,
              backgroundImage: `url("${layer.src || background.src}")`,
              backgroundSize,
              backgroundPosition,
              ...maskStyles,
            }}
          />
        );
      })}
      {mode === 'edit' &&
        layers.map((layer, index) => {
          const sourceRect = layer.sourceRect;
          if (!sourceRect) return null;

          return (
            <div
              key={`${layer.id}-selection`}
              className="selection"
              style={{
                left: `${(sourceRect.x / background.width) * 100}%`,
                top: `${(sourceRect.y / background.height) * 100}%`,
                width: `${(sourceRect.width / background.width) * 100}%`,
                height: `${(sourceRect.height / background.height) * 100}%`,
                zIndex: 100 + index,
              }}
            >
              <span>{layer.name}</span>
            </div>
          );
        })}
      {mode === 'edit' && selectionMaskUrl && (
        <div
          className="sam-mask-preview"
          style={{
            backgroundImage: `url("${selectionMaskUrl}")`,
            backgroundSize: '100% 100%',
          }}
        />
      )}
      {mode === 'edit' &&
        selection.points.map((point) => (
          <span
            key={point.id}
            className={`sam-point${point.type === 'negative' ? ' negative' : ''}`}
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
            }}
          />
        ))}
    </motion.div>
  );
}
