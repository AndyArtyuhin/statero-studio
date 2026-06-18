/* ============================================================
   STATERO CREATIVE STUDIO — Template system
   Four ad-creative templates distilled from the brand's
   reference creatives. Each is a *structure*: a parameterised
   layout that renders one creative for ANY format/aspect ratio
   from the same inputs (image, headline, CTA, language).

   Inputs flow in through `opts`:
     { template, img, headline, cta, lang, rtl }
   Headline supports an accent: wrap a phrase in *asterisks*
   and it renders in the brand-yellow accent colour, e.g.
     "Buy gift cards worldwide. *For everyone.*"

   Exposes window.Creative / window.TEMPLATES / helpers so the
   builder preview and the results grid share one renderer.
   ============================================================ */

/* ---------- palette (mirrors brand tokens) ---------- */
const CR = {
  green:  "#08C55D",
  green2: "#009E51",
  green3: "#008042",
  ink:    "#0B0F0D",
  white:  "#FFFFFF",
  yellow: "#FFBB00",
  paper:  "#F4F6F5",
};

function crClamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

/* ---------- background colour theming ----------
   The solid-field layout (Solid Split) can take any brand colour as its
   background. We resolve a contrast-correct palette from the chosen
   colour so text, logo, accent, CTA and badge always read. */
const BG_OPTIONS = [
  { id:"green",  name:"Green",       color:"#08C55D" },
  { id:"green2", name:"Mid green",   color:"#009E51" },
  { id:"green3", name:"Deep green",  color:"#008042" },
  { id:"grey",   name:"Grey",        color:"#E9E9E9" },
  { id:"blue",   name:"Blue",        color:"#0062FF" },
  { id:"orange", name:"Orange",      color:"#FF5100" },
  { id:"yellow", name:"Yellow",      color:"#FFBB00" },
];
function crLum(hex){
  const h = (hex || "").replace("#","");
  if(h.length < 6) return 0.5;
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  return (0.299*r + 0.587*g + 0.114*b) / 255;
}
function crTheme(bg){
  const color = bg || CR.green;
  const light = crLum(color) > 0.6;                 // grey + yellow are "light"
  const isYellow = color.toLowerCase() === CR.yellow.toLowerCase();
  return {
    bg: color,
    text: light ? CR.ink : CR.white,
    logoWhite: !light,
    accent: light ? CR.green3 : CR.yellow,          // headline highlight
    ctaBg: light ? CR.green : CR.yellow,
    ctaFg: light ? CR.white : CR.ink,
    badgeBg: isYellow ? CR.green3 : CR.yellow,
    badgeFg: isYellow ? CR.white : CR.ink,
    badgeRing: light ? "rgba(11,15,13,.14)" : "rgba(255,255,255,.92)",
    sym: light ? "grey" : "white",
  };
}

/* ---------- auto-fitting headline ----------
   Renders the WHOLE headline (never clamps) and shrinks the font until
   every word fits inside the given box. Width is fixed so the text wraps;
   we reduce the size until it no longer overflows `maxH`. */
function CrFitHead({ text, accent, baseFs, minFs, maxW, maxH, style }){
  const ref = React.useRef(null);
  const [fs, setFs] = React.useState(baseFs);
  React.useLayoutEffect(()=>{
    const el = ref.current; if(!el) return;
    let size = baseFs;
    el.style.fontSize = size + "px";
    let guard = 0;
    while(guard++ < 80 && el.scrollHeight > maxH + 1 && size > minFs){
      size -= Math.max(0.5, size * 0.05);
      el.style.fontSize = size + "px";
    }
    if(Math.abs(size - fs) > 0.25) setFs(size);
  }, [text, baseFs, minFs, maxW, maxH]);
  return (
    <h3 ref={ref} style={{ ...style, fontSize:fs, maxWidth:maxW, overflow:"hidden", textWrap:"wrap" }}>
      {crSplit(text).map((p, i) => (
        <span key={i} style={p.hi ? { color: accent } : null}>{p.t}</span>
      ))}
    </h3>
  );
}

/* ---------- geometry: classify a format ---------- */
function crGeo(fmt){
  const w = fmt.w, h = fmt.h, ratio = w / h, minSide = Math.min(w, h);
  let mode;
  if(minSide < 130)      mode = "micro";   // thin banners: 728×90, 970×90, 320×100…
  else if(ratio >= 1.7)  mode = "wide";    // landscape: 1.91:1, 16:9, billboard
  else if(ratio <= 0.7)  mode = "tall";    // portrait: 9:16, skyscraper, half-page
  else                   mode = "square";  // 1:1 and near-square
  return { w, h, ratio, minSide, mode };
}

/* ---------- slots: which copy fields fit THIS format ----------
   Combines the user's field selection (`use`) with what the format's
   geometry can physically carry. Tiny banners and narrow skyscrapers
   only have room for a headline (+ CTA on wide bars), so the
   description is dropped automatically on resize. */
