/* ============================================================
   STATERO CREATIVE STUDIO — Results screen
   Grid of generated creatives, grouped by category, each with
   Google / platform compliance checks. Download = simulated.
   ============================================================ */

function statusGlyph(state){ return state==="ok" ? "✓" : state==="warn" ? "!" : "✕"; }
function statusWord(status){ return status==="pass" ? "Passed" : status==="warn" ? "Warnings" : "Failed"; }

/* ---------- file naming: Statero-{W}x{H}-{platform}-{lang}.png ---------- */
function slugify(s){
  return (s||"").toLowerCase()
    .replace(/[\/&]+/g," ")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"");
}
function creativeFileName(c, ext){
  return `Statero-${c.fmt.w}x${c.fmt.h}-${slugify(c.fmt.name)}-${c.lang.id}.${ext || "png"}`;
}

/* ---------- ZIP export ----------
   Each creative is re-rendered off-screen at its NATIVE resolution
   (scale = 1), rasterised to PNG via an SVG <foreignObject> (images
   inlined as data URLs, cached so brand assets + the source photo are
   only fetched once), then packed into a ZIP foldered by platform with
   correctly-named files: Statero-{W}x{H}-{platform}-{lang}.png */
function waitForImages(node){
  const imgs = [...node.querySelectorAll("img")];
  return Promise.all(imgs.map(img => (img.complete && img.naturalWidth)
    ? Promise.resolve()
    : new Promise(res => { img.onload = img.onerror = res; })));
}
const _dataUrlCache = {};
function imgToDataURL(src){
  if(_dataUrlCache[src]) return _dataUrlCache[src];
  const p = (async ()=>{
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((ok,err)=>{
      const fr = new FileReader();
      fr.onload = ()=>ok(fr.result); fr.onerror = ()=>err(new Error("read"));
      fr.readAsDataURL(blob);
    });
  })();
  _dataUrlCache[src] = p;
  return p;
}
function loadImage(src, ms){
  return new Promise((ok,err)=>{
    const img = new Image();
    const to = setTimeout(()=>err(new Error("image timeout")), ms || 15000);
    img.onload = ()=>{ clearTimeout(to); ok(img); };
    img.onerror = ()=>{ clearTimeout(to); err(new Error("image load")); };
    img.src = src;
  });
}

/* ---------- font embedding ----------
   The SVG <foreignObject> is rasterised in an isolated context that can't
   see the page's webfonts, so we embed the actual font files — subsetted
   to just the glyphs used (via Google Fonts' text= param) and inlined as
   data URLs. Built once per export and cached. */
