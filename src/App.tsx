import { Upload } from './components/Upload';

export function App() {
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
                <button id="selectMode" className="active" type="button">
                  Select
                </button>
                <button id="previewMode" type="button">
                  Preview
                </button>
                <button id="exportParallax" type="button" disabled>
                  Copy Embed
                </button>
              </div>
              <div id="layersList" className="layers-list" />
              <div className="layer-actions">
                <button id="addWholeLayer" type="button" disabled>
                  Add full layer
                </button>
                <button id="clearLayers" className="danger" type="button" disabled>
                  Clear
                </button>
              </div>
              <div className="panel-controls">
                <label>
                  Scroll <span id="scrollReadout">0</span>
                  <input id="scrollSim" type="range" min="-300" max="300" defaultValue="0" />
                </label>
              </div>
            </aside>

            <div className="stage">
              <div id="mobileNotice" className="warn hidden">
                Selection needs desktop pointer input.
              </div>
              <div className="parallax-shell">
                <div id="parallaxStage" className="parallax-stage empty">
                  <span>
                    <strong>Drop image</strong>
                    <br />
                    Draw rectangles to create depth layers.
                  </span>
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
