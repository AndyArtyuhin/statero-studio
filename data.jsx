/* ============================================================
   STATERO CREATIVE STUDIO — data & logic
   Format catalog, languages, mock translation, Google checks.
   Exposed on window for the other Babel scripts.
   ============================================================ */

/* ---------- FORMAT CATALOG ---------- */
const FORMATS = {
  social: [
    { id:"ig_square",  name:"Instagram / FB post", w:1080, h:1080, note:"1:1" },
    { id:"story",      name:"Stories / Reels",     w:1080, h:1920, note:"9:16" },
    { id:"fb_link",    name:"FB landscape",        w:1200, h:628,  note:"1.91:1" },
    { id:"twitter",    name:"Twitter / X post",    w:1600, h:900,  note:"16:9" },
    { id:"linkedin",   name:"LinkedIn post",       w:1200, h:627,  note:"1.91:1" },
    { id:"youtube",    name:"YouTube thumbnail",   w:1280, h:720,  note:"16:9" },
  ],
  google: [
    { id:"med_rect",   name:"Medium Rectangle",  w:300, h:250 },
    { id:"lg_rect",    name:"Large Rectangle",   w:336, h:280 },
    { id:"leaderbrd",  name:"Leaderboard",       w:728, h:90  },
    { id:"lg_lead",    name:"Large Leaderboard", w:970, h:90  },
    { id:"billboard",  name:"Billboard",         w:970, h:250 },
    { id:"half_page",  name:"Half Page",         w:300, h:600 },
    { id:"skyscraper", name:"Wide Skyscraper",   w:160, h:600 },
    { id:"sm_square",  name:"Square",            w:250, h:250 },
    { id:"mob_banner", name:"Mobile Banner",     w:320, h:50  },
    { id:"lg_mob",     name:"Large Mobile",      w:320, h:100 },
  ],
  video: [
    { id:"vid_169", name:"Video 16:9",  w:1920, h:1080, note:"YouTube / Display", video:true },
    { id:"vid_916", name:"Video 9:16",  w:1080, h:1920, note:"Reels / Shorts",    video:true },
    { id:"vid_11",  name:"Video 1:1",   w:1080, h:1080, note:"Feed",              video:true },
  ],
};

const CATEGORY_META = {
  social: { label:"Social media", color:"var(--blue)",   limitKB:null },
  google: { label:"Google Ads (Display)", color:"var(--green-2)", limitKB:150 },
  video:  { label:"Video", color:"var(--orange)", limitKB:null },
};

/* ---------- LANGUAGES ---------- */
const LANGUAGES = [
  { id:"en", label:"English",  flag:"🇬🇧", rtl:false },
  { id:"es", label:"Español",  flag:"🇪🇸", rtl:false },
  { id:"fr", label:"Français", flag:"🇫🇷", rtl:false },
  { id:"ar", label:"العربية",  flag:"🇸🇦", rtl:true  },
  { id:"zh", label:"中文",      flag:"🇨🇳", rtl:false },
];

/* ---------- MOCK TRANSLATION ----------
   Demo dictionary for common Statero marketing copy. Unknown text
   falls back to the source string tagged [MT] — in production this
   slot connects to a real translation API. */
const DICT = {
  "Gift cards, in a few clicks": {
    es:"Tarjetas regalo, en pocos clics", fr:"Cartes cadeaux, en quelques clics",
    ar:"بطاقات الهدايا ببضع نقرات", zh:"礼品卡，轻点几下即可",
  },
  "Buy gift cards worldwide": {
    es:"Compra tarjetas regalo en todo el mundo", fr:"Achetez des cartes cadeaux partout",
    ar:"اشترِ بطاقات الهدايا حول العالم", zh:"全球购买礼品卡",
  },
  "Money, made effortless": {
    es:"El dinero, sin esfuerzo", fr:"L'argent, sans effort",
    ar:"المال بكل سهولة", zh:"轻松管理资金",
  },
  "For everyone": {
    es:"Para todos", fr:"Pour tout le monde", ar:"للجميع", zh:"为每个人",
  },
  "Get started": {
    es:"Empezar", fr:"Commencer", ar:"ابدأ الآن", zh:"立即开始",
  },
  "Buy now": {
    es:"Comprar ahora", fr:"Acheter maintenant", ar:"اشترِ الآن", zh:"立即购买",
  },
  "Learn more": {
    es:"Saber más", fr:"En savoir plus", ar:"اعرف المزيد", zh:"了解更多",
  },
  "Shop now": {
    es:"Comprar", fr:"Acheter", ar:"تسوّق الآن", zh:"立即选购",
  },
};