function crSlots(g, use, template){
  use = use || {};
  const wantH = use.headline !== false;
  const wantD = !!use.description;
  const wantC = use.cta !== false;
  const wantBadge = !!use.discount;
  const { mode, minSide, w, h } = g;
  // Template 4 (Organic Frame) is a fixed 1:1 rebuild: headline only, no CTA, no description.
  if(template === 3){
    return { headline:wantH, description:false, cta:false, discount: wantBadge, descFits:false, tplLimited:true };
  }
  let descFits, ctaFits;
  if(mode === "micro"){ descFits = false;            ctaFits = w >= h * 4; }
  else if(mode === "wide"){ descFits = minSide >= 200; ctaFits = true; }
  else if(mode === "tall"){ descFits = minSide >= 200; ctaFits = true; }
  else { descFits = minSide >= 360; ctaFits = true; } // square / near-square
  // Solid Split: large portrait social (9:16 stories) reads cleaner full-frame — drop the CTA.
  if(template === 0 && mode === "tall" && minSide >= 700) ctaFits = false;
  return {
    headline: wantH,
    description: wantD && descFits,
    cta: wantC && ctaFits,
    discount: wantBadge && mode !== "micro",   // promo sticker needs a 2D area
    descFits,
  };
}

/* ---------- accent-aware headline ---------- */
function crSplit(text){
  const out = []; const re = /\*([^*]+)\*/g; let last = 0, m;
  while((m = re.exec(text))){
    if(m.index > last) out.push({ t:text.slice(last, m.index), hi:false });
    out.push({ t:m[1], hi:true });
    last = re.lastIndex;
  }
  if(last < text.length) out.push({ t:text.slice(last), hi:false });
  return out.length ? out : [{ t:text, hi:false }];
}
function CrHead({ text, accent, style }){
  return (
    <h3 style={style}>
      {crSplit(text).map((p, i) => (
        <span key={i} style={p.hi ? { color: accent } : null}>{p.t}</span>
      ))}
    </h3>
  );
}
/* sub-headline / description \u2014 only rendered when the format has room */
function CrDesc({ text, style }){
  if(!text) return null;
  return (
    <p style={{ margin:0, ...style }}>
      {crSplit(text).map((p, i) => (
        <span key={i} style={p.hi ? { fontWeight:600 } : null}>{p.t}</span>
      ))}
    </p>
  );
}
/* large promo / discount sticker — a circular badge, scales with the format.
   `pos`: "tr" (default) | "br" | "tl". */
function CrBadge({ text, g, bg, fg, ring, pos }){
  if(!text) return null;
  const { minSide } = g;
  const size = crClamp(minSide * 0.30, 54, 380);
  const fs   = crClamp(size * 0.30, 12, 116);
  const off  = crClamp(minSide * 0.05, 8, 66);
  const place = pos === "br" ? { bottom:off, right:off }
              : pos === "tl" ? { top:off, left:off }
              : { top:off, right:off };
  const ringW = crClamp(size * 0.035, 2, 7);
  return (
    <div style={{ position:"absolute", zIndex:6, ...place,
      width:size, height:size, borderRadius:"50%", background: bg || CR.yellow, color: fg || CR.ink,
      display:"flex", alignItems:"center", justifyContent:"center", textAlign:"center",
      transform:"rotate(-8deg)", boxShadow:"0 16px 34px rgba(11,15,13,.22)",
      outline: ring ? `${ringW}px solid ${ring}` : "none", outlineOffset: ring ? -ringW*2.6 : 0 }}>
      <span style={{ fontWeight:800, fontSize:fs, lineHeight:0.92, letterSpacing:"-.03em",
        textTransform:"uppercase", padding:"0 9%", maxWidth:"98%", wordBreak:"break-word" }}>{text}</span>
    </div>
  );
}

/* ---------- shared bits ---------- */
function crLogo(white){ return white ? "assets/logo-white.png" : "assets/logo-black.png"; }
function crSym(color){ // color: white | green | grey | black
  return `assets/symbol-${color}.png`;
}

/* The user's image (or a branded placeholder if none yet). */
function CrImg({ img, style, className }){
  if(img) return <img src={img} alt="" className={className} style={{ ...style, objectFit:"cover" }} />;
  return (
    <div className={className} style={{ ...style, display:"flex", alignItems:"center", justifyContent:"center",
      background:`repeating-linear-gradient(135deg, rgba(0,0,0,.05) 0 12px, rgba(0,0,0,0) 12px 24px), ${CR.green3}` }}>
      <span style={{ fontFamily:"ui-monospace,Menlo,monospace", fontSize: Math.max(9, style.__ph || 12),
        color:"rgba(255,255,255,.8)", letterSpacing:".06em", textTransform:"uppercase" }}>your photo</span>
    </div>
  );
}

