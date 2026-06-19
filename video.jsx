/* ============================================================
   STATERO CREATIVE STUDIO — VIDEO ENGINE
   Animated, format-adaptive video creatives that resolve into the
   Solid Split static as their final frame, plus real .mp4 export
   (WebCodecs H.264 → mp4-muxer). One scene builder drives BOTH the
   live looping preview and the deterministic frame-by-frame encode.

   Layouts (auto by aspect ratio):
     • wide  (≥1.7:1, e.g. 1920×1080) — text column left, photo morphs
       into the rounded card on the right.
     • vertical (9:16 & 1:1)          — photo morphs into a top card,
       headline / description / CTA rise in below.

   Exposes:  window.VideoCreative  (React preview component)
             window.encodeVideoMP4 (async → Blob)
             window.VIDEO_DUR / window.VIDEO_FPS
   ============================================================ */
(function(){
  const DUR = 7.0;            // seconds — full loop
  const FPS = 30;
  const CR  = { green:"#08C55D", green3:"#008042", ink:"#0B0F0D", white:"#fff", yellow:"#FFBB00" };

  /* ---------- math / easing ---------- */
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const seg = (t,a,b) => clamp01((t-a)/(b-a));
  const lerp = (a,b,p) => a + (b-a)*p;
  const easeInOut = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p+2,3)/2;
  const easeOut = p => 1 - Math.pow(1-p,3);
  const easeOutBack = p => { const c1=1.32, c3=c1+1; return 1 + c3*Math.pow(p-1,3) + c1*Math.pow(p-1,2); };
  const clamp = (v,a,b)=> (window.crClamp ? window.crClamp(v,a,b) : Math.max(a,Math.min(b,v)));

  function fontStack(lang){
    if(lang === "zh") return '"Noto Sans SC", "Readex Pro", sans-serif';
    if(lang === "ar") return '"Readex Pro", "Noto Sans Arabic", sans-serif';
    return '"Readex Pro", system-ui, sans-serif';
  }
  const split = (text)=> (window.crSplit ? window.crSplit(text) : [{ t:text, hi:false }]);

  /* word spans for the rise animation; accent words coloured */
  function headlineHTML(text, accent){
    const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return split(text).map(seg => {
      const words = seg.t.split(/(\s+)/).filter(s=>s.length);
      return words.map(w => {
        if(!w.trim()) return w;                    // keep spaces inline
        const col = seg.hi ? `color:${accent};` : "";
        return `<span class="vw" style="display:inline-block;will-change:transform,opacity;${col}">${esc(w)}</span>`;
      }).join("");
    }).join("");
  }

  /* ---------- one-shot headline auto-fit (width + height) ---------- */
  function fitHeadline(el, maxW, maxH, baseFs, minFs){
    let size = baseFs;
    el.style.fontSize = size + "px";
    let guard = 0;
    while(guard++ < 140 && (el.scrollWidth > maxW + 1 || el.scrollHeight > maxH + 1) && size > minFs){
      size -= Math.max(0.5, size * 0.04);
      el.style.fontSize = size + "px";
    }
    return size;
  }

  /* ============================================================
     SCENE BUILDER — builds the DOM for one format, returns
     { root, render(t), fit() }. Plain inline-styled DOM so it
     serialises cleanly for the MP4 rasteriser.
     ============================================================ */
  function buildScene(fmt, opts){
    const W = fmt.w, H = fmt.h, ratio = W/H, min = Math.min(W,H);
    const mode = ratio >= 1.7 ? "wide" : (ratio <= 0.7 ? "tall" : "square");
    const vertical = mode !== "wide";
    const t = window.crTheme ? window.crTheme(opts.bg) : { bg:CR.green, text:CR.white, accent:CR.yellow, ctaBg:CR.yellow, ctaFg:CR.ink, logoWhite:true, sym:"white", patSrc:"assets/symbol-pat-01da6d.png", patOpacity:1 };
    const lang = opts.lang || "en";
    const rtl = !!opts.rtl;
    const use = opts.use || {};

    const head = (window.translate ? window.translate(opts.headline, lang) : opts.headline) || "";
    const desc = (use.description !== false) ? ((window.translate ? window.translate(opts.description, lang) : opts.description) || "") : "";
    const cta  = (use.cta !== false) ? ((window.translate ? window.translate(opts.cta, lang) : opts.cta) || "") : "";

    const logoSrc = t.logoWhite ? "assets/logo-white.png" : "assets/logo-black.png";
    const symSrc  = t.patSrc || ("assets/symbol-" + (t.sym || "white") + ".png");
    const photoSrc = (opts.img) || "assets/t04-photo.jpg";

    const root = document.createElement("div");
    root.dir = rtl ? "rtl" : "ltr";
    root.style.cssText =
      `position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;background:${t.bg};` +
      `font-family:${fontStack(lang)};`;

    /* brand pattern (two drifting cropped symbols) */
    /* brand pattern — a single cropped mark, matching the static creatives.
       It only drifts very gently (slow parallax), never rotates, so nothing
       sweeps across or overlaps a second copy. */
    const symSize = Math.max(W,H) * (vertical ? 1.25 : 1.05);
    const p1 = document.createElement("img");
    p1.src = symSrc; p1.alt = "";
    p1.style.cssText = `position:absolute;width:${symSize}px;height:${symSize}px;left:${-symSize*0.18}px;top:${-symSize*0.22}px;opacity:${t.patOpacity != null ? t.patOpacity : 0.1};pointer-events:none;will-change:transform;`;
    root.appendChild(p1);

    /* photo (starts full-bleed, morphs into its final card) */
    const photo = document.createElement("div");
    photo.style.cssText = `position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;z-index:2;background:${CR.green3};will-change:left,top,right,bottom,border-radius;`;
    const photoImg = document.createElement("img");
    photoImg.src = photoSrc; photoImg.alt = "";
    photoImg.style.cssText = `position:absolute;left:50%;top:50%;width:100%;height:100%;object-fit:cover;transform:translate(-50%,-50%) scale(1);transform-origin:center center;will-change:transform;`;
    photo.appendChild(photoImg);
    root.appendChild(photo);

    /* ---- geometry + content per layout ---- */
    let PAD, card, content, headEl, descEl, ctaEl, logoEl;
    const radius = Math.round(clamp(min*0.032, 6, 36));

    if(!vertical){
      /* WIDE — content column left, photo card right */
      PAD = Math.round(clamp(min*0.089, 28, 110));
      const contentW = Math.round(W*0.53 - PAD);
      const cardLeft = Math.round(W - PAD - 0.42*W);
      card = { left:cardLeft, top:PAD, right:PAD, bottom:PAD };
      const logoH = Math.round(clamp(min*0.067, 20, 82));
      const headFs = clamp(H*0.096, 24, 150);
      const descFs = clamp(headFs*0.365, 14, 46);
      const ctaFs  = clamp(headFs*0.44, 16, 52);

      content = document.createElement("div");
      content.style.cssText = `position:absolute;left:${PAD}px;top:${PAD}px;bottom:${PAD}px;width:${contentW}px;display:flex;flex-direction:column;z-index:3;`;

      logoEl = document.createElement("img");
      logoEl.src = logoSrc; logoEl.alt = "Statero";
      logoEl.style.cssText = `height:${logoH}px;align-self:flex-start;flex:none;transform-origin:left center;will-change:transform,opacity;`;
      content.appendChild(logoEl);

      const block = document.createElement("div");
      block.style.cssText = `margin-top:auto;display:flex;flex-direction:column;min-height:0;`;

      headEl = document.createElement("h1");
      headEl.style.cssText = `margin:0;color:${t.text};font-weight:700;line-height:1.03;letter-spacing:-.02em;text-transform:uppercase;`;
      headEl.innerHTML = headlineHTML(head, t.accent);
      headEl._fs = [headFs, clamp(headFs*0.4, 14, 40), contentW, Math.round(H*0.62)];
      block.appendChild(headEl);

      if(desc){
        descEl = document.createElement("p");
        descEl.style.cssText = `margin:${Math.round(PAD*0.34)}px 0 0;color:${t.logoWhite?"rgba(255,255,255,.92)":"rgba(11,15,13,.7)"};font-weight:400;font-size:${descFs}px;line-height:1.3;letter-spacing:-.01em;max-width:96%;will-change:transform,opacity;`;
        descEl.textContent = desc;
        block.appendChild(descEl);
      }
      if(cta){
        ctaEl = document.createElement("span");
        ctaEl.style.cssText = `margin-top:${Math.round(PAD*0.46)}px;align-self:flex-start;background:${t.ctaBg};color:${t.ctaFg};font-weight:500;font-size:${ctaFs}px;padding:${Math.round(ctaFs*0.56)}px ${Math.round(ctaFs*1.4)}px;border-radius:999px;white-space:nowrap;display:inline-flex;align-items:center;line-height:1;transform-origin:left center;will-change:transform,opacity;`;
        ctaEl.textContent = cta;
        block.appendChild(ctaEl);
      }
      content.appendChild(block);
      root.appendChild(content);
    } else {
      /* VERTICAL (9:16 & 1:1) — photo morphs into a TOP card, text below */
      PAD = Math.round(clamp(min*0.07, 22, 96));
      const cardH = Math.round(mode === "tall" ? H*0.46 : H*0.42);
      card = { left:PAD, top:PAD, right:PAD, bottom: H - (PAD + cardH) };
      const headFs = clamp(W*0.078, 22, 150);
      const descFs = clamp(W*0.032, 13, 42);
      const ctaFs  = clamp(min*0.05, 16, 56);
      const belowTop = PAD + cardH + Math.round(PAD*0.7);

      content = document.createElement("div");
      content.style.cssText = `position:absolute;left:${PAD}px;right:${PAD}px;top:${belowTop}px;bottom:${PAD}px;display:flex;flex-direction:column;z-index:3;`;

      headEl = document.createElement("h1");
      headEl.style.cssText = `margin:0;flex:none;color:${t.text};font-weight:700;line-height:1.04;letter-spacing:-.02em;text-transform:uppercase;`;
      headEl.innerHTML = headlineHTML(head, t.accent);
      const headZoneH = Math.round((H - belowTop - PAD) * (cta ? 0.62 : 0.86));
      headEl._fs = [headFs, clamp(headFs*0.4, 13, 40), W - PAD*2, headZoneH];
      content.appendChild(headEl);

      if(desc){
        descEl = document.createElement("p");
        descEl.style.cssText = `margin:${Math.round(PAD*0.4)}px 0 0;flex:none;color:${t.logoWhite?"rgba(255,255,255,.92)":"rgba(11,15,13,.7)"};font-weight:400;font-size:${descFs}px;line-height:1.3;letter-spacing:-.01em;will-change:transform,opacity;`;
        descEl.textContent = desc;
        content.appendChild(descEl);
      }
      if(cta){
        ctaEl = document.createElement("span");
        ctaEl.style.cssText = `margin-top:auto;width:100%;box-sizing:border-box;background:${t.ctaBg};color:${t.ctaFg};font-weight:500;font-size:${ctaFs}px;padding:${Math.round(ctaFs*0.5)}px ${ctaFs}px;border-radius:999px;white-space:nowrap;display:flex;align-items:center;justify-content:center;line-height:1;transform-origin:center center;will-change:transform,opacity;`;
        ctaEl.textContent = cta;
        content.appendChild(ctaEl);
      }
      root.appendChild(content);
    }

    const words = [...headEl.querySelectorAll(".vw")];

    /* ---- timeline ---- */
    const TL = {
      photoFade:[0,0.35], push:[0,2.7], morph:[1.5,2.7],
      words:{ start:2.0, stagger:0.07, dur:0.55 },
      desc:[2.7,3.3], logo:[2.7,3.2], cta:[3.05,3.75],
      fadeOut:[6.6,7.0],
    };

    function fit(){
      if(headEl && headEl._fs){
        const [b,m,mw,mh] = headEl._fs;
        fitHeadline(headEl, mw, mh, b, m);
      }
    }

    function render(time){
      const tt = Math.max(0, Math.min(DUR, time));
      // photo morph (full-bleed → card)
      const mp = easeInOut(seg(tt, TL.morph[0], TL.morph[1]));
      photo.style.left   = lerp(0, card.left,   mp) + "px";
      photo.style.top    = lerp(0, card.top,    mp) + "px";
      photo.style.right  = lerp(0, card.right,  mp) + "px";
      photo.style.bottom = lerp(0, card.bottom, mp) + "px";
      photo.style.borderRadius = lerp(0, radius, mp) + "px";
      photo.style.opacity = seg(tt, TL.photoFade[0], TL.photoFade[1]);
      // photo push-in + drift
      const push = easeOut(seg(tt, TL.push[0], TL.push[1]));
      const drift = seg(tt, TL.push[1], DUR);
      photoImg.style.transform = `translate(-50%,-50%) scale(${(lerp(1.16,1.0,push) + drift*0.05).toFixed(4)})`;
      // headline words rise
      words.forEach((el,i)=>{
        const s = TL.words.start + i*TL.words.stagger;
        const p = easeOut(seg(tt, s, s + TL.words.dur));
        el.style.opacity = p;
        el.style.transform = `translateY(${lerp(34,0,p).toFixed(2)}px)`;
      });
      // description
      if(descEl){
        const dp = easeOut(seg(tt, TL.desc[0], TL.desc[1]));
        descEl.style.opacity = dp;
        descEl.style.transform = `translateY(${lerp(22,0,dp).toFixed(2)}px)`;
      }
      // logo (wide only)
      if(logoEl){
        const lp = easeOut(seg(tt, TL.logo[0], TL.logo[1]));
        logoEl.style.opacity = lp;
        logoEl.style.transform = `translateY(${lerp(-16,0,lp).toFixed(2)}px)`;
      }
      // CTA pop
      if(ctaEl){
        const cp = seg(tt, TL.cta[0], TL.cta[1]);
        ctaEl.style.opacity = clamp01(cp*2);
        ctaEl.style.transform = `scale(${lerp(0.9,1,easeOutBack(cp)).toFixed(4)})`;
      }
      // pattern: slow, subtle parallax drift — no rotation, no second copy
      const pd = tt / DUR;
      p1.style.transform = `translate(${(pd*symSize*0.04).toFixed(2)}px, ${(pd*symSize*0.05).toFixed(2)}px)`;
      // loop fade
      root.style.opacity = (1 - seg(tt, TL.fadeOut[0], TL.fadeOut[1])).toFixed(3);
    }

    return { root, render, fit, W, H };
  }

  /* ============================================================
     LIVE PREVIEW — looping, scaled into a maxW×maxH box.
     ============================================================ */
  function VideoCreative({ fmt, opts, maxW, maxH }){
    const hostRef = React.useRef(null);
    const key = [fmt.w, fmt.h, opts.template, opts.bg, opts.lang,
      window.translate ? window.translate(opts.headline, opts.lang) : opts.headline,
      window.translate ? window.translate(opts.description, opts.lang) : opts.description,
      window.translate ? window.translate(opts.cta, opts.lang) : opts.cta,
      opts.img, JSON.stringify(opts.use||{})].join("|");

    React.useLayoutEffect(()=>{
      const host = hostRef.current; if(!host) return;
      host.innerHTML = "";
      const scene = buildScene(fmt, opts);
      const s = clamp(Math.min(maxW/fmt.w, maxH/fmt.h), 0.02, 1.3);
      const frame = document.createElement("div");
      frame.style.cssText = `position:relative;width:${fmt.w*s}px;height:${fmt.h*s}px;overflow:hidden;border-radius:${clamp(Math.min(fmt.w,fmt.h)*0.022*s,1,9)}px;`;
      scene.root.style.transform = `scale(${s})`;
      scene.root.style.transformOrigin = "top left";
      frame.appendChild(scene.root);
      host.appendChild(frame);

      let raf = 0, start = 0, stopped = false;
      const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // fit headline once images/fonts settle
      const settle = ()=>{ try{ scene.fit(); }catch(_){ } };
      settle(); setTimeout(settle, 60);
      if(document.fonts && document.fonts.ready) document.fonts.ready.then(settle).catch(()=>{});

      if(reduce){ scene.render(4.0); }
      else {
        const loop = (now)=>{
          if(stopped) return;
          if(!start) start = now;
          const t = ((now - start)/1000) % DUR;
          scene.render(t);
          raf = requestAnimationFrame(loop);
        };
        scene.render(0);
        raf = requestAnimationFrame(loop);
      }
      return ()=>{ stopped = true; if(raf) cancelAnimationFrame(raf); host.innerHTML = ""; };
    }, [key, maxW, maxH]);

    return React.createElement("div", { ref: hostRef, style:{ display:"inline-block", lineHeight:0 } });
  }

  /* ============================================================
     MP4 EXPORT — deterministic per-frame rasterise → H.264 → mp4.
     Self-contained: fonts + images inlined so the frame serialises
     offline. Returns a Blob (or throws).
     ============================================================ */
  function blobToDataURL(blob){
    return new Promise((ok,err)=>{ const fr = new FileReader();
      fr.onload = ()=>ok(fr.result); fr.onerror = ()=>err(fr.error); fr.readAsDataURL(blob); });
  }
  const _imgCache = {};
  async function inlineSrc(src){
    if(_imgCache[src]) return _imgCache[src];
    const p = (async ()=>{ const b = await (await fetch(src)).blob(); return await blobToDataURL(b); })();
    _imgCache[src] = p; return p;
  }
  async function inlineImages(root){
    const jobs = [...root.querySelectorAll("img")].map(async im => {
      try{ im.src = await inlineSrc(im.getAttribute("src")); }catch(_){}
    });
    await Promise.all(jobs);
  }
  const FONT_FAMILIES = [
    "Readex+Pro:wght@300;400;500;600;700",
    "Noto+Sans+Arabic:wght@400;500;600;700",
    "Noto+Sans+SC:wght@400;500;700",
  ];
  let _fontCss = null, _fontKey = "";
  async function embedFonts(texts){
    const base = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?:;%\u2013\u2012-'\u2019\"&()@/+\u20ac$";
    const charSet = Array.from(new Set((base + (texts||[]).join("")).split(""))).join("");
    const key = charSet.split("").sort().join("");
    if(_fontCss != null && _fontKey === key) return _fontCss;
    let css = "";
    for(const fam of FONT_FAMILIES){
      try{
        const u = `https://fonts.googleapis.com/css2?family=${fam}&text=${encodeURIComponent(charSet)}`;
        let txt = await (await fetch(u)).text();
        const urls = Array.from(new Set([...txt.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(m=>m[1])));
        for(const fu of urls){ try{ txt = txt.split(fu).join(await inlineSrc(fu)); }catch(_){} }
        css += txt + "\n";
      }catch(_){}
    }
    _fontCss = css; _fontKey = key;
    return css;
  }
  async function pickEncoderConfig(W,H){
    const cands = ["avc1.640028","avc1.4d0028","avc1.42E028","avc1.4d0033"];
    for(const codec of cands){
      const cfg = { codec, width:W, height:H, bitrate: Math.min(16_000_000, Math.round(W*H*FPS*0.07)), framerate:FPS, latencyMode:"quality" };
      try{ const s = await VideoEncoder.isConfigSupported(cfg); if(s && s.supported) return cfg; }catch(_){}
    }
    return null;
  }

  async function encodeVideoMP4(fmt, opts, lang, onProgress){
    if(typeof VideoEncoder === "undefined" || typeof window.Mp4Muxer === "undefined")
      throw new Error("This browser can’t encode MP4 in-page (needs WebCodecs).");
    const W = fmt.w, H = fmt.h;
    const sceneOpts = { ...opts, lang };
    const texts = [];
    if(window.translate){
      texts.push(window.translate(opts.headline, lang), window.translate(opts.description, lang), window.translate(opts.cta, lang));
    }
    const fontCss = await embedFonts(texts);

    // build the scene offscreen at native size, inline its images, fit headline
    const mount = document.createElement("div");
    mount.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
    mount.style.width = W + "px"; mount.style.height = H + "px";
    document.body.appendChild(mount);
    const scene = buildScene(fmt, sceneOpts);
    mount.appendChild(scene.root);
    await inlineImages(scene.root);
    try{ await document.fonts.ready; }catch(_){}
    scene.fit();

    const cfg = await pickEncoderConfig(W,H);
    if(!cfg){ mount.remove(); throw new Error("No H.264 encoder available in this browser."); }

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec:"avc", width:W, height:H },
      fastStart:"in-memory", firstTimestampBehavior:"offset",
    });
    let encErr = null;
    const encoder = new VideoEncoder({
      output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),
      error:(e)=>{ encErr = e; },
    });
    encoder.configure(cfg);

    const out = document.createElement("canvas");
    out.width = W; out.height = H;
    const ctx = out.getContext("2d", { alpha:false });
    const styleTag = `<style xmlns="http://www.w3.org/1999/xhtml">${fontCss}</style>`;

    function rasterizeFrame(){
      return new Promise((resolve,reject)=>{
        const clone = scene.root.cloneNode(true);
        clone.style.transform = "none"; clone.style.left = "0"; clone.style.top = "0";
        const xml = new XMLSerializer().serializeToString(clone);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
          + `<foreignObject x="0" y="0" width="${W}" height="${H}">${styleTag}${xml}</foreignObject></svg>`;
        const img = new Image();
        img.onload = async ()=>{ try{ await img.decode(); }catch(_){}
          ctx.fillStyle = "#000"; ctx.fillRect(0,0,W,H);
          ctx.drawImage(img,0,0,W,H); resolve(); };
        img.onerror = ()=>reject(new Error("frame rasterise failed"));
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      });
    }

    try{
      const total = Math.round(DUR*FPS);
      for(let i=0;i<total;i++){
        if(encErr) throw encErr;
        scene.render(Math.min(DUR, i/FPS));
        await rasterizeFrame();
        const vf = new VideoFrame(out, { timestamp: Math.round(i*1e6/FPS), duration: Math.round(1e6/FPS) });
        encoder.encode(vf, { keyFrame: i % FPS === 0 });
        vf.close();
        while(encoder.encodeQueueSize > 6){ await new Promise(r=>setTimeout(r,4)); }
        onProgress && onProgress((i+1)/total);
      }
      await encoder.flush();
      muxer.finalize();
      return new Blob([muxer.target.buffer], { type:"video/mp4" });
    } finally {
      mount.remove();
    }
  }

  window.VideoCreative = VideoCreative;
  window.encodeVideoMP4 = encodeVideoMP4;
  window.VIDEO_DUR = DUR;
  window.VIDEO_FPS = FPS;
})();