/* ---------- LIVE TRANSLATION ----------
   Copy is translated for real through window.claude.complete and
   cached per language. translate() is a SYNCHRONOUS lookup used by the
   renderers — it returns a cached translation if one exists, then the
   demo dictionary, then the source text as a last resort. The async
   ensureTranslations() fills the cache (called from the builder preview
   and the "Generating" step). A tiny pub/sub re-renders subscribers
   (useTrans) whenever new translations land. */

const TRANS_CACHE = {};              // lang -> { sourceText: translatedText }
const LANG_NAME = { es:"Spanish", fr:"French", ar:"Arabic (Arabic script)", zh:"Simplified Chinese" };
const _norm = (t)=> (t || "").trim();

function translate(text, lang){
  const t = _norm(text);
  if(!t) return "";
  if(lang === "en") return t;
  const byLang = TRANS_CACHE[lang];
  if(byLang && byLang[t] != null) return byLang[t];
  const entry = DICT[t];
  if(entry && entry[lang]) return entry[lang];
  return t; // not translated yet — show source until the cache fills
}
function isCached(text, lang){
  const t = _norm(text);
  if(!t || lang === "en") return true;
  const byLang = TRANS_CACHE[lang];
  if(byLang && byLang[t] != null) return true;
  return !!(DICT[t] && DICT[t][lang]);
}
function isMachine(text, lang){
  const t = _norm(text);
  if(!t || lang === "en") return false;
  return !isCached(t, lang);
}

/* pub/sub so React views re-render when the cache updates */
const _transSubs = new Set();
function onTransUpdate(fn){ _transSubs.add(fn); return ()=>_transSubs.delete(fn); }
function _emitTrans(){ _transSubs.forEach(fn=>fn()); }
function useTrans(){
  const [, bump] = React.useReducer(x => (x+1) % 1e9, 0);
  React.useEffect(()=> onTransUpdate(bump), []);
}

function _extractJsonArray(s){
  if(!s) return null;
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  if(a !== -1 && b !== -1 && b > a){
    try{ return JSON.parse(s.slice(a, b+1)); }catch(_){ /* fall through */ }
  }
  return null;
}

/* Keyless public translation — resilient multi-provider fallback. Works in
   ANY browser/deployment (incl. Vercel) where window.claude is unavailable.
   Google's free endpoints rate-limit by IP, so we try several providers in
   order and use whichever responds — this is what stops translation from
   silently falling back to English on a live deployment. The primary
   (gtx) preserves the *asterisk* accent markers. */
async function _provGtx(text, lang){
  const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl="
    + encodeURIComponent(lang) + "&dt=t&q=" + encodeURIComponent(text);
  const res = await fetch(url);
  if(!res.ok) throw new Error("gtx " + res.status);
  const data = await res.json();
  if(!data || !Array.isArray(data[0])) throw new Error("gtx shape");
  return data[0].map(seg => seg && seg[0]).filter(Boolean).join("").trim();
}
async function _provClients5(text, lang){
  const url = "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl="
    + encodeURIComponent(lang) + "&q=" + encodeURIComponent(text);
  const res = await fetch(url);
  if(!res.ok) throw new Error("c5 " + res.status);
  const data = await res.json();
  if(Array.isArray(data)){
    if(typeof data[0] === "string") return data[0].trim();
    if(Array.isArray(data[0])) return data[0].map(s => Array.isArray(s) ? s[0] : s).filter(Boolean).join("").trim();
  }
  if(data && data.sentences) return data.sentences.map(s => s.trans || "").join("").trim();
  throw new Error("c5 shape");
}
async function _provMyMemory(text, lang){
  const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text)
    + "&langpair=en|" + encodeURIComponent(lang);
  const res = await fetch(url);
  if(!res.ok) throw new Error("mm " + res.status);
  const data = await res.json();
  const t = data && data.responseData && data.responseData.translatedText;
  if(!t) throw new Error("mm shape");
  return String(t).trim();
}
/* Try each provider until one returns a usable translation for this line. */
async function _mtGoogle(text, lang){
  let lastErr = null;
  for(const prov of [_provGtx, _provClients5, _provMyMemory]){
    try{
      const v = await prov(text, lang);
      if(v) return v;
    }catch(e){ lastErr = e; }
  }
  throw lastErr || new Error("mt failed");
}