/* compact bar used by every template on thin banner formats */
function CrMicro({ g, opts, theme }){
  const { w, h } = g;
  const slots = window.crSlots(g, opts.use, opts.template);
  const pad = crClamp(h * 0.18, 6, 22);
  const dark = theme.microPhoto && opts.img;          // T3 photo bar
  const bt = theme.id === 1 ? crTheme(opts.bg) : null;
  let bg, txt, logoWhite, ctaBg, ctaFg, accent;
  if(dark){ bg="#000"; txt=CR.white; logoWhite=true; ctaBg=CR.yellow; ctaFg=CR.ink; accent=CR.yellow; }
  else if(theme.id === 2){ bg=CR.white; txt=CR.ink; logoWhite=false; ctaBg=CR.green; ctaFg=CR.white; accent=CR.yellow; }
  else if(bt){ bg=bt.bg; txt=bt.text; logoWhite=bt.logoWhite; ctaBg=bt.ctaBg; ctaFg=bt.ctaFg; accent=bt.accent; }
  else { bg=CR.green; txt=CR.white; logoWhite=true; ctaBg=CR.yellow; ctaFg=CR.ink; accent=CR.yellow; }
  const symColor = logoWhite ? "white" : "black";    // symbol-only mark, no wordmark
  const headBase = crClamp(h * 0.32, 11, 32);
  const headMin  = crClamp(h * 0.19, 8, 17);
  const ctaFs = crClamp(h * 0.22, 9, 20);
  const ctaPadV = ctaFs * 0.5;
  const btnH = ctaFs + ctaPadV * 2;                    // CTA pill height (line-height:1)
  const showCta = slots.cta;
  // the mark reads as tall as the CTA pill — its PNG carries transparent
  // padding, so size the box a touch larger so the glyph matches the button.
  const logoH = showCta ? Math.min(btnH * 1.18, h - pad * 2) : crClamp(h * 0.5, 16, 56);
  const patSize = Math.max(w, h) * 1.7;               // brand pattern, enlarged + cropped
  // Deterministic geometry (absolute, not flex) so the off-screen export
  // rasteriser lays the headline out identically to the on-page preview.
  const symW = logoH;                                  // mark is ~square
  const gap = pad * 0.9;
  const ctaText = window.translate(opts.cta, opts.lang);
  const ctaResv = showCta ? Math.ceil(ctaText.length * ctaFs * 0.6 + ctaFs * 2) : 0;
  const textLeft = pad + symW + gap;
  const textRight = pad + (showCta ? ctaResv + gap : 0);
  const textW = Math.max(20, w - textLeft - textRight);
  return (
    <div style={{ position:"absolute", inset:0, background: bg, overflow:"hidden" }}>
      {dark && <CrImg img={opts.img} className="cr-abs" style={{ position:"absolute", inset:0, width:"100%", height:"100%", __ph:10 }} />}
      {dark && <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg,rgba(0,0,0,.7),rgba(0,0,0,.25))" }}></div>}
      {!dark &&
        <img src={crSym(logoWhite ? "white" : "grey")} alt="" style={{ position:"absolute", width:patSize, height:patSize,
          right:-patSize*0.42, top:"50%", transform:"translateY(-50%)", opacity: logoWhite ? 0.10 : 0.16, pointerEvents:"none" }} />}
      <img src={crSym(symColor)} alt="statero" style={{ position:"absolute", left:pad, top:"50%", transform:"translateY(-50%)", height:logoH, zIndex:2 }} />
      {slots.headline &&
      <div style={{ position:"absolute", left:textLeft, width:textW, top:pad, height:h-pad*2, zIndex:2,
        display:"flex", alignItems:"center" }}>
        <CrFitHead text={window.translate(opts.headline, opts.lang)} accent={accent} baseFs={headBase} minFs={headMin}
          maxW={textW} maxH={h-pad*2}
          style={{ margin:0, color:txt, fontWeight:700, lineHeight:1.04, letterSpacing:"-.01em", textTransform:"uppercase" }} />
      </div>}
      {showCta &&
        <span style={{ position:"absolute", right:pad, top:"50%", transform:"translateY(-50%)", zIndex:2, background: ctaBg,
          color: ctaFg, fontWeight:400, fontSize:ctaFs, lineHeight:1, padding:`${ctaPadV}px ${ctaFs}px`,
          borderRadius:999, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>{ctaText}</span>}
    </div>
  );
}

/* ============================================================
   TEMPLATE 1 — SOLID SPLIT
   Brand-green field + a rounded photo card. Headline with a
   yellow accent tail; yellow pill CTA. The photo card sits to
   the side on wide/square and below on tall.
   ============================================================ */
const CR_LOGO_AR = 1634/345;   // wordmark lockup aspect ratio (assets/logo-*.png)

/* How the Solid Split layout treats logo + composition for THIS placement:
   - micro  : thin banner bar (handled by CrMicro) — symbol mark only
   - display: Google Display / static banner — full WORDMARK lockup
   - social : social placement — image-led, NO logo, brand pattern on the field */
function crSurface(g, opts){
  if(g.mode === "micro") return "micro";
  const cat = opts && opts.cat;
  if(cat === "social" || cat === "video") return "social";
  if(cat === "google") return "display";
  return g.minSide >= 620 ? "social" : "display";   // no category (preview/grid) → infer by size
}

function CrT1({ g, opts }){
  if(g.mode === "micro") return <CrMicro g={g} opts={opts} theme={{ id:1 }} />;
  return crSurface(g, opts) === "social"
    ? <CrT1Social g={g} opts={opts} />
    : <CrT1Display g={g} opts={opts} />;
}

/* ---------- DISPLAY: Google / static banners — full wordmark lockup ---------- */
function CrT1Display({ g, opts }){
  const { w, h, mode, minSide } = g;
  const t = crTheme(opts.bg);
  const slots = window.crSlots(g, opts.use, opts.template);
  const pad = crClamp(minSide * 0.075, 14, 84);
  const head = window.translate(opts.headline, opts.lang);
  const desc = window.translate(opts.description, opts.lang);
  const cta  = window.translate(opts.cta, opts.lang);
  const radius = crClamp(minSide * 0.035, 4, 28);                 // proportional, smaller on small formats
  const wordmark = crLogo(t.logoWhite);                           // FULL wordmark + text part
  const symSize = Math.max(w, h) * 0.95;                          // brand pattern — enlarged + cropped

  const Pattern = (
    <img src={crSym(t.sym)} alt="" style={{ position:"absolute", width:symSize, height:symSize,
      opacity: t.sym==="grey" ? 0.16 : 0.12, left:-symSize*0.20, top:-symSize*0.24, pointerEvents:"none" }} />
  );

  /* ---------- WIDE: text column left, photo card right ---------- */
  if(mode === "wide"){
    const cardW = w * 0.5 - pad;                       // half the width, minus the right gap
    const card = { left:w-cardW-pad, top:pad, width:cardW, height:h-pad*2 };
    const textW = (w - cardW - pad*2) - pad*0.4;
    const wordH = Math.min(crClamp(minSide * 0.10, 15, 56), textW/CR_LOGO_AR);
    const headFs = crClamp(h * 0.135, 22, 132);
    const ctaFs = crClamp(headFs * 0.38, 13, 40);
    const descFs = crClamp(headFs * 0.30, 13, 36);
    const textH = h - pad*2;
    const reserve = wordH + pad*0.5
      + (slots.description ? descFs*1.32*2 + pad*0.42 : 0)
      + (slots.cta ? ctaFs*2.3 + pad*0.55 : 0);
    const headMaxH = Math.max(headFs*0.9, textH - reserve - pad*0.45);
    const headMinFs = crClamp(headFs*0.32, 11, 30);
    return (
      <div style={{ position:"absolute", inset:0, background:t.bg, overflow:"hidden" }}>
        {Pattern}
        <div style={{ position:"absolute", left:pad, top:pad, width:textW, height:textH,
          display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <img src={wordmark} alt="Statero" style={{ height:wordH, alignSelf:"flex-start", flex:"none" }} />
          <div style={{ marginTop:"auto", display:"flex", flexDirection:"column", minHeight:0 }}>
            {slots.headline &&
            <CrFitHead text={head} accent={t.accent} baseFs={headFs} minFs={headMinFs} maxW={textW} maxH={headMaxH}
              style={{ margin:0, color:t.text, fontWeight:700,
                lineHeight:1.02, letterSpacing:"-.02em", textTransform:"uppercase", textWrap:"balance" }} />}
            {slots.description &&
            <CrDesc text={desc} style={{ marginTop:pad*0.42, marginBottom:0, color: t.logoWhite ? "rgba(255,255,255,.92)" : "rgba(11,15,13,.66)",
              fontWeight:400, fontSize:descFs, lineHeight:1.3, letterSpacing:"-.01em",
              maxWidth:textW, textWrap:"pretty", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }} />}
            {slots.cta &&
            <span style={{ marginTop:pad*0.55, alignSelf:"flex-start", background:t.ctaBg, color:t.ctaFg,
              fontWeight:400, fontSize:ctaFs, padding:`${ctaFs*0.6}px ${ctaFs*1.4}px`, borderRadius:999, whiteSpace:"nowrap" }}>{cta}</span>}
          </div>
        </div>
        <CrImg img={opts.img} className="cr-abs"
          style={{ position:"absolute", ...card, borderRadius:radius, __ph: card.width*0.04 }} />
        {slots.discount &&
          <CrBadge text={window.translate(opts.discount, opts.lang)} g={g}
            bg={t.badgeBg} fg={t.badgeFg} ring={t.badgeRing} pos="tr" />}
      </div>
    );
  }

  /* ---------- TALL + SQUARE: wordmark + headline (+ desc) / photo / full-width CTA below ---------- */
  const availW = w - pad*2;
  const wordH = Math.min(crClamp(minSide * 0.085, 14, 52), availW/CR_LOGO_AR);
  const headFs = crClamp(w * 0.13, 18, 150);
  const ctaFs  = crClamp(minSide * 0.07, 13, 40);
  const descFs = crClamp(w * 0.045, 13, 34);
  const gap = pad * 0.42;
  const headMaxH = mode === "tall" ? crClamp(h*0.26, 40, 460) : crClamp(h*0.20, 36, 220);
  const headMinFs = crClamp(headFs*0.34, 11, 30);
  const photoMin = mode === "tall" ? h*0.34 : h*0.30;
  // narrow skyscrapers read better with the wordmark spanning the full column
  const narrowTall = mode === "tall" && w < 220;
  return (
    <div style={{ position:"absolute", inset:0, background:t.bg, overflow:"hidden" }}>
      {Pattern}
      <div style={{ position:"absolute", inset:0, padding:pad, boxSizing:"border-box",
        display:"flex", flexDirection:"column", gap:gap, zIndex:2 }}>
        <img src={wordmark} alt="Statero" style={ narrowTall
          ? { width:w-pad*2, height:"auto", alignSelf:"flex-start", flex:"none" }
          : { height:wordH, alignSelf:"flex-start", flex:"none" } } />
        {slots.headline &&
        <CrFitHead text={head} accent={t.accent} baseFs={headFs} minFs={headMinFs} maxW={w-pad*2} maxH={headMaxH}
          style={{ margin:0, flex:"none", color:t.text, fontWeight:700,
            lineHeight:1.04, letterSpacing:"-.02em", textTransform:"uppercase", textWrap:"balance" }} />}
        {slots.description &&
        <CrDesc text={desc} style={{ margin:0, flex:"none", color: t.logoWhite ? "rgba(255,255,255,.92)" : "rgba(11,15,13,.66)",
          fontWeight:400, fontSize:descFs, lineHeight:1.3, letterSpacing:"-.01em", textWrap:"pretty",
          overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }} />}
        <div style={{ flex:"1 1 auto", minHeight:photoMin, width:"100%", position:"relative" }}>
          <CrImg img={opts.img} className="cr-abs"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", borderRadius:radius, __ph:(w-pad*2)*0.05 }} />
        </div>
        {slots.cta &&
        <span style={{ flex:"none", width:"100%", boxSizing:"border-box",
          display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1,
          background:t.ctaBg, color:t.ctaFg, fontWeight:400, fontSize:ctaFs,
          padding:`${ctaFs*0.42}px ${ctaFs}px`, borderRadius:999, whiteSpace:"nowrap" }}>{cta}</span>}
      </div>
      {slots.discount &&
        <CrBadge text={window.translate(opts.discount, opts.lang)} g={g}
          bg={t.badgeBg} fg={t.badgeFg} ring={t.badgeRing} pos="tr" />}
    </div>
  );
}

/* ---------- SOCIAL: image-led, NO logo, brand pattern on the green field ---------- */
function CrT1Social({ g, opts }){
  const { w, h, mode, minSide } = g;
  const t = crTheme(opts.bg);
  const slots = window.crSlots(g, opts.use, opts.template);
  const pad = crClamp(minSide * 0.062, 22, 104);
  const head = window.translate(opts.headline, opts.lang);
  const desc = window.translate(opts.description, opts.lang);
  const cta  = window.translate(opts.cta, opts.lang);
  const use = opts.use || {};
  const wantH = use.headline !== false && head;
  const wantD = !!use.description && !!desc;
  const wantC = use.cta !== false && cta;
  const radius = crClamp(minSide * 0.04, 12, 44);
  const symSize = Math.max(w, h) * 1.08;                          // brand element on the background
  const subColor = t.logoWhite ? "rgba(255,255,255,.92)" : "rgba(11,15,13,.66)";
  const Pattern = (
    <img src={crSym(t.sym)} alt="" style={{ position:"absolute", width:symSize, height:symSize,
      opacity: t.sym==="grey" ? 0.16 : 0.12, left:-symSize*0.16, top:-symSize*0.20, pointerEvents:"none" }} />
  );

  /* ---------- WIDE: text column + photo card ---------- */
  if(mode === "wide"){
    const cardW = w * 0.46;
    const card = { right:pad, top:pad, width:cardW, height:h-pad*2 };
    const textW = (w - cardW - pad*2) - pad*0.5;
    const headFs = crClamp(h * 0.115, 22, 118);
    const ctaFs  = crClamp(headFs * 0.38, 15, 42);
    const descFs = crClamp(headFs * 0.32, 14, 34);
    const headMinFs = crClamp(headFs*0.34, 13, 30);
    return (
      <div style={{ position:"absolute", inset:0, background:t.bg, overflow:"hidden" }}>
        {Pattern}
        <div style={{ position:"absolute", left:pad, top:pad, width:textW, height:h-pad*2, zIndex:2,
          display:"flex", flexDirection:"column", justifyContent:"center",
          alignItems:"flex-start", textAlign:"left" }}>
          {wantH &&
          <CrFitHead text={head} accent={t.accent} baseFs={headFs} minFs={headMinFs} maxW={textW} maxH={h*0.6}
            style={{ margin:0, color:t.text, fontWeight:700, lineHeight:1.04,
              letterSpacing:"-.02em", textTransform:"uppercase", textWrap:"balance" }} />}
          {wantD &&
          <CrDesc text={desc} style={{ marginTop:pad*0.42, color:subColor, fontWeight:400, fontSize:descFs,
            lineHeight:1.3, letterSpacing:"-.01em", maxWidth:textW, textWrap:"pretty",
            overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }} />}
          {wantC &&
          <span style={{ marginTop:pad*0.55, background:t.ctaBg, color:t.ctaFg, fontWeight:400, fontSize:ctaFs,
            padding:`${ctaFs*0.6}px ${ctaFs*1.4}px`, borderRadius:999, whiteSpace:"nowrap" }}>{cta}</span>}
        </div>
        <CrImg img={opts.img} className="cr-abs"
          style={{ position:"absolute", ...card, borderRadius:radius, __ph: card.width*0.04 }} />
        {slots.discount &&
          <CrBadge text={window.translate(opts.discount, opts.lang)} g={g}
            bg={t.badgeBg} fg={t.badgeFg} ring={t.badgeRing} pos="tr" />}
      </div>
    );
  }

  /* ---------- SQUARE + TALL: photo hero + headline (+ desc) + CTA, no logo ---------- */
  const photoFirst = mode === "tall";                             // stories: image on top
  const headFs = crClamp(w * 0.082, 22, 132);
  const ctaFs  = crClamp(minSide * 0.05, 16, 46);
  const descFs = crClamp(w * 0.036, 15, 36);
  const gap = pad * 0.5;
  const headMaxH = mode === "tall" ? crClamp(h*0.18, 40, 380) : crClamp(h*0.22, 40, 280);
  const headMinFs = crClamp(headFs*0.34, 14, 28);
  const photoMin = mode === "tall" ? h*0.44 : h*0.36;
  const Photo = (
    <div style={{ flex:"1 1 auto", minHeight:photoMin, width:"100%", position:"relative" }}>
      <CrImg img={opts.img} className="cr-abs"
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", borderRadius:radius, __ph:(w-pad*2)*0.05 }} />
    </div>
  );
  const TextBlock = (
    <React.Fragment>
      {wantH &&
      <CrFitHead text={head} accent={t.accent} baseFs={headFs} minFs={headMinFs} maxW={w-pad*2} maxH={headMaxH}
        style={{ margin:0, flex:"none", color:t.text, fontWeight:700, lineHeight:1.04,
          letterSpacing:"-.02em", textTransform:"uppercase", textWrap:"balance" }} />}
      {wantD &&
      <CrDesc text={desc} style={{ margin:0, flex:"none", color:subColor, fontWeight:400, fontSize:descFs,
        lineHeight:1.3, letterSpacing:"-.01em", textWrap:"pretty",
        overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }} />}
    </React.Fragment>
  );
  return (
    <div style={{ position:"absolute", inset:0, background:t.bg, overflow:"hidden" }}>
      {Pattern}
      <div style={{ position:"absolute", inset:0, padding:pad, boxSizing:"border-box",
        display:"flex", flexDirection:"column", gap:gap, zIndex:2 }}>
        {photoFirst
          ? <React.Fragment>{Photo}{TextBlock}</React.Fragment>
          : <React.Fragment>{TextBlock}{Photo}</React.Fragment>}
        {wantC &&
        <span style={{ flex:"none", width:"100%", boxSizing:"border-box",
          display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1,
          background:t.ctaBg, color:t.ctaFg, fontWeight:400, fontSize:ctaFs,
          padding:`${ctaFs*0.42}px ${ctaFs}px`, borderRadius:999, whiteSpace:"nowrap" }}>{cta}</span>}
      </div>
      {slots.discount &&
        <CrBadge text={window.translate(opts.discount, opts.lang)} g={g}
          bg={t.badgeBg} fg={t.badgeFg} ring={t.badgeRing} pos="tr" />}
    </div>
  );
}

/* ============================================================
   TEMPLATE 2 — WAVE PANEL
   Photo on top, a curved wave reveals a clean white panel that
   carries a black headline with a yellow accent. On wide the
   split runs left↔right; on tall/square it runs top↔bottom.
   ============================================================ */
function CrT2({ g, opts }){
  if(g.mode === "micro") return <CrMicro g={g} opts={opts} theme={{ id:2 }} />;
  const { w, h, mode, minSide } = g;
  const slots = window.crSlots(g, opts.use, opts.template);
  const pad = crClamp(minSide * 0.075, 16, 80);
  const head = window.translate(opts.headline, opts.lang);
  const desc = window.translate(opts.description, opts.lang);
  const cta  = window.translate(opts.cta, opts.lang);
  const logoH = crClamp(minSide * 0.07, 20, 56);
  const vertical = mode === "wide"; // wide → photo left / panel right

  if(vertical){
    const split = w * 0.56;
    const headFs = crClamp(h * 0.15, 22, 132);
    const ctaFs = crClamp(headFs * 0.40, 13, 38);
    const descFs = crClamp(headFs * 0.30, 13, 36);
    const contH = h - pad*2, headW = w-split-pad*1.4;
    const clearW = slots.discount
      ? Math.max(headW*0.5, (w - crClamp(minSide*0.05,8,66) - crClamp(minSide*0.30,54,380)) - (split+pad*0.4))
      : headW;
    const reserve = (slots.description ? descFs*1.32*2 + pad*0.45 : 0) + (slots.cta ? ctaFs*2.3 + pad*0.6 : 0);
    const headMaxH = Math.max(headFs*0.9, contH - reserve - pad*0.45), headMinFs = crClamp(headFs*0.34, 12, 28);
    return (
      <div style={{ position:"absolute", inset:0, background:CR.white }}>
        <CrImg img={opts.img} className="cr-abs" style={{ position:"absolute", left:0, top:0, width:split, height:h, __ph:14 }} />
        <img src={crLogo(true)} alt="statero" style={{ position:"absolute", left:pad, top:pad, height:logoH, zIndex:3 }} />
        {/* vertical wave */}
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:2 }}>
          <path d={`M${split-h*0.12},0 C${split+h*0.10},${h*0.30} ${split-h*0.12},${h*0.7} ${split+h*0.06},${h} L${w},${h} L${w},0 Z`} fill={CR.white} />
        </svg>
        <div style={{ position:"absolute", right:pad, top:pad, width:headW, height:contH, zIndex:3,
          display:"flex", flexDirection:"column", justifyContent:"center" }}>
          {slots.headline &&
          <CrFitHead text={head} accent={CR.yellow} baseFs={headFs} minFs={headMinFs} maxW={Math.min(headW, clearW)} maxH={headMaxH}
            style={{ margin:0, color:CR.ink, fontWeight:700, lineHeight:1.04,
              letterSpacing:"-.02em", textTransform:"uppercase", textWrap:"balance" }} />}
          {slots.description &&
          <CrDesc text={desc} style={{ marginTop:pad*0.45, color:"rgba(11,15,13,.64)", fontWeight:400,
            fontSize:descFs, lineHeight:1.32, letterSpacing:"-.01em", maxWidth:Math.min(headW, clearW), textWrap:"pretty",
            overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }} />}
          {slots.cta &&
          <span style={{ marginTop:pad*0.6, alignSelf:"flex-start", background:CR.green, color:CR.white,
            fontWeight:700, fontSize:ctaFs, padding:`${ctaFs*0.6}px ${ctaFs*1.4}px`, borderRadius:999, whiteSpace:"nowrap" }}>{cta}</span>}
        </div>
        {slots.discount &&
          <CrBadge text={window.translate(opts.discount, opts.lang)} g={g}
            bg={CR.yellow} fg={CR.ink} ring={CR.green} pos="tr" />}
      </div>
    );
  }

  // top photo / bottom white panel
  const split = h * (mode === "tall" ? 0.56 : 0.6);
  const headFs = crClamp(minSide * 0.11, 20, 118);
  const ctaFs = crClamp(headFs * 0.42, 13, 36);
  const descFs = crClamp(headFs * 0.32, 13, 34);
  const wave = h * 0.07;
  const contH = (h - pad) - (split + wave*0.5), headW = w - pad*2;
  const reserve = (slots.description ? descFs*1.32*2 + pad*0.42 : 0) + (slots.cta ? ctaFs*2.3 + pad*0.55 : 0);
  const headMaxH = Math.max(headFs*0.9, contH - reserve - pad*0.45), headMinFs = crClamp(headFs*0.34, 12, 26);
  return (
    <div style={{ position:"absolute", inset:0, background:CR.white }}>
      <CrImg img={opts.img} className="cr-abs" style={{ position:"absolute", left:0, top:0, width:w, height:split+wave, __ph:14 }} />
      <img src={crLogo(true)} alt="statero" style={{ position:"absolute", right:pad, top:pad, height:logoH, zIndex:3 }} />
      {/* horizontal wave */}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:2 }}>
        <path d={`M0,${split-wave} C${w*0.32},${split+wave} ${w*0.68},${split-wave*1.6} ${w},${split} L${w},${h} L0,${h} Z`} fill={CR.white} />
      </svg>
      <div style={{ position:"absolute", left:pad, right:pad, top:split+wave*0.5, bottom:pad, zIndex:3,
        display:"flex", flexDirection:"column", justifyContent:"center" }}>
        {slots.headline &&
        <CrFitHead text={head} accent={CR.yellow} baseFs={headFs} minFs={headMinFs} maxW={headW} maxH={headMaxH}
          style={{ margin:0, color:CR.ink, fontWeight:700, lineHeight:1.04,
            letterSpacing:"-.02em", textTransform:"uppercase", textWrap:"balance" }} />}
        {slots.description &&
        <CrDesc text={desc} style={{ marginTop:pad*0.42, color:"rgba(11,15,13,.64)", fontWeight:400,
          fontSize:descFs, lineHeight:1.32, letterSpacing:"-.01em", maxWidth:"96%", textWrap:"pretty",
          overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }} />}
        {slots.cta &&
        <span style={{ marginTop:pad*0.55, alignSelf:"flex-start", background:CR.green, color:CR.white,
          fontWeight:700, fontSize:ctaFs, padding:`${ctaFs*0.6}px ${ctaFs*1.4}px`, borderRadius:999, whiteSpace:"nowrap" }}>{cta}</span>}
      </div>
      {slots.discount &&
        <CrBadge text={window.translate(opts.discount, opts.lang)} g={g}
          bg={CR.yellow} fg={CR.ink} ring={CR.green} pos="tr" />}
    </div>
  );
}

