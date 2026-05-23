// @ts-nocheck
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadCanvasReadyImage } from './utils/image';

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

    function loadParallax(file) {
      readImage(file, (img, data, original) => {
        parallax.imageUrl = data;
        parallax.fileName = original.name;
        parallax.fileSize = original.size;
        parallax.imageNaturalWidth = img.naturalWidth;
        parallax.imageNaturalHeight = img.naturalHeight;
        parallax.layers = [];
        pStage.classList.remove("empty");
        pStage.innerHTML = "";
        pStage.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        pStage.style.minHeight = "0";
        const base = document.createElement("img");
        base.className = "base-img";
        base.src = data;
        base.alt = "";
        pStage.append(base);
        setParallaxMode("select");
        updateParallaxControls();
        renderLayers();
        setStatus($("parallaxStatus"), `${original.name} loaded.`);
        updateSizeWarning();
      });
    }

    window.addEventListener("genui:parallax-upload", event => loadParallax(event.detail.file));

    function setParallaxMode(mode) {
      parallax.mode = mode;
      $("selectMode").classList.toggle("active", mode === "select");
      $("previewMode").classList.toggle("active", mode === "preview");
      renderLayers();
    }

    function addLayer(rect) {
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
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

    function renderLayers() {
      if (!parallax.imageUrl) return;
      pStage.querySelectorAll(".parallax-layer,.selection,.draw-rect").forEach(el => el.remove());
      [...parallax.layers].reverse().forEach((layer, index) => {
        const box = naturalToDisplay(layer);
        const piece = document.createElement("div");
        piece.className = "parallax-layer";
        piece.dataset.id = layer.id;
        piece.style.left = `${box.x}px`;
        piece.style.top = `${box.y}px`;
        piece.style.width = `${box.width}px`;
        piece.style.height = `${box.height}px`;
        piece.style.inset = "auto";
        piece.style.backgroundImage = `url("${parallax.imageUrl}")`;
        piece.style.backgroundSize = `${pStage.clientWidth}px ${pStage.clientHeight}px`;
        piece.style.backgroundPosition = `-${box.x}px -${box.y}px`;
        piece.style.opacity = layer.opacity;
        piece.style.zIndex = String(20 + index);
        piece.style.filter = layer.blurOnDepth && Math.abs(layer.depth) > 1 ? `blur(${Math.min(2, Math.abs(layer.depth) - 0.5)}px)` : "none";
        pStage.append(piece);

        if (parallax.mode === "select") {
          const marker = document.createElement("div");
          marker.className = "selection";
          marker.style.left = `${box.x}px`;
          marker.style.top = `${box.y}px`;
          marker.style.width = `${box.width}px`;
          marker.style.height = `${box.height}px`;
          marker.style.color = layer.color;
          marker.style.zIndex = String(100 + index);
          marker.innerHTML = `<span>${escapeHtml(layer.name)}</span>`;
          pStage.append(marker);
        }
      });
      applyParallax();
    }

    function renderLayerPanel() {
      const list = $("layersList");
      list.innerHTML = "";
      if (!parallax.layers.length) {
        list.innerHTML = `<p class="hint">No layers yet. Draw rectangles on image.</p>`;
        return;
      }
      parallax.layers.forEach((layer, index) => {
        const card = document.createElement("div");
        card.className = "layer-card";
        card.innerHTML = `
          <div class="layer-head">
            <span class="swatch" style="--c:${layer.color}"></span>
            <input type="text" value="${escapeHtml(layer.name)}" data-action="name" aria-label="Layer name">
            <button class="icon-btn" type="button" data-action="up" title="Move up">↑</button>
            <button class="icon-btn" type="button" data-action="down" title="Move down">↓</button>
            <button class="icon-btn danger" type="button" data-action="delete" title="Delete">×</button>
          </div>
          <div class="mini-row"><label>Depth<input type="range" min="-2" max="2" step="0.1" value="${layer.depth}" data-action="depth"></label><span>${layer.depth.toFixed(1)}</span></div>
          <div class="mini-row"><label>Opacity<input type="range" min="0.5" max="1" step="0.05" value="${layer.opacity}" data-action="opacity"></label><span>${Math.round(layer.opacity * 100)}%</span></div>
          <label class="check-row"><input type="checkbox" data-action="blur" ${layer.blurOnDepth ? "checked" : ""}> Blur on depth</label>
        `;
        card.addEventListener("input", event => updateLayerFromControl(layer.id, event.target, card));
        card.addEventListener("click", event => handleLayerButton(layer.id, event.target.dataset.action));
        list.append(card);
      });
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
      $("clearLayers").disabled = !parallax.layers.length;
      renderLayerPanel();
    }

    function updateSizeWarning() {
      $("sizeWarning").textContent = parallax.fileSize > 500 * 1024
        ? "Image is over 500KB. Base64 embed may slow blog pages; host image separately for production."
        : "";
    }

    function buildParallaxSnippet() {
      const layers = parallax.layers.map(layer => ({
        name: layer.name,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        depth: layer.depth,
        opacity: layer.opacity,
        blurOnDepth: layer.blurOnDepth
      }));
      const image = parallax.imageUrl;
      const width = parallax.imageNaturalWidth;
      const height = parallax.imageNaturalHeight;
      return `<!-- genui parallax image embed -->\n<div class="genui-parallax" style="position:relative;overflow:hidden;width:100%;max-width:${width}px;aspect-ratio:${width}/${height};margin:0 auto;background:#111;">\n  <img src="${image}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;">\n</div>\n<script>(()=>{const root=document.currentScript.previousElementSibling,img=${JSON.stringify(image)},natural={w:${width},h:${height}},layers=${JSON.stringify(layers)};let mx=0,my=0,scroll=0;layers.slice().reverse().forEach((l,i)=>{const d=document.createElement("div");d.style.cssText="position:absolute;overflow:hidden;pointer-events:none;background-repeat:no-repeat;will-change:transform;transition:transform .1s ease-out;";d.dataset.i=i;root.append(d)});function draw(){const r=root.getBoundingClientRect();layers.slice().reverse().forEach((l,i)=>{const d=root.querySelector('[data-i="'+i+'"]'),x=l.x/natural.w*r.width,y=l.y/natural.h*r.height,w=l.width/natural.w*r.width,h=l.height/natural.h*r.height;d.style.left=x+"px";d.style.top=y+"px";d.style.width=w+"px";d.style.height=h+"px";d.style.backgroundImage='url("'+img+'")';d.style.backgroundSize=r.width+"px "+r.height+"px";d.style.backgroundPosition=-x+"px "+-y+"px";d.style.opacity=l.opacity;d.style.filter=l.blurOnDepth&&Math.abs(l.depth)>1?"blur("+Math.min(2,Math.abs(l.depth)-.5)+"px)":"none";d.style.transform="translate("+(mx*l.depth*28)+"px,"+((my*l.depth*28)+(scroll*l.depth*.3))+"px)"})}root.addEventListener("mousemove",e=>{const r=root.getBoundingClientRect();mx=((e.clientX-r.left)-r.width/2)/(r.width/2);my=((e.clientY-r.top)-r.height/2)/(r.height/2);draw()});addEventListener("scroll",()=>{scroll=scrollY;draw()},{passive:true});addEventListener("resize",draw);draw()})();<\/script>`;
    }

    $("parallaxFile").addEventListener("change", event => loadParallax(event.target.files[0]));
    bindDrop(pStage, file => loadParallax(file));
    $("selectMode").addEventListener("click", () => setParallaxMode("select"));
    $("previewMode").addEventListener("click", () => setParallaxMode("preview"));
    $("scrollSim").addEventListener("input", () => {
      parallax.scrollOffset = Number($("scrollSim").value);
      $("scrollReadout").textContent = String(parallax.scrollOffset);
      applyParallax();
    });
    $("addWholeLayer").addEventListener("click", () => addLayer({ x: 0, y: 0, width: parallax.imageNaturalWidth, height: parallax.imageNaturalHeight }));
    $("clearLayers").addEventListener("click", () => {
      parallax.layers = [];
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
    pStage.addEventListener("pointerdown", event => {
      if (!parallax.imageUrl || parallax.mode !== "select" || coarsePointer) return;
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