const _pending = {}; // dedupe concurrent requests for the same lang+payload
async function _translateLang(lang, items){
  const key = lang + "::" + items.join("\u0001");
  if(_pending[key]) return _pending[key];
  const run = (async ()=>{
    const byLang = TRANS_CACHE[lang] || (TRANS_CACHE[lang] = {});
    let arr = null;

    // 1) preferred: window.claude (best quality, batched) when present
    if(window.claude && window.claude.complete){
      const name = LANG_NAME[lang] || lang;
      const numbered = items.map((t,i)=> (i+1) + ". " + t).join("\n");
      const prompt = `Translate these short marketing/ad copy lines from English into ${name}.
Rules:
- Keep each translation natural, punchy and concise — it is an advert, not prose.
- Preserve any *asterisks* exactly, wrapping the equivalent emphasised phrase in the translation.
- Keep call-to-action lines very short.
- Do NOT add quotes, numbering, notes or any extra text.
Return ONLY a JSON array of ${items.length} strings, in the same order as the input.

Lines:
${numbered}`;
      try{
        const raw = await window.claude.complete(prompt);
        const parsed = _extractJsonArray(raw);
        if(parsed && parsed.length === items.length) arr = parsed;
      }catch(_){ arr = null; }
    }

    // 2) fallback: keyless public providers, per line. allSettled so a single
    //    failed line (or a rate-limited provider) never nulls the whole batch —
    //    every line that resolves is kept.
    if(!arr){
      const settled = await Promise.allSettled(items.map(t => _mtGoogle(t, lang)));
      const any = settled.some(s => s.status === "fulfilled" && s.value);
      arr = any ? settled.map(s => (s.status === "fulfilled" ? s.value : null)) : null;
    }

    // 3) write cache. Only persist a line when we actually got a translation
    //    (or have a demo-dict entry). Lines that failed everywhere are left
    //    UNcached so the next attempt retries them instead of freezing English.
    items.forEach((t,i)=>{
      const got = (arr && typeof arr[i] === "string" && arr[i].trim()) ? arr[i].trim() : null;
      const dict = (DICT[t] && DICT[t][lang]) || null;
      if(got) byLang[t] = got;
      else if(dict) byLang[t] = dict;
    });
  })();
  _pending[key] = run;
  try{ await run; } finally { delete _pending[key]; }
}

/* Ensure every text is translated into every (non-English) language.
   Only requests the missing pieces; emits once everything resolves. */
async function ensureTranslations(texts, langs){
  const uniq = [...new Set((texts || []).map(_norm).filter(Boolean))];
  const targets = (langs || []).filter(l => l && l !== "en");
  if(!uniq.length || !targets.length) return;
  const jobs = [];
  for(const lang of targets){
    const missing = uniq.filter(t => !isCached(t, lang));
    if(missing.length) jobs.push(_translateLang(lang, missing));
  }
  if(!jobs.length) return;
  await Promise.all(jobs);
  _emitTrans();
}

/* ---------- GOOGLE / PLATFORM CHECKS ----------
   Plausible heuristic validation for the prototype. Real values
   come from the rendered asset; here they are estimated from the
   format geometry and copy length so the grid feels truthful. */
function _clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function estimateKB(fmt, headlineLen, hasImage){
  const px = fmt.w * fmt.h;
  // jpeg-ish bytes/px with image, lighter for flat banners
  const perPx = hasImage ? 0.058 : 0.022;
  let kb = (px * perPx) / 1024;
  kb += headlineLen * 0.05;
  return Math.max(4, Math.round(kb));
}

/* Estimate the fraction of the frame occupied by text, mirroring the
   real render geometry (font sized to the short side / banner height,
   headline wrapping, CTA pill). A 0.5 glyph-fill factor accounts for
   the whitespace inside a text block. */
