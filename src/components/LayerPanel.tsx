import { useLayerStore } from '../store/layers';

export function LayerPanel() {
  const layers = useLayerStore((state) => state.layers);
  const activeLayerId = useLayerStore((state) => state.activeLayerId);
  const renameLayer = useLayerStore((state) => state.renameLayer);
  const deleteLayer = useLayerStore((state) => state.deleteLayer);
  const reorderLayer = useLayerStore((state) => state.reorderLayer);
  const setActiveLayer = useLayerStore((state) => state.setActiveLayer);
  const setLayerDepth = useLayerStore((state) => state.setLayerDepth);
  const setLayerOpacity = useLayerStore((state) => state.setLayerOpacity);
  const toggleLayerVisibility = useLayerStore((state) => state.toggleLayerVisibility);

  if (!layers.length) {
    return <p className="hint">No layers yet. Draw rectangles or use SAM Select.</p>;
  }

  return (
    <>
      {layers.map((layer, index) => {
        const isActive = layer.id === activeLayerId;

        return (
          <article
            key={layer.id}
            className={`layer-card${isActive ? ' active' : ''}`}
            onClick={() => setActiveLayer(layer.id)}
          >
            <div className="layer-head">
              <button
                className="icon-btn"
                type="button"
                title={layer.visible ? 'Hide layer' : 'Show layer'}
                aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                aria-pressed={layer.visible}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLayerVisibility(layer.id);
                }}
              >
                {layer.visible ? '●' : '○'}
              </button>
              <input
                type="text"
                value={layer.name}
                aria-label="Layer name"
                onChange={(event) => renameLayer(layer.id, event.target.value)}
              />
              <button
                className="icon-btn"
                type="button"
                title="Move up"
                aria-label="Move layer up"
                disabled={index === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  reorderLayer(layer.id, index - 1);
                }}
              >
                ↑
              </button>
              <button
                className="icon-btn"
                type="button"
                title="Move down"
                aria-label="Move layer down"
                disabled={index === layers.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  reorderLayer(layer.id, index + 1);
                }}
              >
                ↓
              </button>
              <button
                className="icon-btn danger"
                type="button"
                title="Delete"
                aria-label="Delete layer"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteLayer(layer.id);
                }}
              >
                ×
              </button>
            </div>
            <div className="mini-row">
              <label>
                Depth
                <input
                  type="range"
                  min="0.1"
                  max="2"
                  step="0.1"
                  value={layer.depth}
                  onChange={(event) => setLayerDepth(layer.id, Number(event.target.value))}
                />
              </label>
              <span>{layer.depth.toFixed(1)}</span>
            </div>
            <div className="mini-row">
              <label>
                Opacity
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={layer.opacity}
                  onChange={(event) => setLayerOpacity(layer.id, Number(event.target.value))}
                />
              </label>
              <span>{Math.round(layer.opacity * 100)}%</span>
            </div>
          </article>
        );
      })}
    </>
  );
}
