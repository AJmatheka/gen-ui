import { useState } from 'react';
import { LayerPanel } from './components/LayerPanel';
import { ParallaxPreview } from './components/ParallaxPreview';
import { Upload } from './components/Upload';
import { useLayerStore } from './store/layers';

export function App() {
  const [scrollOffset, setScrollOffset] = useState(0);
  const mode = useLayerStore((state) => state.mode);
  const background = useLayerStore((state) => state.background);
  const layers = useLayerStore((state) => state.layers);
  const selection = useLayerStore((state) => state.selection);
  const setMode = useLayerStore((state) => state.setMode);
  const addLayer = useLayerStore((state) => state.addLayer);
  const clearLayers = useLayerStore((state) => state.clearLayers);
  const hasBackground = Boolean(background.src);
  const hasSelection = Boolean(selection.mask || selection.points.length);

  function addFullImageLayer() {
    if (!background.src) return;

    addLayer({
      name: `Layer ${layers.length + 1}`,
      image: background.image,
      src: background.src,
      width: background.width,
      height: background.height,
      sourceRect: {
        x: 0,
        y: 0,
        width: background.width,
        height: background.height,
      },
      depth: 0.5,
      opacity: 0.9,
    });
  }

  return (
    <main className="app-shell overflow-x-hidden w-full max-w-full">
      <header className="site-header" id="top">
        <a className="brand" href="#top" aria-label="Genui home">
          genui
        </a>
        <nav className="tabs" aria-label="Tools" role="tablist">
          <button
            id="lenticularTab"
            className="tab active"
            data-tool="lenticular"
            type="button"
            role="tab"
            aria-selected="true"
            aria-controls="lenticularTool"
          >
            Lenticular
          </button>
          <button
            id="parallaxTab"
            className="tab"
            data-tool="parallax"
            type="button"
            role="tab"
            aria-selected="false"
            aria-controls="parallaxTool"
          >
            Parallax
          </button>
        </nav>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <h1 id="page-title">Motion image studio.</h1>
        <p>
          Lenticular interlaces and parallax embeds, arranged for fast visual
          work.
        </p>
      </section>

      <section className="workspace" aria-label="Workspace">
        <section
          id="lenticularTool"
          className="tool active"
          aria-label="Lenticular generator"
          role="tabpanel"
          aria-labelledby="lenticularTab"
        >
          <div className="tool-head">
            <h2>Lenticular</h2>
            <p id="lenticularStatus" className="status" role="status" aria-live="polite" />
          </div>

          <div className="editor-grid">
            <aside className="editor-rail">
              <div className="toolbar">
                <label className="file-button primary">
                  Upload A
                  <input id="fileA" type="file" accept="image/*" />
                </label>
                <label className="file-button primary">
                  Upload B
                  <input id="fileB" type="file" accept="image/*" />
                </label>
                <button id="lenticularDownload" type="button" disabled>
                  Download PNG
                </button>
                <button id="lenticularCopy" type="button" disabled>
                  Copy Embed
                </button>
              </div>

              <div className="two-up">
                <label id="zoneA" className="drop-target" htmlFor="fileA">
                  <span>
                    <strong>Image A</strong>
                    Drop or choose
                  </span>
                </label>
                <label id="zoneB" className="drop-target" htmlFor="fileB">
                  <span>
                    <strong>Image B</strong>
                    Drop or choose
                  </span>
                </label>
              </div>

              <div className="control-grid">
                <label>
                  Strip width <span id="stripReadout">10px</span>
                  <input id="stripWidth" type="range" min="2" max="50" defaultValue="10" />
                </label>
                <label>
                  Output size
                  <select id="sizePreset" defaultValue="800x600">
                    <option value="800x600">800x600</option>
                    <option value="1200x800">1200x800</option>
                    <option value="1600x900">1600x900</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label>
                  Custom width
                  <input id="customWidth" type="number" min="100" max="4000" step="10" defaultValue="800" disabled />
                </label>
                <label>
                  Custom height
                  <input id="customHeight" type="number" min="100" max="4000" step="10" defaultValue="600" disabled />
                </label>
              </div>
            </aside>

            <div className="canvas-shell">
              <canvas id="lenticularCanvas" width="800" height="600" />
            </div>
          </div>
        </section>

        <section
          id="parallaxTool"
          className="tool"
          aria-label="Image parallax editor"
          role="tabpanel"
          aria-labelledby="parallaxTab"
          hidden
        >
          <div className="tool-head">
            <h2>Parallax</h2>
            <p id="parallaxStatus" className="status" role="status" aria-live="polite" />
          </div>

          <div className="parallax-layout">
            <aside className="panel">
              <h2>Layers</h2>
              <div className="toolbar">
                <Upload />
                <button
                  id="selectMode"
                  className={mode === 'edit' ? 'active' : ''}
                  type="button"
                  onClick={() => setMode('edit')}
                >
                  Select
                </button>
                <button
                  id="previewMode"
                  className={mode === 'preview' ? 'active' : ''}
                  type="button"
                  onClick={() => setMode('preview')}
                >
                  Preview
                </button>
                <button id="exportParallax" type="button" disabled>
                  Copy Embed
                </button>
              </div>
              <div className="sam-panel" aria-label="Object selection">
                <div className="sam-controls">
                  <button id="samSelect" type="button" disabled={!hasBackground || selection.isBusy}>
                    SAM Select
                  </button>
                  <button id="samNegative" type="button" disabled={!hasBackground || selection.isBusy}>
                    Exclude
                  </button>
                  <button id="commitSamLayer" type="button" disabled={!hasBackground || selection.isBusy || !selection.mask}>
                    Commit Mask
                  </button>
                  <button id="clearSamSelection" type="button" disabled={!hasBackground || selection.isBusy || !hasSelection}>
                    Clear Mask
                  </button>
                </div>
                <p id="samStatus" className="hint" role="status" aria-live="polite">
                  Upload image to select objects.
                </p>
              </div>
              <div id="layersList" className="layers-list">
                <LayerPanel />
              </div>
              <div className="layer-actions">
                <button
                  id="addWholeLayer"
                  type="button"
                  disabled={!background.src}
                  onClick={addFullImageLayer}
                >
                  Add full layer
                </button>
                <button
                  id="clearLayers"
                  className="danger"
                  type="button"
                  disabled={!layers.length}
                  onClick={() => clearLayers()}
                >
                  Clear
                </button>
              </div>
              <div className="panel-controls">
                <label>
                  Scroll <span id="scrollReadout">{scrollOffset}</span>
                  <input
                    id="scrollSim"
                    type="range"
                    min="-300"
                    max="300"
                    value={scrollOffset}
                    onChange={(event) => setScrollOffset(Number(event.target.value))}
                  />
                </label>
              </div>
            </aside>

            <div className="stage">
              <div id="mobileNotice" className="warn hidden">
                Selection needs desktop pointer input.
              </div>
              <div className="parallax-shell">
                <div
                  id="parallaxStage"
                  className={`parallax-stage${background.src ? '' : ' empty'}`}
                  style={
                    background.src
                      ? { aspectRatio: `${background.width} / ${background.height}`, minHeight: 0 }
                      : undefined
                  }
                >
                  <ParallaxPreview scrollOffset={scrollOffset} />
                </div>
              </div>
              <div className="embed-box">
                <label>
                  Embed snippet
                  <textarea id="embedOutput" readOnly placeholder="Exported HTML appears here." />
                </label>
                <p id="sizeWarning" className="warn" />
              </div>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