/* ============================================================
   TEMPLATE 3 — IMMERSIVE OVERLAY
   Full-bleed photo, logo top-left, a soft scrim, white headline
   lower-left with a yellow accent and a green pill CTA. White
   circular cut-outs echo the mark's "meeting point" geometry.
   ============================================================ */
function CrT3({ g, opts }){
  if(g.mode === "micro") return <CrMicro g={g} opts={opts} theme={{ id:3, microPhoto:true }} />;
  const { w, h, mode, minSide } = g;
  const slots = window.crSlots(g, opts.use, opts.template);
  const pad = crClamp(minSide * 0.075, 16, 84);
  const head = window.translate(opts.headline, opts.lang);
  const desc = window.translate(opts.description, opts.lang);
  const cta  = window.translate(opts.cta, opts.lang);
  const logoH = crClamp(minSide * 0.07, 20, 58);
  const headFs = mode === "wide"
    ? crClamp(h * 0.15, 22, 124)
    : crClamp(minSide * 0.12, 20, 130);
  const ctaFs = crClamp(headFs * 0.42, 13, 38);
  const descFs = crClamp(headFs * 0.32, 13, 36);
  const headMax = mode === "wide" ? "64%" : "94%";
  const headW = (w - pad*2) * (mode === "wide" ? 0.64 : 0.94);
  const reserve = (slots.description ? descFs*1.3*2 + pad*0.4 : 0) + (slots.cta ? ctaFs*2.3 + pad*0.55 : 0);
  const headMaxH = Math.max(headFs*0.9, (mode=="wide" ? h*0.62 : h*0.54) - reserve);
  const headMinFs = crClamp(headFs*0.34, 12, 28);
  const blob = minSide * 0.42;

  return (
    <div style={{ position:"absolute", inset:0, background:CR.ink, overflow:"hidden" }}>
      <CrImg img={opts.img} className="cr-abs" style={{ position:"absolute", inset:0, width:"100%", height:"100%", __ph:14 }} />
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(180deg, rgba(11,15,13,.10) 0%, rgba(11,15,13,.20) 42%, rgba(11,15,13,.78) 100%)" }}></div>
      {/* promo badge (only when a discount is enabled) */}
      {slots.discount &&
        <CrBadge text={window.translate(opts.discount, opts.lang)} g={g}
          bg={CR.yellow} fg={CR.ink} ring="rgba(255,255,255,.92)" pos="tr" />}
      <img src={crLogo(true)} alt="statero" style={{ position:"absolute", left:pad, top:pad, height:logoH, zIndex:3 }} />
      <div style={{ position:"absolute", left:pad, right:pad, bottom:pad, zIndex:3 }}>
        {slots.headline &&
        <CrFitHead text={head} accent={CR.yellow} baseFs={headFs} minFs={headMinFs} maxW={headW} maxH={headMaxH}
          style={{ margin:0, color:CR.white, fontWeight:700,
            lineHeight:1.03, letterSpacing:"-.02em", textTransform:"uppercase", textWrap:"balance",
            textShadow:"0 2px 30px rgba(0,0,0,.35)" }} />}
        {slots.description &&
        <CrDesc text={desc} style={{ marginTop:pad*0.4, maxWidth:headMax, color:"rgba(255,255,255,.92)",
          fontWeight:400, fontSize:descFs, lineHeight:1.3, letterSpacing:"-.01em",
          textWrap:"pretty", textShadow:"0 2px 24px rgba(0,0,0,.45)",
          overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }} />}
        {slots.cta &&
        <span style={{ display:"inline-block", marginTop:pad*0.55, background:CR.green, color:CR.white,
          fontWeight:700, fontSize:ctaFs, padding:`${ctaFs*0.6}px ${ctaFs*1.4}px`, borderRadius:999, whiteSpace:"nowrap" }}>{cta}</span>}
      </div>
    </div>
  );
}