let _fontCss = null, _fontCssKey = "";
const FONT_FAMILIES = [
  "Readex+Pro:wght@300;400;500;600;700",
  "Noto+Sans+Arabic:wght@400;500;600;700",
  "Noto+Sans+SC:wght@400;500;700",
];
async function buildFontEmbedCSS(texts){
  const base = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;%\u2013\u2012-'\u2019\"&()@/+\u20ac$";
  const charSet = Array.from(new Set((base + (texts||[]).join("")).split(""))).join("");
  const key = charSet.split("").sort().join("");
  if(_fontCss != null && _fontCssKey === key) return _fontCss;
  let css = "";
  for(const fam of FONT_FAMILIES){
    try{
      const u = `https://fonts.googleapis.com/css2?family=${fam}&text=${encodeURIComponent(charSet)}`;
      let txt = await (await fetch(u)).text();
      const urls = Array.from(new Set([...txt.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(m=>m[1])));
      for(const fu of urls){
        try{ const d = await imgToDataURL(fu); txt = txt.split(fu).join(d); }catch(_){}
      }
      css += txt + "\n";
    }catch(_){ /* family unavailable — skip, fall back */ }
  }
  _fontCss = css; _fontCssKey = key;
  try{ await registerEmbeddedFonts(css); }catch(_){}
  return css;
}

/* Register the inlined @font-face subsets into document.fonts. The SVG
   <foreignObject> rasteriser only reliably uses a webfont's true metrics when
   the browser already has that exact font decoded — otherwise it silently
   falls back to a wider system font, so auto-fitted headlines that were sized
   against Readex Pro reflow to an extra line and overflow on tight banners.
   Priming document.fonts with the same data-URL subsets fixes that. */
const _fontReg = {};
async function registerEmbeddedFonts(css){
  if(!css || typeof FontFace === "undefined" || !document.fonts) return;
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  const jobs = [];
  for(const b of blocks){
    const fam = (b.match(/font-family:\s*['"]?([^;'"]+)['"]?/i) || [])[1];
    const src = (b.match(/url\((data:[^)]+)\)/i) || [])[1];
    if(!fam || !src) continue;
    const weight = (b.match(/font-weight:\s*([^;]+)/i) || [])[1] || "400";
    const style  = (b.match(/font-style:\s*([^;]+)/i) || [])[1] || "normal";
    const key = fam + "|" + weight.trim() + "|" + src.length;
    if(_fontReg[key]) continue;
    _fontReg[key] = true;
    try{
      const ff = new FontFace(fam.trim(), `url(${src})`, { weight: weight.trim(), style: style.trim() });
      jobs.push(ff.load().then(loaded => document.fonts.add(loaded)).catch(()=>{}));
    }catch(_){}
  }
  await Promise.all(jobs);
  try{ await document.fonts.ready; }catch(_){}
}
function fontStackFor(langId){
  if(langId === "zh") return '"Noto Sans SC", "Readex Pro", sans-serif';
  if(langId === "ar") return '"Readex Pro", "Noto Sans Arabic", sans-serif';
  return '"Readex Pro", system-ui, sans-serif';
}

/* ---------- canvas helpers for direct bitmap compositing ---------- */
function _parseRadius(str, w, h){
  if(!str) return 0;
  if(str.indexOf("%") !== -1) return Math.min(w,h) * (parseFloat(str)/100);
  return parseFloat(str) || 0;
}
function _roundRectPath(ctx, x, y, w, h, r){
  r = Math.max(0, Math.min(r, w/2, h/2));
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
  ctx.closePath();
}

/* Find the flat field element: the first solid-background <div> down the
   firstElementChild chain (the node may be an outer wrapper / transform layer
   with no background of its own). Returns the element and its depth so the
   matching element can be cleared in the clone. */