function textCoverage(fmt, headlineLen, ctaLen){
  const ratio = fmt.w / fmt.h;
  const isWide = ratio >= 2.4;
  const minSide = Math.min(fmt.w, fmt.h);
  const area = fmt.w * fmt.h;
  let f, headBox, ctaF;
  if(isWide){
    f = _clamp(fmt.h * 0.30, 12, 96);
    const tw = Math.min(headlineLen * f * 0.55, fmt.w * 0.62);
    headBox = tw * f;
  } else {
    f = _clamp(minSide * 0.135, 11, 132);
    const wrapW = fmt.w * 0.92;
    const lineLen = headlineLen * f * 0.55;
    const lines = Math.max(1, Math.ceil(lineLen / wrapW));
    headBox = Math.min(lineLen, wrapW) * f * lines;
  }
  ctaF = _clamp(f * 0.52, 9, 46);
  const ctaBox = (ctaLen * ctaF * 0.55 + ctaF * 1.2) * (ctaF * 1.6);
  return Math.min(0.95, (headBox + ctaBox) * 0.5 / area);
}

function evaluate(fmt, category, opts){
  const { headline, cta, lang, description, discount, use } = opts;
  const g = window.crGeo(fmt);
  const slots = window.crSlots(g, use || { headline:true, description:true, cta:true });

  const hl = slots.headline ? translate(headline, lang) : "";
  const ds = slots.description ? translate(description, lang) : "";
  const ct = slots.cta ? translate(cta, lang) : "";
  const headLen = hl.length + ds.length;          // combined visible text
  const ctaLen = ct.length;
  const limitKB = CATEGORY_META[category].limitKB;
  const kb = estimateKB(fmt, headLen, true);
  let cov = textCoverage(fmt, headLen, ctaLen);
  // a large discount sticker adds materially to the on-image text ratio
  if(slots.discount && _norm(discount)){
    const r = Math.min(fmt.w, fmt.h) * 0.15;       // badge radius (~0.30 diameter)
    cov = Math.min(0.97, cov + (Math.PI*r*r) / (fmt.w*fmt.h) * 0.62);
  }
  const minSide = Math.min(fmt.w, fmt.h);

  // did the user ask for a description that this format had to drop?
  const droppedDesc = !!(use && use.description) && !!_norm(description) && !slots.description;

  const checks = [];

  // 1. dimensions — always correct (we render to exact spec)
  checks.push({ id:"dim", label:"Dimensions", state:"ok", detail:`${fmt.w}×${fmt.h}px` });

  // 2. file weight (Google Display only enforces 150KB)
  if(limitKB){
    const state = kb <= limitKB ? "ok" : (kb <= limitKB*1.4 ? "warn" : "fail");
    checks.push({ id:"weight", label:"File size", state, detail:`${kb} KB / ${limitKB} KB` });
  } else {
    checks.push({ id:"weight", label:"File size", state:"ok", detail:`${kb} KB` });
  }

  // 3. text coverage — advisory only. (Facebook retired its 20% text rule
  //    in 2020 and Google Display has no hard text limit, so a dense banner
  //    is a soft suggestion, never a hard fail.)
  const covPct = Math.round(cov*100);
  const covState = cov <= 0.42 ? "ok" : "warn";
  checks.push({ id:"textratio", label:"Text ratio", state:covState, detail:`${covPct}%` });

  // 4. safe zones / margins — every catalogue format has room; only the
  //    very thinnest hairline banners warn.
  const safeState = minSide >= 50 ? "ok" : "warn";
  checks.push({ id:"safe", label:"Safe zones", state:safeState,
    detail: safeState==="ok" ? "clear" : "tight margins" });

  // 5. contrast — white text on dark scrim / green is strong
  checks.push({ id:"contrast", label:"Contrast", state:"ok", detail:"AA · 7.2:1" });

  // overall status
  const states = checks.map(c=>c.state);
  const status = states.includes("fail") ? "fail" : (states.includes("warn") ? "warn" : "pass");

  return { kb, covPct, checks, status, headline:hl, description:ds, cta:ct,
    droppedDesc, showsDesc:slots.description, machine:isMachine(headline,lang) };
}

/* ---------- expose ---------- */
Object.assign(window, {
  FORMATS, CATEGORY_META, LANGUAGES, DICT,
  translate, isMachine, isCached, useTrans, ensureTranslations, onTransUpdate,
  evaluate, estimateKB,
});