/* ============================================================
   TEMPLATE 4 — ORGANIC FRAME  (1:1 rebuild of the source file)
   Exact composition lifted from the brand creative:
   full-bleed photo, the file's own organic green frame
   (assets/t04-frame.png), the wordmark bottom-left and a two-line
   white headline. The fixed 1920×1080 art is cover-fitted to any
   format so the geometry never distorts.
   ============================================================ */
const T04 = { W:1920, H:1080 };
function CrT4({ g, opts }){
  const { w, h } = g;
  const slots = window.crSlots(g, opts.use, 3);
  const scale = Math.max(w / T04.W, h / T04.H);   // cover-fit, no distortion
  const ox = (w - T04.W*scale) / 2;
  const oy = (h - T04.H*scale) / 2;
  const head = window.translate(opts.headline, opts.lang);
  const photo = opts.img || "assets/t04-photo.jpg";
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", background:CR.green }}>
      <div style={{ position:"absolute", left:ox, top:oy, width:T04.W, height:T04.H,
        transform:`scale(${scale})`, transformOrigin:"top left" }}>
        {/* photo — placed exactly as in the file (1920×1539 @ y −229) */}
        <div style={{ position:"absolute", left:0, top:-229, width:1920, height:1539, overflow:"hidden" }}>
          <CrImg img={photo} className="cr-abs"
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", __ph:20 }} />
        </div>
        {/* the file's exact organic green frame */}
        <img src="assets/t04-frame.png" alt="" style={{ position:"absolute", left:0, top:0, width:1920, height:1080 }} />
        {/* wordmark, bottom-left */}
        <img src={crLogo(true)} alt="statero" style={{ position:"absolute", left:66, top:844, height:72 }} />
        {/* two-line headline */}
        {slots.headline &&
        <CrFitHead text={head} accent={CR.white} baseFs={99} minFs={44} maxW={1335} maxH={232}
          style={{ position:"absolute", left:545, top:831, width:1335, margin:0,
            fontFamily:'"Readex Pro", sans-serif', fontWeight:700, lineHeight:1.0,
            letterSpacing:0, color:CR.white, textTransform:"uppercase" }} />}
      </div>
      {slots.discount &&
        <CrBadge text={window.translate(opts.discount, opts.lang)} g={g}
          bg={CR.yellow} fg={CR.ink} ring="rgba(255,255,255,.92)" pos="tr" />}
    </div>
  );
}