function _fieldChain(node){
  let el = node, depth = 0;
  while(el){
    const cs = getComputedStyle(el);
    if(cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") return { el, depth };
    const ch = el.firstElementChild;
    if(!ch || ch.tagName !== "DIV") break;
    el = ch; depth++;
  }
  return { el:null, depth:-1 };
}

/* Rasterise a creative to PNG.
   This engine does NOT paint <img> (or CSS background-image) through an SVG
   <foreignObject>, so we composite in layers onto the canvas directly:
     1. flat field colour (fillRect)
     2. every <img> bitmap via drawImage — in DOM order, honouring object-fit:
        cover, border-radius (clip) and opacity
     3. the text / CSS-shape / gradient layer via a single foreignObject whose
        flat field colour is cleared (so it doesn't repaint over the bitmaps)
        and whose <img>s are hidden — leaving only text, CTA pills, scrims,
        waves and cut-outs to paint over the composited bitmaps. */
/* ---------- freeze text wrapping for the rasteriser ----------
   The export paints the text layer by serialising the creative into an SVG
   <foreignObject> and loading it as an image. That image is laid out by the
   browser's SVG renderer, which does NOT reliably reproduce the on-page line
   breaking for `text-wrap: balance` / `-webkit-line-clamp` / flex text — so on
   tight banner formats (300×250, 300×600, 320×100…) the headline re-wraps to an
   extra line and overflows, even though the live preview is correct.

   To make the export match the preview in every browser we read the EXACT line
   breaks the user sees in the live DOM and bake them into the clone as
   non-wrapping block lines, so the SVG renderer can't re-flow them. */
const _esc = (s)=> s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

function _measureLines(el){
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const lines = [];
  let cur = null, curTop = null;
  const add = (text, color, weight)=>{
    if(!cur){ cur = { segs:[], top:curTop }; lines.push(cur); }
    const last = cur.segs[cur.segs.length-1];
    if(last && last.color===color && last.weight===weight) last.text += text;
    else cur.segs.push({ text, color, weight });
  };
  let node;
  while((node = walker.nextNode())){
    const pcs = getComputedStyle(node.parentElement);
    const color = pcs.color, weight = pcs.fontWeight;
    const v = node.nodeValue || "";
    const re = /\S+|\s+/g; let m;
    while((m = re.exec(v))){
      const tok = m[0];
      range.setStart(node, m.index);
      range.setEnd(node, m.index + tok.length);
      const rects = range.getClientRects();
      const top = rects.length ? Math.round(rects[rects.length-1].top) : curTop;
      const isSpace = !tok.trim();
      if(!isSpace){
        if(curTop === null){ curTop = top; }
        else if(Math.abs(top - curTop) > 1){ curTop = top; cur = null; }
        add(tok, color, weight);
      } else if(cur){
        add(tok, color, weight);   // keep only interior spaces
      }
    }
  }
  // trim leading/trailing whitespace on each line
  for(const line of lines){
    while(line.segs.length && !line.segs[line.segs.length-1].text.trim()) line.segs.pop();
    while(line.segs.length && !line.segs[0].text.trim()) line.segs.shift();
  }
  return lines.filter(l => l.segs.length);
}

function _freezeWrapping(live, clone){
  const liveEls  = [...live.querySelectorAll("h3, p")];
  const cloneEls = [...clone.querySelectorAll("h3, p")];
  for(let i=0; i<liveEls.length; i++){
    const lel = liveEls[i], cel = cloneEls[i];
    if(!cel) continue;
    try{
      const lines = _measureLines(lel);
      if(!lines.length) continue;
      // honour any visible clamp (-webkit-line-clamp / fixed height) on the live element
      const cs = getComputedStyle(lel);
      const lh = parseFloat(cs.lineHeight);
      let max = lines.length;
      if(lh && lel.clientHeight){
        const fit = Math.round(lel.clientHeight / lh);
        if(fit >= 1) max = Math.min(max, fit);
      }
      const use = lines.slice(0, max);
      cel.innerHTML = use.map(line =>
        '<span style="display:block;white-space:nowrap">'
        + line.segs.map(s => `<span style="color:${s.color};font-weight:${s.weight}">${_esc(s.text)}</span>`).join("")
        + '</span>'
      ).join("");
      // the line breaks are now explicit — neutralise re-flow heuristics
      cel.style.textWrap = "nowrap";
      cel.style.overflow = "visible";
    }catch(_){ /* leave this element as-is */ }
  }
}

async function rasterizeNode(node, w, h, langId, fontCss, limitKB){
  // Render at SS× the spec size with high-quality smoothing (max-quality source),
  // then downscale to the EXACT spec dimensions the ad platforms require — the
  // supersampling makes the photo + text crisp instead of pixelated, while the
  // output stays at the format's required pixel size.
  const SS = (Math.min(w, h) <= 350) ? 4 : 2;
  const canvas = document.createElement("canvas");
  canvas.width = w * SS; canvas.height = h * SS;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.setTransform(SS, 0, 0, SS, 0, 0);   // draw in logical (spec) coordinates

  const nodeRect = node.getBoundingClientRect();
  const kx = w / nodeRect.width, ky = h / nodeRect.height;

  // 1) flat base colour (the full-bleed field of the layout)
  const field = _fieldChain(node);
  let bg = field.el ? getComputedStyle(field.el).backgroundColor : null;
  ctx.fillStyle = (bg && bg !== "rgba(0, 0, 0, 0)") ? bg : "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // 2) bitmaps, in DOM order
  const imgs = [...node.querySelectorAll("img")];
  for(const im of imgs){
    if(!im.naturalWidth || !im.naturalHeight) continue;
    const cs = getComputedStyle(im);
    if(cs.visibility === "hidden" || cs.display === "none") continue;
    const r = im.getBoundingClientRect();
    const dx = (r.left - nodeRect.left) * kx, dy = (r.top - nodeRect.top) * ky;
    const dw = r.width * kx, dh = r.height * ky;
    if(dw <= 0 || dh <= 0) continue;
    const op = parseFloat(cs.opacity);
    const rad = _parseRadius(cs.borderTopLeftRadius, dw, dh);
    ctx.save();
    ctx.globalAlpha = isNaN(op) ? 1 : op;
    if(rad > 0){ _roundRectPath(ctx, dx, dy, dw, dh, rad); ctx.clip(); }
    if(cs.objectFit === "cover"){
      const ar = im.naturalWidth / im.naturalHeight, dar = dw / dh;
      let cw, ch, cx, cy;
      if(ar > dar){ ch = im.naturalHeight; cw = ch * dar; cx = (im.naturalWidth - cw)/2; cy = 0; }
      else        { cw = im.naturalWidth;  ch = cw / dar; cx = 0; cy = (im.naturalHeight - ch)/2; }
      ctx.drawImage(im, cx, cy, cw, ch, dx, dy, dw, dh);
    } else {
      ctx.drawImage(im, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  // 3) text + shapes layer (foreignObject), bitmaps hidden + flat field cleared
  const clone = node.cloneNode(true);
  clone.style.borderRadius = "0";
  clone.style.background = "transparent";
  // clear the SAME field element we painted, so it doesn't repaint over bitmaps
  if(field.depth >= 0){
    let cf = clone;
    for(let d = field.depth; d > 0 && cf; d--) cf = cf.firstElementChild;
    if(cf) cf.style.background = "transparent";
  }
  clone.style.fontFamily = fontStackFor(langId);
  // bake the live line-breaks into the clone so the SVG rasteriser reproduces
  // the on-page wrapping exactly (fixes export overflow on tight banner formats)
  _freezeWrapping(node, clone);
  [...clone.querySelectorAll("img")].forEach(i => { i.style.visibility = "hidden"; });
  const xml = new XMLSerializer().serializeToString(clone);
  const styleTag = fontCss
    ? `<style xmlns="http://www.w3.org/1999/xhtml">${fontCss}</style>`
    : "";
  // Supersample the text layer by scaling the HTML up with a CSS transform (a
  // viewBox does NOT reliably scale foreignObject content in Chrome — it renders
  // at logical size in the corner). The wrapper fills the w·SS × h·SS bitmap.
  const scaled = `<div xmlns="http://www.w3.org/1999/xhtml" style="transform:scale(${SS});transform-origin:0 0;width:${w}px;height:${h}px">${xml}</div>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w*SS}" height="${h*SS}">`
    + `<foreignObject x="0" y="0" width="${w*SS}" height="${h*SS}">${styleTag}${scaled}</foreignObject></svg>`;
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  try{
    const textImg = await loadImage(url, 15000);
    try{ await textImg.decode(); }catch(_){}
    ctx.drawImage(textImg, 0, 0, w, h);   // textImg is w·SS × h·SS → 1:1 in device px
  }catch(_){ /* text layer failed — keep the composited bitmaps + field */ }

  // downscale the supersampled canvas to the EXACT spec dimensions at maximum
  // quality — stepped halving keeps the photo crisp (better than one big jump).
  let cur = canvas, cw = w * SS, ch = h * SS;
  while(cw > w * 2 || ch > h * 2){
    const nw = Math.max(w, Math.round(cw / 2)), nh = Math.max(h, Math.round(ch / 2));
    const tmp = document.createElement("canvas"); tmp.width = nw; tmp.height = nh;
    const tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = "high";
    tctx.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
    cur = tmp; cw = nw; ch = nh;
  }
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const octx = out.getContext("2d");
  octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = "high";
  octx.drawImage(cur, 0, 0, cw, ch, 0, 0, w, h);

  // encode to fit the platform's file-size cap: lossless PNG first; if that
  // exceeds the limit, fall back to the highest-quality JPEG that fits (the
  // creatives are opaque rectangles, so there's no transparency to lose).
  const enc = (type, q) => new Promise(r => out.toBlob(r, type, q));
  let blob = await enc("image/png"), ext = "png";
  if(limitKB && blob.size > limitKB * 1024){
    for(let q = 0.95; q >= 0.5; q -= 0.05){
      blob = await enc("image/jpeg", q); ext = "jpg";
      if(blob.size <= limitKB * 1024) break;
    }
  }
  return { blob, ext };
}
async function exportZip(config, all, onProgress){
  if(typeof JSZip === "undefined") throw new Error("ZIP library unavailable");
  try{ await document.fonts.ready; }catch(_){}

  const zip = new JSZip();
  const root = zip.folder("Statero creatives");

  const mount = document.createElement("div");
  mount.style.cssText = "position:fixed; left:-100000px; top:0; pointer-events:none;";
  document.body.appendChild(mount);

  // collect every rendered (translated) string so the embedded fonts can be
  // subsetted to just the glyphs that actually appear.
  const allTexts = [];
  all.forEach(c => {
    ["headline","description","cta"].forEach(k => {
      const t = window.translate(c.copy[k] || "", c.lang.id); if(t) allTexts.push(t);
    });
    if(config.discount) allTexts.push(window.translate(config.discount, c.lang.id));
  });
  let fontCss = "";
  try{ fontCss = await buildFontEmbedCSS(allTexts); }catch(_){ fontCss = ""; }

  try{
    for(let i=0;i<all.length;i++){
      const c = all[i];
      // Fresh root + slot PER creative: the auto-fitting headline keeps its
      // fitted size in component state, so reusing one root across formats
      // leaves stale sizes that capture before the re-fit commits ("поехавшие"
      // layouts). A clean mount per creative + a real timeout (rAF throttles
      // when the export tab isn't focused) makes every render settle first.
      let blob = null, ext = "png";
      if(c.fmt.video){
        // animated MP4 creative — rendered & encoded at native resolution
        try{
          blob = await window.encodeVideoMP4(c.fmt,
            { template: config.template, cat: c.cat, img: config.image && config.image.url,
              headline:c.copy.headline, description:c.copy.description, cta:c.copy.cta,
              bg:config.bg, use:config.use, rtl:c.lang.rtl },
            c.lang.id,
            (f)=> onProgress && onProgress((i + f)/all.length, i+1, all.length));
          ext = "mp4";
        }catch(e){ console.error("video encode failed", e); blob = null; }
      } else {
        const slot = document.createElement("div");
        mount.appendChild(slot);
        const rRoot = ReactDOM.createRoot(slot);
        await new Promise(res => {
          rRoot.render(
            <window.Creative fmt={c.fmt} maxW={c.fmt.w} maxH={c.fmt.h}
              opts={{ template: config.template, cat: c.cat, img: config.image && config.image.url,
                headline:c.copy.headline, description:c.copy.description, cta:c.copy.cta,
                discount:config.discount, bg:config.bg, use:config.use, lang:c.lang.id, rtl:c.lang.rtl }} />
          );
          setTimeout(res, 300);   // let React commit + the auto-fit layout effect settle
        });
        await waitForImages(slot);
        await new Promise(r => setTimeout(r, 60));
        const node = slot.firstElementChild;
        const limitKB = (window.CATEGORY_META[c.cat] || {}).limitKB || null;
        try{ const res = await rasterizeNode(node, c.fmt.w, c.fmt.h, c.lang.id, fontCss, limitKB); blob = res.blob; ext = res.ext; }catch(_){ blob = null; }
        rRoot.unmount();
        slot.remove();
      }
      if(blob){
        root.folder(window.CATEGORY_META[c.cat].label).file(creativeFileName(c, ext), blob);
      }
      onProgress && onProgress((i+1)/all.length, i+1, all.length);
    }
  } finally {
    mount.remove();
  }

  const out = await zip.generateAsync({ type:"blob" });
  const url = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = url; a.download = "Statero-creatives.zip";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

/* ---------- build the full matrix of creatives ---------- */
function buildCreatives(config, overrides){
  const out = [];
  ["social","google","video"].forEach(cat => {
    config.formats[cat].forEach(fid => {
      const fmt = window.FORMATS[cat].find(f=>f.id===fid);
      config.langs.forEach(lid => {
        const lang = window.LANGUAGES.find(l=>l.id===lid);
        const key = `${cat}-${fid}-${lid}`;
        const o = (overrides && overrides[key]) || {};
        const copy = {
          headline: o.headline != null ? o.headline : config.headline,
          description: o.description != null ? o.description : config.description,
          cta: o.cta != null ? o.cta : config.cta,
        };
        const ev = window.evaluate(fmt, cat, { headline:copy.headline, description:copy.description, cta:copy.cta, discount:config.discount, use:config.use, template:config.template, lang:lid });
        out.push({ key, cat, fmt, lang, ev, copy, edited: o.headline!=null || o.cta!=null });
      });
    });
  });
  return out;
}

/* ---------- one result card ---------- */
function ResultCard({ c, config, onEdit }){
  const l = c.lang;
  const [editing, setEditing] = React.useState(false);
  const [dH, setDH] = React.useState(c.copy.headline);
  const [dC, setDC] = React.useState(c.copy.cta);
  const editable = true; // any creative can be hand-tuned; emphasised when it doesn't pass

  React.useEffect(()=>{ setDH(c.copy.headline); setDC(c.copy.cta); }, [c.copy.headline, c.copy.cta]);

  // per-card MP4 export (video formats only)
  const [dl, setDl] = React.useState(0); // 0 idle | 0<..<1 encoding | -1 error
  async function downloadMp4(){
    if(dl>0) return;
    setDl(0.001);
    try{
      const blob = await window.encodeVideoMP4(c.fmt,
        { template: config.template, cat: c.cat, img: config.image && config.image.url,
          headline:c.copy.headline, description:c.copy.description, cta:c.copy.cta,
          bg:config.bg, use:config.use, rtl:l.rtl },
        l.id, (f)=>setDl(Math.max(0.001, f)));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = creativeFileName(c, "mp4");
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 4000);
      setDl(0);
    }catch(e){ console.error("mp4 export failed", e); setDl(-1); setTimeout(()=>setDl(0), 2600); }
  }

  function apply(){
    onEdit(c.key, { headline:dH, cta:dC });
    if(l.id !== "en"){
      const texts = [dH, dC].filter(t=>t && t.trim());
      if(texts.length) window.ensureTranslations(texts, [l.id]).catch(()=>{});
    }
    setEditing(false);
  }

  return (
    <div className="rcard fade-in">
      <div className="rcard__stage">
        <span className={"rcard__statustag " + c.ev.status}>
          <span className="dot"></span>{statusWord(c.ev.status)}
        </span>
        {c.fmt.video && <span className="rcard__video">{window.Ico.video} {c.fmt.note}</span>}
        {React.createElement(c.fmt.video ? window.VideoCreative : window.Creative, {
          fmt:c.fmt, maxW:196, maxH:150,
          opts:{ template: config.template, cat: c.cat, img: config.image && config.image.url, headline:c.copy.headline, description:c.copy.description, cta:c.copy.cta, discount:config.discount, bg:config.bg, use:config.use, lang:l.id, rtl:l.rtl } })}
      </div>
      <div className="rcard__info">
        <div className="rcard__name">{c.fmt.name} <span className="rcard__lang">{l.flag} {l.id}</span>{c.edited && <span className="rcard__edited">edited</span>}</div>
        <div className="rcard__dim">{c.fmt.w}×{c.fmt.h}px{c.fmt.note ? " · "+c.fmt.note : ""}{c.fmt.video ? " · video":""}</div>
        {c.ev.droppedDesc &&
          <div className="rcard__note">Header only — description didn’t fit this format</div>}
        <div className="rcard__checks">
          {c.ev.checks.map(ch => (
            <span className="rcheck" key={ch.id} title={ch.label + ": " + ch.detail}>
              <span className={"rcheck__ic " + (ch.state==="ok"?"ok":ch.state==="warn"?"warn":"fail")}>{statusGlyph(ch.state)}</span>
              {ch.label}
            </span>
          ))}
        </div>
        <div className="rcard__size">
          <span>{c.ev.kb} KB {c.fmt.video && "/ frame"}</span>
          <span>text {c.ev.covPct}%</span>
        </div>
        {editable && !editing &&
          <button className="rcard__editbtn" onClick={()=>setEditing(true)}>
            {c.ev.status==="pass" ? "Edit copy" : "Edit manually"}
          </button>}
        {c.fmt.video && !editing &&
          <button className="rcard__editbtn" disabled={dl>0}
            style={{ marginTop:6, background: dl===-1 ? "#FFE4E1" : "#0B0F0D", color: dl===-1 ? "#B00020" : "#fff", borderColor:"transparent" }}
            onClick={downloadMp4}>
            {dl>0 ? `Encoding MP4… ${Math.round(dl*100)}%` : dl===-1 ? "Encode failed — retry" : "↓ Download MP4"}
          </button>}
        {editing &&
          <div className="rcard__editor">
            <label>Headline</label>
            <textarea className="rcard__editinput" rows={2} value={dH} maxLength={80}
              onChange={(e)=>setDH(e.target.value)} placeholder="Shorten for this format…" />
            <label>Button (CTA)</label>
            <input className="rcard__editinput" value={dC} maxLength={24}
              onChange={(e)=>setDC(e.target.value)} placeholder="CTA" />
            <p className="rcard__edithint">Tip: a shorter headline lowers the text ratio for tight banners.</p>
            <div className="rcard__editactions">
              <button className="btn btn-ghost" style={{padding:"7px 13px",fontSize:12.5}} onClick={()=>{ setDH(c.copy.headline); setDC(c.copy.cta); setEditing(false); }}>Cancel</button>
              <button className="btn btn-primary" style={{padding:"7px 14px",fontSize:12.5}} onClick={apply}>Apply</button>
            </div>
          </div>}
      </div>
    </div>
  );
}

/* ---------- results screen ---------- */
function Results({ config, onBack, toast }){
  window.useTrans();
  const [overrides, setOverrides] = React.useState({});
  const all = React.useMemo(()=>buildCreatives(config, overrides), [config, overrides]);
  const [filter, setFilter] = React.useState("all"); // all | social | google | video | issues

  function editCreative(key, patch){ setOverrides(o => ({ ...o, [key]: { ...(o[key]||{}), ...patch } })); }

  const [exporting, setExporting] = React.useState(false);
  const [exportPct, setExportPct] = React.useState(0);
  const [exportN, setExportN] = React.useState(0);

  const counts = {
    all: all.length,
    social: all.filter(c=>c.cat==="social").length,
    google: all.filter(c=>c.cat==="google").length,
    video: all.filter(c=>c.cat==="video").length,
    issues: all.filter(c=>c.ev.status!=="pass").length,
  };
  const pass = all.filter(c=>c.ev.status==="pass").length;
  const warn = all.filter(c=>c.ev.status==="warn").length;
  const fail = all.filter(c=>c.ev.status==="fail").length;
  const passPct = all.length ? Math.round(pass/all.length*100) : 0;

  const shown = all.filter(c => filter==="all" ? true : filter==="issues" ? c.ev.status!=="pass" : c.cat===filter);
  const groups = ["social","google","video"].map(cat => ({
    cat, meta: window.CATEGORY_META[cat],
    items: shown.filter(c=>c.cat===cat),
  })).filter(g=>g.items.length);

  async function download(){
    if(exporting) return;
    setExporting(true); setExportPct(0); setExportN(0);
    try{
      await exportZip(config, all, (frac, done)=>{ setExportPct(frac); setExportN(done); });
      toast(`Downloaded ${all.length} creatives as a ZIP.`);
    }catch(e){
      toast("Couldn’t build the ZIP — please try again.");
      console.error(e);
    }finally{
      setExporting(false);
    }
  }

  return (
    <div className="results">
      <div className="results__top">
        <div className="results__heading">
          <h1>Done — {all.length} creatives</h1>
          <p>{config.formats.social.length+config.formats.google.length+config.formats.video.length} formats × {config.langs.length} {config.langs.length===1?"language":"languages"} · <b style={{color:"var(--green-3)"}}>{passPct}% passed</b> · checked against platform requirements</p>
        </div>
        <div className="results__actions">
          <button className="btn btn-ghost" onClick={onBack}>← Back to settings</button>
          <button className="btn btn-primary" onClick={download} disabled={exporting}>
            {window.Ico.upload} {exporting ? `Packing… ${Math.round(exportPct*100)}%` : "Download all as ZIP"}
          </button>
        </div>
      </div>

      {/* scorecards */}
      <div className="scorecards">
        <div className="scorecard"><div className="scorecard__v">{all.length}</div><div className="scorecard__k">Total creatives</div></div>
        <div className="scorecard scorecard--pass"><div className="scorecard__v">{pass}</div><div className="scorecard__k">Passed</div></div>
        <div className="scorecard scorecard--warn"><div className="scorecard__v">{warn}</div><div className="scorecard__k">With warnings</div></div>
        <div className="scorecard scorecard--fail"><div className="scorecard__v">{fail}</div><div className="scorecard__k">Failed</div></div>
      </div>

      <div className="req-note">
        {window.Ico.info}&nbsp;<b>Checked against platform requirements:</b> exact format dimensions for each
        social &amp; Google Display placement, file size (Google Display ≤150 KB), text ratio (advisory),
        safe zones and contrast. Any creative that doesn’t fully pass can be <b>edited manually</b> —
        shorten its copy for that one format without touching the rest.
      </div>

      {/* filter */}
      <div className="rfilter">
        {[["all","All"],["social","Social"],["google","Google Ads"],["video","Video"],["issues","With warnings"]].map(([id,label]) =>
          counts[id]>0 || id==="all" ? (
            <button key={id} className={"rfilter__btn" + (filter===id?" is-on":"")} onClick={()=>setFilter(id)}>
              {label}<span className="n">{counts[id]}</span>
            </button>
          ) : null
        )}
      </div>

      {/* groups */}
      {groups.map(g => (
        <div className="rgroup" key={g.cat}>
          <div className="rgroup__head">
            <span className="rgroup__icon" style={{background:g.meta.color}}>{window.CAT_ICON[g.cat]}</span>
            <span className="rgroup__title">{g.meta.label}</span>
            <span className="rgroup__meta">{g.items.length} creatives</span>
          </div>
          <div className="rgrid">
            {g.items.map(c => <ResultCard key={c.key} c={c} config={config} onEdit={editCreative} />)}
          </div>
        </div>
      ))}

      {exporting &&
        <div className="processing">
          <div className="processing__card">
            <div className="processing__spin"></div>
            <h3 className="processing__title">Packing your ZIP</h3>
            <p className="processing__step">Rendering creative {exportN} of {all.length}…</p>
            <div className="processing__bar"><div className="processing__fill" style={{width:(exportPct*100)+"%"}}></div></div>
            <p className="processing__pct">{Math.round(exportPct*100)}%</p>
          </div>
        </div>}
    </div>
  );
}

window.Results = Results;
window.buildCreatives = buildCreatives;
