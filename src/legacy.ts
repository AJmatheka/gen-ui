// @ts-nocheck
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadCanvasReadyImage } from './utils/image';
import { useLayerStore } from './store/layers';
import SamWorker from './workers/sam.worker?worker';

window.gsap = gsap;
gsap.registerPlugin(ScrollTrigger);

export function initLegacyApp() {
    const $ = id => document.getElementById(id);
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function initEditorialMotion() {
      if (reducedMotion) return;

      gsap.from(".site-header", {
        y: -10,
        opacity: 0,
        duration: 0.5,
        ease: "power2.out"
      });
      gsap.from(".intro > *", {
        y: 18,
        opacity: 0,
        duration: 0.65,
        stagger: 0.08,
        ease: "power2.out"
      });
      gsap.from(".workspace", {
        opacity: 0,
        y: 18,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: ".workspace",
          start: "top 86%"
        }
      });
    }

    initEditorialMotion();

    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const lenticularActive = tab.dataset.tool === "lenticular";
        document.querySelectorAll(".tab").forEach(item => {
          const active = item === tab;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", String(active));
        });
        $("lenticularTool").classList.toggle("active", lenticularActive);
        $("lenticularTool").hidden = !lenticularActive;
        $("parallaxTool").classList.toggle("active", !lenticularActive);
        $("parallaxTool").hidden = lenticularActive;
      });
    });

    const lenticular = {
      imageA: null,
      imageB: null,
      dataA: "",
      dataB: "",
      width: 800,
      height: 600,
      stripWidth: 10,
      targetOffset: 0,
      easedOffset: 0,
      hoverX: 0,
      scaledA: document.createElement("canvas"),
      scaledB: document.createElement("canvas")
    };

    const lCanvas = $("lenticularCanvas");
    const lCtx = lCanvas.getContext("2d");

    function setStatus(el, message) {
      el.textContent = message;
      clearTimeout(el.timer);
      el.timer = setTimeout(() => { el.textContent = ""; }, 2800);
    }

    async function readImage(file, done) {
      if (!file || !file.type.startsWith("image/")) return;
      const result = await loadCanvasReadyImage(file);
      const img = new Image();
      img.onload = () => done(img, result.dataUrl, file);
      img.src = result.dataUrl;
    }

    function loadLenticular(file, slot) {
      readImage(file, (img, data, original) => {
        lenticular[slot === "A" ? "imageA" : "imageB"] = img;
        lenticular[slot === "A" ? "dataA" : "dataB"] = data;
        $(slot === "A" ? "zoneA" : "zoneB").innerHTML = `<span><strong>Image ${slot}</strong>${escapeHtml(original.name)}</span>`;
        prepareLenticular();
        updateLenticularButtons();
        renderLenticular();
      });
    }

    function bindDrop(zone, handler) {
      zone.addEventListener("dragover", event => {
        event.preventDefault();
        zone.classList.add("drag-over");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
      zone.addEventListener("drop", event => {
        event.preventDefault();
        zone.classList.remove("drag-over");
        handler(event.dataTransfer.files[0]);
      });
    }

    function updateLenticularSize() {
      if ($("sizePreset").value === "custom") {
        lenticular.width = clamp(parseInt($("customWidth").value, 10) || 800, 100, 4000);
        lenticular.height = clamp(parseInt($("customHeight").value, 10) || 600, 100, 4000);
      } else {
        [lenticular.width, lenticular.height] = $("sizePreset").value.split("x").map(Number);
        $("customWidth").value = lenticular.width;
        $("customHeight").value = lenticular.height;
      }
      lCanvas.width = lenticular.width;
      lCanvas.height = lenticular.height;
      lCanvas.style.maxWidth = `${lenticular.width}px`;
      prepareLenticular();
      renderLenticular();
    }

    function scaleImageToCanvas(img, out, width, height) {
      out.width = width;
      out.height = height;
      const ctx = out.getContext("2d");
      const imgRatio = img.naturalWidth / img.naturalHeight;
      const canvasRatio = width / height;
      let w = width, h = height, x = 0, y = 0;
      if (imgRatio > canvasRatio) {
        h = height;
        w = h * imgRatio;
        x = (width - w) / 2;
      } else {
        w = width;
        h = w / imgRatio;
        y = (height - h) / 2;
      }
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, x, y, w, h);
    }

    function prepareLenticular() {
      if (!lenticular.imageA || !lenticular.imageB) return;
      scaleImageToCanvas(lenticular.imageA, lenticular.scaledA, lenticular.width, lenticular.height);
      scaleImageToCanvas(lenticular.imageB, lenticular.scaledB, lenticular.width, lenticular.height);
    }

    function renderLenticular() {
      lCtx.clearRect(0, 0, lenticular.width, lenticular.height);
      if (!lenticular.imageA || !lenticular.imageB) {
        lCtx.fillStyle = "#101010";
        lCtx.fillRect(0, 0, lenticular.width, lenticular.height);
        lCtx.fillStyle = "#a1a1aa";
        lCtx.font = "800 26px system-ui, sans-serif";
        lCtx.textAlign = "center";
        lCtx.textBaseline = "middle";
        lCtx.fillText("Upload two images", lenticular.width / 2, lenticular.height / 2);
        return;
      }
      const strip = lenticular.stripWidth;
      const cycle = strip * 2;
      for (let x = -cycle; x < lenticular.width + cycle; x += cycle) {
        drawLenticularStrip(lenticular.scaledA, x + lenticular.easedOffset, strip);
        drawLenticularStrip(lenticular.scaledB, x + strip + lenticular.easedOffset, strip);
      }
    }

    function drawLenticularStrip(source, dx, strip) {
      const sx = Math.max(0, Math.min(lenticular.width, dx));
      const visible = Math.max(0, Math.min(dx + strip, lenticular.width) - sx);
      if (!visible) return;
      lCtx.drawImage(source, sx, 0, visible, lenticular.height, sx, 0, visible, lenticular.height);
    }

    function updateLenticularButtons() {
      const ready = Boolean(lenticular.imageA && lenticular.imageB);
      $("lenticularDownload").disabled = !ready;
      $("lenticularCopy").disabled = !ready;
    }

    function buildLenticularSnippet() {
      return `<!-- genui lenticular embed -->\n<div class="genui-lenticular" data-strip="${lenticular.stripWidth}" style="max-width:${lenticular.width}px;margin:0 auto;"><canvas width="${lenticular.width}" height="${lenticular.height}" style="width:100%;display:block;"></canvas></div>\n<script>(()=>{const r=document.currentScript.previousElementSibling,c=r.querySelector("canvas"),x=c.getContext("2d"),s=+r.dataset.strip||10,a=new Image(),b=new Image(),ca=document.createElement("canvas"),cb=document.createElement("canvas");let t=0,o=0;a.src="${lenticular.dataA}";b.src="${lenticular.dataB}";c.addEventListener("mousemove",e=>{const q=c.getBoundingClientRect();t=((e.clientX-q.left)/q.width)*s});function sc(i,d){d.width=c.width;d.height=c.height;const g=d.getContext("2d"),ir=i.naturalWidth/i.naturalHeight,cr=c.width/c.height;let w=c.width,h=c.height,px=0,py=0;if(ir>cr){h=c.height;w=h*ir;px=(c.width-w)/2}else{w=c.width;h=w/ir;py=(c.height-h)/2}g.drawImage(i,px,py,w,h)}function ds(i,p){const sx=Math.max(0,Math.min(c.width,p)),w=Math.max(0,Math.min(p+s,c.width)-sx);if(w)x.drawImage(i,sx,0,w,c.height,sx,0,w,c.height)}function fr(){o+=(t-o)*.16;x.clearRect(0,0,c.width,c.height);for(let p=-s*2;p<c.width+s*2;p+=s*2){ds(ca,p+o);ds(cb,p+s+o)}requestAnimationFrame(fr)}let n=0;function ok(){if(++n===2){sc(a,ca);sc(b,cb);fr()}}a.onload=ok;b.onload=ok})();<\/script>`;
    }

    $("fileA").addEventListener("change", event => loadLenticular(event.target.files[0], "A"));
    $("fileB").addEventListener("change", event => loadLenticular(event.target.files[0], "B"));
    bindDrop($("zoneA"), file => loadLenticular(file, "A"));
    bindDrop($("zoneB"), file => loadLenticular(file, "B"));
    $("stripWidth").addEventListener("input", () => {
      lenticular.stripWidth = Number($("stripWidth").value);
      $("stripReadout").textContent = `${lenticular.stripWidth}px`;
    });
    $("sizePreset").addEventListener("change", () => {
      const custom = $("sizePreset").value === "custom";
      $("customWidth").disabled = !custom;
      $("customHeight").disabled = !custom;
      updateLenticularSize();
    });
    $("customWidth").addEventListener("input", updateLenticularSize);
    $("customHeight").addEventListener("input", updateLenticularSize);
    $("lenticularDownload").addEventListener("click", () => {
      renderLenticular();
      const link = document.createElement("a");
      link.download = "genui-lenticular.png";
      link.href = lCanvas.toDataURL("image/png");
      link.click();
    });
    $("lenticularCopy").addEventListener("click", async () => {
      const snippet = buildLenticularSnippet();
      try {
        await navigator.clipboard.writeText(snippet);
        setStatus($("lenticularStatus"), "Embed code copied.");
      } catch {
        console.log(snippet);
        setStatus($("lenticularStatus"), "Clipboard blocked. Snippet logged to console.");
      }
    });
    lCanvas.addEventListener("mousemove", event => {
      const rect = lCanvas.getBoundingClientRect();
      lenticular.hoverX = clamp((event.clientX - rect.left) / rect.width, 0, 1) * lenticular.width;
    });

    const palette = ["#fb7185", "#6ee7b7", "#fbbf24", "#a78bfa", "#38bdf8"];
    const parallax = {
      imageUrl: null,
      fileName: "",
      fileSize: 0,
      imageNaturalWidth: 0,
      imageNaturalHeight: 0,
      layers: [],
      mode: "select",
      isDrawing: false,
      drawStart: { x: 0, y: 0 },
      mouse: { x: 0, y: 0 },
      scrollOffset: 0,
      orientation: { x: 0, y: 0 }
    };
    const sam = {
      worker: null,
      active: false,
      negative: false,
      busy: false,
      loaded: false,
      requestId: 0,
      currentRequestId: "",
      timeoutId: 0,
      points: [],
      mask: null,
      maskUrl: "",
      score: null
    };

    const pStage = $("parallaxStage");
    const coarsePointer = matchMedia("(pointer: coarse)").matches;
    $("mobileNotice").classList.toggle("hidden", !coarsePointer);

    function stageScale() {
      const rect = pStage.getBoundingClientRect();
      return {
        x: parallax.imageNaturalWidth / Math.max(1, rect.width),
        y: parallax.imageNaturalHeight / Math.max(1, rect.height),
        rect
      };
    }

    function naturalToDisplay(layer) {
      const rect = pStage.getBoundingClientRect();
      return {
        x: layer.x / parallax.imageNaturalWidth * rect.width,
        y: layer.y / parallax.imageNaturalHeight * rect.height,
        width: layer.width / parallax.imageNaturalWidth * rect.width,
        height: layer.height / parallax.imageNaturalHeight * rect.height
      };
    }

    function setParallaxBackground(image) {
      if (!image) return;

      resetSamSelection();
      parallax.imageUrl = image.dataUrl;
      parallax.fileName = image.file.name;
      parallax.fileSize = image.file.size;
      parallax.imageNaturalWidth = image.width;
      parallax.imageNaturalHeight = image.height;
      parallax.layers = [];
      useLayerStore.getState().setBackground(image.imageData, image.width, image.height, image.dataUrl);
      pStage.classList.remove("empty");
      pStage.style.aspectRatio = `${image.width} / ${image.height}`;
      pStage.style.minHeight = "0";
      setParallaxMode("select");
      updateParallaxControls();
      renderLayers();
      setStatus($("parallaxStatus"), `${image.file.name} loaded.`);
      updateSizeWarning();
    }

    async function loadParallax(file) {
      if (!file || !file.type.startsWith("image/")) return;
      const image = await loadCanvasReadyImage(file);
      setParallaxBackground(image);
    }

    function loadParallaxUpload(event) {
      if (event.detail?.image) {
        setParallaxBackground(event.detail.image);
        return;
      }

      loadParallax(event.detail?.file);
    }

    window.addEventListener("genui:parallax-upload", loadParallaxUpload);

    /*
      Kept for stage drops only. The React Upload component owns the #parallaxFile
      input and dispatches genui:parallax-upload with the decoded image payload.
    */
    function loadParallaxFromStageDrop(file) {
      loadParallax(file);
    }

    function setParallaxMode(mode) {
      parallax.mode = mode;
      useLayerStore.getState().setMode(mode === "preview" ? "preview" : "edit");
      $("selectMode").classList.toggle("active", mode === "select");
      $("previewMode").classList.toggle("active", mode === "preview");
      renderLayers();
    }

    function addLayer(rect) {
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
      useLayerStore.getState().addLayer({
        id,
        name: `Layer ${useLayerStore.getState().layers.length + 1}`,
        image: null,
        src: parallax.imageUrl,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        sourceRect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        depth: 0.5,
        opacity: 0.9
      });
      parallax.layers.unshift({
        id,
        name: `Layer ${parallax.layers.length + 1}`,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        depth: 0.5,
        opacity: 0.9,
        blurOnDepth: true,
        color: palette[parallax.layers.length % palette.length]
      });
      renderLayers();
      renderLayerPanel();
      updateParallaxControls();
    }

    function addSamLayer() {
      if (!sam.mask || !parallax.imageUrl) return;
      const maskUrl = sam.maskUrl || maskToUrl(sam.mask.data, sam.mask.width, sam.mask.height);

      const name = `SAM Layer ${parallax.layers.length + 1}`;
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
      parallax.layers.unshift({
        id,
        name,
        x: 0,
        y: 0,
        width: parallax.imageNaturalWidth,
        height: parallax.imageNaturalHeight,
        depth: 0.8,
        opacity: 0.95,
        blurOnDepth: true,
        color: palette[parallax.layers.length % palette.length],
        maskUrl
      });
      useLayerStore.getState().addLayer({
        id,
        name,
        image: useLayerStore.getState().background.image,
        src: parallax.imageUrl,
        width: parallax.imageNaturalWidth,
        height: parallax.imageNaturalHeight,
        mask: sam.mask,
        depth: 0.8,
        opacity: 0.95
      });
      resetSamSelection();
      renderLayers();
      renderLayerPanel();
      updateParallaxControls();
      setStatus($("parallaxStatus"), "Mask committed as layer.");
    }

    function setSamStatus(message, isError = false) {
      const status = $("samStatus");
      status.textContent = message;
      status.className = isError ? "warn" : "hint";
    }

    function updateSamControls() {
      const hasImage = Boolean(parallax.imageUrl);
      $("samSelect").disabled = !hasImage || sam.busy;
      $("samNegative").disabled = !hasImage || sam.busy || !sam.active;
      $("commitSamLayer").disabled = !hasImage || sam.busy || !sam.mask;
      $("clearSamSelection").disabled = !hasImage || sam.busy || (!sam.mask && !sam.points.length);
      $("samSelect").classList.toggle("active", sam.active && !sam.negative);
      $("samNegative").classList.toggle("active", sam.active && sam.negative);
    }

    function ensureSamWorker() {
      if (sam.worker) return sam.worker;

      sam.worker = new SamWorker();
      sam.worker.addEventListener("error", event => {
        clearSamBusy();
        setSamStatus(event.message || "SAM worker failed.", true);
        updateSamControls();
      });
      sam.worker.addEventListener("messageerror", () => {
        clearSamBusy();
        setSamStatus("SAM worker returned unreadable data.", true);
        updateSamControls();
      });
      sam.worker.addEventListener("message", event => {
        const data = event.data;

        if (data.type === "status") {
          setSamStatus(data.message || "SAM working...");
          return;
        }

        if (data.type === "ready") {
          sam.loaded = true;
          if (!sam.currentRequestId || !sam.busy) {
            sam.busy = false;
            window.clearTimeout(sam.timeoutId);
            setSamStatus("SAM ready. Click image to select object.");
          } else {
            setSamStatus("SAM ready. Segmenting object...");
          }
          updateSamControls();
          return;
        }

        if (data.type === "mask") {
          if (data.id && data.id !== sam.currentRequestId) return;
          sam.busy = false;
          sam.currentRequestId = "";
          window.clearTimeout(sam.timeoutId);
          sam.mask = {
            id: data.id || `mask-${Date.now()}`,
            width: data.width,
            height: data.height,
            data: data.mask
          };
          sam.maskUrl = maskToUrl(sam.mask.data, sam.mask.width, sam.mask.height);
          sam.score = data.score;
          useLayerStore.getState().setSelectionMask(sam.mask);
          useLayerStore.getState().setSelectionBusy(false);
          renderSamPreview();
          const percent = typeof data.score === "number" ? ` ${(data.score * 100).toFixed(0)}%` : "";
          setSamStatus(`Mask ready.${percent}`);
          updateSamControls();
          return;
        }

        if (data.type === "error") {
          if (data.id && sam.currentRequestId && data.id !== sam.currentRequestId) return;
          sam.busy = false;
          sam.currentRequestId = "";
          window.clearTimeout(sam.timeoutId);
          useLayerStore.getState().setSelectionError(data.message);
          setSamStatus(data.message || "SAM failed.", true);
          updateSamControls();
        }
      });
      sam.worker.postMessage({ type: "load", id: "sam-load" });
      sam.busy = true;
      setSamStatus("Loading SAM model...");
      updateSamControls();
      return sam.worker;
    }

    function clearSamBusy() {
      sam.busy = false;
      sam.currentRequestId = "";
      window.clearTimeout(sam.timeoutId);
      useLayerStore.getState().setSelectionBusy(false);
    }

    function maskToUrl(mask, width, height) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const image = ctx.createImageData(width, height);
      for (let index = 0; index < mask.length; index += 1) {
        const offset = index * 4;
        const alpha = mask[index];
        image.data[offset] = 17;
        image.data[offset + 1] = 17;
        image.data[offset + 2] = 17;
        image.data[offset + 3] = alpha;
      }
      ctx.putImageData(image, 0, 0);
      return canvas.toDataURL("image/png");
    }

    function renderSamPreview() {
      if (sam.mask) {
        sam.maskUrl = maskToUrl(sam.mask.data, sam.mask.width, sam.mask.height);
      }
    }

    function resetSamSelection() {
      sam.points = [];
      sam.mask = null;
      sam.maskUrl = "";
      sam.score = null;
      useLayerStore.getState().resetSelection();
      if (pStage) {
        pStage.querySelectorAll(".sam-mask-preview,.sam-point").forEach(el => el.remove());
      }
      if ($("samStatus")) setSamStatus(parallax.imageUrl ? "Click SAM Select, then click object." : "Upload image to select objects.");
      updateSamControls();
    }

    function requestSamMask() {
      const background = useLayerStore.getState().background;
      if (!background.image || !("data" in background.image) || !sam.points.length) return;

      const worker = ensureSamWorker();
      const id = `sam-${++sam.requestId}`;
      sam.currentRequestId = id;
      sam.busy = true;
      useLayerStore.getState().setSelectionBusy(true);
      useLayerStore.getState().setSelectionPoints(sam.points.map(point => ({
        id: `point-${point.x}-${point.y}-${point.label}-${id}`,
        x: point.x,
        y: point.y,
        type: point.label === 0 ? "negative" : "positive"
      })));
      setSamStatus(sam.loaded ? "Segmenting object..." : "Loading SAM model...");
      updateSamControls();
      window.clearTimeout(sam.timeoutId);
      sam.timeoutId = window.setTimeout(() => {
        if (sam.currentRequestId !== id || !sam.busy) return;
        clearSamBusy();
        setSamStatus("SAM timed out. Try a smaller image or reload model.", true);
        updateSamControls();
      }, sam.loaded ? 90000 : 180000);
      worker.postMessage({
        type: "segment",
        id,
        imageData: {
          data: new Uint8ClampedArray(background.image.data),
          width: background.width,
          height: background.height
        },
        clicks: sam.points
      });
    }

    function addSamPoint(event) {
      const rect = pStage.getBoundingClientRect();
      sam.points.push({
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        label: sam.negative ? 0 : 1
      });
      renderSamPreview();
      requestSamMask();
    }

    function renderLayers() {
      pStage.querySelectorAll(".draw-rect").forEach(el => el.remove());
      renderSamPreview();
    }

    function renderLayerPanel() {
      return;
    }

    function updateLayerFromControl(id, target, card) {
      const layer = parallax.layers.find(item => item.id === id);
      if (!layer) return;
      if (target.dataset.action === "name") layer.name = target.value;
      if (target.dataset.action === "depth") layer.depth = Number(target.value);
      if (target.dataset.action === "opacity") layer.opacity = Number(target.value);
      if (target.dataset.action === "blur") layer.blurOnDepth = target.checked;
      const rows = card.querySelectorAll(".mini-row");
      rows[0].lastElementChild.textContent = layer.depth.toFixed(1);
      rows[1].lastElementChild.textContent = `${Math.round(layer.opacity * 100)}%`;
      renderLayers();
    }

    function handleLayerButton(id, action) {
      const index = parallax.layers.findIndex(item => item.id === id);
      if (index < 0) return;
      if (action === "delete") parallax.layers.splice(index, 1);
      if (action === "up" && index > 0) [parallax.layers[index - 1], parallax.layers[index]] = [parallax.layers[index], parallax.layers[index - 1]];
      if (action === "down" && index < parallax.layers.length - 1) [parallax.layers[index + 1], parallax.layers[index]] = [parallax.layers[index], parallax.layers[index + 1]];
      renderLayers();
      renderLayerPanel();
      updateParallaxControls();
    }

    function applyParallax() {
      const rect = pStage.getBoundingClientRect();
      const maxShift = 28;
      const sourceX = coarsePointer ? parallax.orientation.x : parallax.mouse.x;
      const sourceY = coarsePointer ? parallax.orientation.y : parallax.mouse.y;
      parallax.layers.forEach(layer => {
        const el = pStage.querySelector(`.parallax-layer[data-id="${CSS.escape(layer.id)}"]`);
        if (!el) return;
        const active = parallax.mode === "preview";
        const x = active ? sourceX * layer.depth * maxShift : 0;
        const y = active ? (sourceY * layer.depth * maxShift) + (parallax.scrollOffset * layer.depth * 0.3) : 0;
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.style.backgroundSize = `${rect.width}px ${rect.height}px`;
      });
    }

    function updateParallaxControls() {
      const hasImage = Boolean(parallax.imageUrl);
      $("exportParallax").disabled = !hasImage;
      $("addWholeLayer").disabled = !hasImage;
      $("clearLayers").disabled = !useLayerStore.getState().layers.length;
      renderLayerPanel();
    }

    function updateSizeWarning() {
      $("sizeWarning").textContent = parallax.fileSize > 500 * 1024
        ? "Image is over 500KB. Base64 embed may slow blog pages; host image separately for production."
        : "";
    }

    function buildParallaxSnippet() {
      const snapshot = useLayerStore.getState();
      const layers = snapshot.layers.map(layer => ({
        name: layer.name,
        x: layer.sourceRect?.x ?? 0,
        y: layer.sourceRect?.y ?? 0,
        width: layer.sourceRect?.width ?? layer.width,
        height: layer.sourceRect?.height ?? layer.height,
        depth: layer.depth,
        opacity: layer.opacity,
        blurOnDepth: true,
        maskUrl: layer.mask ? maskToUrl(layer.mask.data, layer.mask.width, layer.mask.height) : ""
      }));
      const image = snapshot.background.src;
      const width = snapshot.background.width;
      const height = snapshot.background.height;
      return `<!-- genui parallax image embed -->\n<div class="genui-parallax" style="position:relative;overflow:hidden;width:100%;max-width:${width}px;aspect-ratio:${width}/${height};margin:0 auto;background:#111;">\n  <img src="${image}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;">\n</div>\n<script>(()=>{const root=document.currentScript.previousElementSibling,img=${JSON.stringify(image)},natural={w:${width},h:${height}},layers=${JSON.stringify(layers)};let mx=0,my=0,scroll=0;layers.slice().reverse().forEach((l,i)=>{const d=document.createElement("div");d.style.cssText="position:absolute;overflow:hidden;pointer-events:none;background-repeat:no-repeat;will-change:transform;transition:transform .1s ease-out;";d.dataset.i=i;root.append(d)});function draw(){const r=root.getBoundingClientRect();layers.slice().reverse().forEach((l,i)=>{const d=root.querySelector('[data-i="'+i+'"]'),masked=!!l.maskUrl,x=masked?0:l.x/natural.w*r.width,y=masked?0:l.y/natural.h*r.height,w=masked?r.width:l.width/natural.w*r.width,h=masked?r.height:l.height/natural.h*r.height;d.style.left=x+"px";d.style.top=y+"px";d.style.width=w+"px";d.style.height=h+"px";d.style.backgroundImage='url("'+img+'")';d.style.backgroundSize=masked?r.width+"px "+r.height+"px":r.width+"px "+r.height+"px";d.style.backgroundPosition=masked?"0 0":-x+"px "+-y+"px";d.style.opacity=l.opacity;d.style.filter=l.blurOnDepth&&Math.abs(l.depth)>1?"blur("+Math.min(2,Math.abs(l.depth)-.5)+"px)":"none";d.style.maskImage=l.maskUrl?'url("'+l.maskUrl+'")':"";d.style.maskSize=l.maskUrl?"100% 100%":"";d.style.webkitMaskImage=d.style.maskImage;d.style.webkitMaskSize=d.style.maskSize;d.style.transform="translate("+(mx*l.depth*28)+"px,"+((my*l.depth*28)+(scroll*l.depth*.3))+"px)"})}root.addEventListener("mousemove",e=>{const r=root.getBoundingClientRect();mx=((e.clientX-r.left)-r.width/2)/(r.width/2);my=((e.clientY-r.top)-r.height/2)/(r.height/2);draw()});addEventListener("scroll",()=>{scroll=scrollY;draw()},{passive:true});addEventListener("resize",draw);draw()})();<\/script>`;
    }

    bindDrop(pStage, loadParallaxFromStageDrop);
    $("selectMode").addEventListener("click", () => setParallaxMode("select"));
    $("previewMode").addEventListener("click", () => setParallaxMode("preview"));
    $("scrollSim").addEventListener("input", () => {
      parallax.scrollOffset = Number($("scrollSim").value);
      $("scrollReadout").textContent = String(parallax.scrollOffset);
      applyParallax();
    });
    $("clearLayers").addEventListener("click", () => {
      parallax.layers = [];
      useLayerStore.getState().clearLayers();
      renderLayers();
      updateParallaxControls();
    });
    $("exportParallax").addEventListener("click", async () => {
      const snippet = buildParallaxSnippet();
      $("embedOutput").value = snippet;
      try {
        await navigator.clipboard.writeText(snippet);
        setStatus($("parallaxStatus"), "Embed code copied.");
      } catch {
        setStatus($("parallaxStatus"), "Snippet generated.");
      }
    });
    $("samSelect").addEventListener("click", () => {
      if (!parallax.imageUrl) return;
      sam.active = !sam.active || sam.negative;
      sam.negative = false;
      setParallaxMode("select");
      if (sam.active) ensureSamWorker();
      setSamStatus(sam.active ? "Click object to create mask." : "SAM selection paused.");
      updateSamControls();
    });
    $("samNegative").addEventListener("click", () => {
      if (!parallax.imageUrl) return;
      sam.active = true;
      sam.negative = !sam.negative;
      setSamStatus(sam.negative ? "Click areas to exclude." : "Click object to include.");
      updateSamControls();
    });
    $("commitSamLayer").addEventListener("click", addSamLayer);
    $("clearSamSelection").addEventListener("click", resetSamSelection);
    pStage.addEventListener("pointerdown", event => {
      if (!parallax.imageUrl || parallax.mode !== "select" || coarsePointer) return;
      if (sam.active) {
        addSamPoint(event);
        return;
      }
      const scale = stageScale();
      parallax.isDrawing = true;
      parallax.drawStart = { x: (event.clientX - scale.rect.left) * scale.x, y: (event.clientY - scale.rect.top) * scale.y };
      pStage.setPointerCapture(event.pointerId);
    });
    pStage.addEventListener("pointermove", event => {
      if (!parallax.imageUrl) return;
      const rect = pStage.getBoundingClientRect();
      parallax.mouse.x = clamp(((event.clientX - rect.left) - rect.width / 2) / (rect.width / 2), -1, 1);
      parallax.mouse.y = clamp(((event.clientY - rect.top) - rect.height / 2) / (rect.height / 2), -1, 1);
      applyParallax();
      if (!parallax.isDrawing) return;
      const scale = stageScale();
      const end = { x: (event.clientX - scale.rect.left) * scale.x, y: (event.clientY - scale.rect.top) * scale.y };
      const natural = {
        x: clamp(Math.min(parallax.drawStart.x, end.x), 0, parallax.imageNaturalWidth),
        y: clamp(Math.min(parallax.drawStart.y, end.y), 0, parallax.imageNaturalHeight),
        width: Math.abs(end.x - parallax.drawStart.x),
        height: Math.abs(end.y - parallax.drawStart.y)
      };
      let draw = pStage.querySelector(".draw-rect");
      if (!draw) {
        draw = document.createElement("div");
        draw.className = "draw-rect";
        pStage.append(draw);
      }
      const box = naturalToDisplay(natural);
      draw.style.left = `${box.x}px`;
      draw.style.top = `${box.y}px`;
      draw.style.width = `${box.width}px`;
      draw.style.height = `${box.height}px`;
    });
    pStage.addEventListener("pointerup", event => {
      if (!parallax.isDrawing) return;
      parallax.isDrawing = false;
      const draw = pStage.querySelector(".draw-rect");
      if (draw) draw.remove();
      const scale = stageScale();
      const end = { x: (event.clientX - scale.rect.left) * scale.x, y: (event.clientY - scale.rect.top) * scale.y };
      const rect = {
        x: clamp(Math.min(parallax.drawStart.x, end.x), 0, parallax.imageNaturalWidth),
        y: clamp(Math.min(parallax.drawStart.y, end.y), 0, parallax.imageNaturalHeight),
        width: clamp(Math.abs(end.x - parallax.drawStart.x), 0, parallax.imageNaturalWidth),
        height: clamp(Math.abs(end.y - parallax.drawStart.y), 0, parallax.imageNaturalHeight)
      };
      if (rect.width < 20 || rect.height < 20) {
        setStatus($("parallaxStatus"), "Selection too small.");
        return;
      }
      addLayer(rect);
    });
    window.addEventListener("resize", renderLayers);
    window.addEventListener("deviceorientation", event => {
      parallax.orientation.x = clamp((event.gamma || 0) / 30, -1, 1);
      parallax.orientation.y = clamp((event.beta || 0) / 30, -1, 1);
      applyParallax();
    });

    function lenticularFrame() {
      lenticular.targetOffset = (lenticular.hoverX / Math.max(1, lenticular.width)) * lenticular.stripWidth;
      lenticular.easedOffset += (lenticular.targetOffset - lenticular.easedOffset) * 0.16;
      renderLenticular();
      requestAnimationFrame(lenticularFrame);
    }

    updateLenticularSize();
    updateLenticularButtons();
    updateParallaxControls();
    requestAnimationFrame(lenticularFrame);
}