/* ---------- registry ---------- */
const CR_RENDERERS = [CrT1, CrT2, CrT3, CrT4];

const TEMPLATES = [
  { id:0, name:"Solid Split",   tag:"Brand-green field + rounded photo card",
    blurb:"Bold promo layout. Solid green panel carries the headline and a yellow CTA; your photo rides in a rounded card beside it.",
    accents:[CR.green, CR.yellow] },
  { id:1, name:"Wave Panel",    tag:"Photo + curved white panel",
    blurb:"Editorial split. A curved wave hands off from the photo to a clean white panel with a black headline and green CTA.",
    accents:[CR.white, CR.green] },
  { id:2, name:"Immersive",     tag:"Full-bleed photo overlay",
    blurb:"Lifestyle-led. The image fills the frame; logo, headline and CTA sit over a soft scrim with brand cut-outs.",
    accents:[CR.ink, CR.green] },
  { id:3, name:"Organic Frame", tag:"Photo in the green brand frame",
    blurb:"Rebuilt 1:1 from the source creative — the file's own organic green frame wraps a full-bleed photo, with the wordmark and a two-line headline along the bottom.",
    accents:[CR.green, CR.white] },
];

/* ============================================================
   CREATIVE — render one creative at one format.
   Rendered at native px then transform-scaled into a maxW×maxH
   box. Shared by the live preview and the results grid.
   ============================================================ */
function Creative({ fmt, opts, maxW, maxH }){
  const g = crGeo(fmt);
  const s = crClamp(Math.min(maxW / fmt.w, maxH / fmt.h), 0.02, 1.3);
  const t = (opts.template != null) ? opts.template : 0;
  const Render = CR_RENDERERS[t] || CrT1;
  const lang = opts.lang || "en";
  const rtl = !!opts.rtl;
  return (
    <div style={{ width:fmt.w*s, height:fmt.h*s, flex:"none", position:"relative", overflow:"hidden",
      borderRadius:crClamp(g.minSide*0.022*s, 1, 9) }}>
      <div className={"cr cr--t"+t} dir={rtl ? "rtl" : "ltr"} lang={lang}
        style={{ position:"absolute", top:0, left:0, width:fmt.w, height:fmt.h,
          transform:`scale(${s})`, transformOrigin:"top left" }}>
        <Render g={g} opts={{ ...opts, lang }} />
      </div>
    </div>
  );
}

/* ---------- expose ---------- */
Object.assign(window, {
  Creative, TEMPLATES,
  crClamp, crGeo, crSplit, crSlots, crTheme, BG_OPTIONS, CR_PALETTE: CR,
});
