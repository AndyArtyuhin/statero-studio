/* ============================================================
   STATERO CREATIVE STUDIO — Creative renderer + Builder panel
   ============================================================ */

/* ---------- helper: clamp (Creative + templates live in templates.jsx) ---------- */
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

/* ============================================================
   ICONS
   ============================================================ */
const Ico = {
  upload:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>,
  social:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></svg>,
  google:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg>,
  video:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 9 6-3v12l-6-3"/></svg>,
  info:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>,
  spark:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>,
  image:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>,
};
const CAT_ICON = { social: Ico.social, google: Ico.google, video: Ico.video };
window.Ico = Ico; window.CAT_ICON = CAT_ICON; window.clamp = clamp;

/* ============================================================
   FIELD BLOCK — a copy field the user can switch on/off
   ============================================================ */
function FieldBlock({ on, onToggle, title, children }){
  return (
    <div className={"fieldblock" + (on ? " is-on" : " is-off")}>
      <div className="fieldblock__head">
        <span className="fieldblock__title">{title}</span>
        <button type="button" className={"switch" + (on ? " is-on" : "")}
          onClick={onToggle} role="switch" aria-checked={on} aria-label={"Use " + title}>
          <span className="switch__knob"></span>
        </button>
      </div>
      {on
        ? <div className="fieldblock__body">{children}</div>
        : <p className="fieldblock__off">Not used — toggle on to include the {title.toLowerCase()}.</p>}
    </div>
  );
}
window.FieldBlock = FieldBlock;

/* ============================================================
   BUILDER
   ============================================================ */
function Builder({ config, set, onMake }){
  window.useTrans(); // re-render when translations land
  const [over, setOver] = React.useState(false);
  const [pvFmtId, setPvFmtId] = React.useState(null);
  const [pvLang, setPvLang] = React.useState("en");
  const [pvBusy, setPvBusy] = React.useState(false);
  const fileRef = React.useRef(null);

  const use = config.use || { headline:true, description:true, cta:true };
  function toggleUse(field){
    set(c => {
      const u = c.use || { headline:true, description:true, cta:true };
      const next = { ...u, [field]: !u[field] };
      if(!next.headline && !next.description) next.headline = true; // never leave zero text fields
      return { use: next };
    });
  }

  /* ---- upload ---- */
  function handleFile(file){
    if(!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => set({ image: { url, name:file.name, sizeKB: Math.round(file.size/1024), w:img.naturalWidth, h:img.naturalHeight } });
    img.src = url;
  }
  function onDrop(e){ e.preventDefault(); setOver(false); handleFile(e.dataTransfer.files[0]); }

  /* ---- format toggles (functional updates — safe under rapid clicks) ---- */
  function toggleFmt(cat, id){
    set(c => {
      const cur = c.formats[cat];
      const next = cur.includes(id) ? cur.filter(x=>x!==id) : [...cur, id];
      return { formats: { ...c.formats, [cat]: next } };
    });
  }
  function toggleAll(cat){
    const all = window.FORMATS[cat].map(f=>f.id);
    set(c => ({ formats: { ...c.formats, [cat]: c.formats[cat].length === all.length ? [] : all } }));
  }
  function toggleLang(id){
    set(c => {
      const next = c.langs.includes(id) ? c.langs.filter(x=>x!==id) : [...c.langs, id];
      return { langs: next.length ? next : c.langs };
    });
  }

  /* ---- derived ---- */
  const totalFmts = config.formats.social.length + config.formats.google.length + config.formats.video.length;
  const totalCreatives = totalFmts * config.langs.length;
  const hasText = (use.headline && config.headline.trim()) || (use.description && config.description.trim());
  const ready = config.image && config.template !== null && hasText && totalCreatives > 0;

  const allSelectedFmts = ["social","google","video"].flatMap(c => config.formats[c].map(id => ({...window.FORMATS[c].find(f=>f.id===id), cat:c})));
  const pvFmt = allSelectedFmts.find(f=>f.id===pvFmtId) || allSelectedFmts[0] || window.FORMATS.social[0];
  const pvLangOk = config.langs.includes(pvLang) ? pvLang : config.langs[0];
  const pvRtl = (window.LANGUAGES.find(l=>l.id===pvLangOk)||{}).rtl;

  /* ---- translate the previewed language on demand (debounced) ---- */
  React.useEffect(()=>{
    if(!pvLangOk || pvLangOk === "en"){ setPvBusy(false); return; }
    const texts = [];
    if(use.headline && config.headline.trim()) texts.push(config.headline);
    if(use.description && config.description.trim()) texts.push(config.description);
    if(use.cta && config.cta.trim()) texts.push(config.cta);
    if(use.discount && (config.discount||"").trim()) texts.push(config.discount);
    if(!texts.length || texts.every(t=>window.isCached(t, pvLangOk))){ setPvBusy(false); return; }
    setPvBusy(true);
    const id = setTimeout(()=>{
      window.ensureTranslations(texts, [pvLangOk]).catch(()=>{}).finally(()=>setPvBusy(false));
    }, 550);
    return ()=>clearTimeout(id);
  }, [config.headline, config.description, config.cta, config.discount, pvLangOk, use.headline, use.description, use.cta, use.discount]);

  return (
    <div className="builder">
      {/* ---------------- MAIN COLUMN ---------------- */}
      <div className="builder__main">
        <div className="builder__intro">
          <h1>Build a full campaign from one source image</h1>
          <p>Upload an image, add your copy and pick the formats — Studio resizes the creatives for every placement in five languages and checks them against Google's requirements.</p>
        </div>

        {/* STEP 1 — UPLOAD */}
        <section className={"step" + (config.image ? " is-done":"")}>
          <div className="step__head">
            <span className="step__num">1</span>
            <div className="step__titles"><h2 className="step__title">Image</h2><p className="step__sub">The source every format is cut from</p></div>
            {config.image && <span className="step__badge">Ready</span>}
          </div>
          {!config.image ? (
            <div className={"dropzone" + (over ? " is-over":"")}
                 onDragOver={(e)=>{e.preventDefault();setOver(true);}}
                 onDragLeave={()=>setOver(false)} onDrop={onDrop}
                 onClick={()=>fileRef.current.click()} style={{cursor:"pointer"}}>
              <div className="dropzone__icon">{Ico.upload}</div>
              <p className="dropzone__title">Drag an image here</p>
              <p className="dropzone__sub">or <span className="dropzone__browse">choose a file</span> · PNG, JPG, up to 20 MB · ≥1600px recommended</p>
            </div>
          ) : (
            <div className="uploaded">
              <img className="uploaded__thumb" src={config.image.url} alt="" />
              <div className="uploaded__info">
                <div className="uploaded__name">{config.image.name}</div>
                <div className="uploaded__meta">{config.image.w}×{config.image.h}px · {config.image.sizeKB} KB</div>
                <div className="uploaded__actions">
                  <button className="btn btn-ghost" style={{padding:"8px 16px",fontSize:13}} onClick={()=>fileRef.current.click()}>Replace</button>
                  <button className="btn btn-ghost" style={{padding:"8px 16px",fontSize:13}} onClick={()=>set({image:null})}>Remove</button>
                </div>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e)=>handleFile(e.target.files[0])} />
        </section>

        {/* STEP 2 — TEMPLATE */}
        <section className={"step" + (config.template!==null ? " is-done":"")}>
          <div className="step__head">
            <span className="step__num">2</span>
            <div className="step__titles"><h2 className="step__title">Template</h2><p className="step__sub">Solid Split is ready to use — more layouts coming soon</p></div>
          </div>
          <div className="tpl-grid">
            {window.TEMPLATES.map(tpl => {
              const soon = tpl.id !== 0;
              return (
              <button key={tpl.id} type="button"
                className={"tpl" + (config.template===tpl.id ? " is-active":"") + (soon ? " is-soon":"")}
                onClick={()=>{ if(!soon) set({template:tpl.id}); }}
                disabled={soon} aria-disabled={soon}
                title={soon ? tpl.name + " — coming soon" : tpl.name}>
                <div className="tpl__preview">
                  <window.Creative fmt={{w:1080,h:1080}} maxW={120} maxH={120}
                    opts={{ template:tpl.id, img: config.image && config.image.url,
                      headline: config.headline || "Buy gift cards worldwide. *For everyone.*",
                      description: config.description, cta: config.cta || "Get started",
                      discount: config.discount, bg: config.bg, use, lang:"en", rtl:false }} />
                  {config.template===tpl.id && !soon && <span className="tpl__check">✓</span>}
                  {soon && <span className="tpl__soon">Soon</span>}
                </div>
                <div className="tpl__label">
                  <span className="tpl__name">{tpl.name}</span>
                  <span className="tpl__tag">{tpl.tag}</span>
                </div>
              </button>
            );})}
          </div>
          {config.template!==null &&
            <p className="tpl-note">{Ico.info}<span><b>{window.TEMPLATES[config.template].name}.</b> {window.TEMPLATES[config.template].blurb} Every selected format re-flows this structure automatically.</span></p>}

          <div className="bgpick">
            <div className="bgpick__head">
              <span className="bgpick__label">Background colour</span>
              <span className="bgpick__hint">{config.template===0 ? "Sets the solid field on Solid Split — vary it per campaign for distinct banners." : "Used by the Solid Split layout."}</span>
            </div>
            <div className="bgpick__row">
              {window.BG_OPTIONS.map(o => (
                <button key={o.id} type="button" title={o.name}
                  className={"swatch" + (config.bg===o.color ? " is-on":"")}
                  style={{ background:o.color }} onClick={()=>set({bg:o.color})}
                  aria-label={o.name} aria-pressed={config.bg===o.color}>
                  {config.bg===o.color && <span className="swatch__tick" style={{color: window.crTheme(o.color).text}}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* STEP 3 — TEXT & LANGUAGE */}
        <section className={"step" + (hasText ? " is-done":"")}>
          <div className="step__head">
            <span className="step__num">3</span>
            <div className="step__titles"><h2 className="step__title">Copy &amp; languages</h2></div>
            <span className="step__badge">{["headline","description","cta","discount"].filter(k=>use[k]).length} fields</span>
          </div>

          <FieldBlock on={use.headline} onToggle={()=>toggleUse("headline")} title="Header">
            <textarea className="textarea" maxLength={80} value={config.headline}
              onChange={(e)=>set({headline:e.target.value})} placeholder="Buy gift cards worldwide. *For everyone.*" />
            <p className="field__hint">≤14 words reads on every format. Wrap a phrase in <code>*asterisks*</code> for the brand-yellow accent. <span className="field__count" style={{float:"right"}}>{config.headline.length}/80</span></p>
          </FieldBlock>

          <FieldBlock on={use.description} onToggle={()=>toggleUse("description")} title="Description">
            <textarea className="textarea" maxLength={120} value={config.description}
              onChange={(e)=>set({description:e.target.value})} placeholder="1,000+ brands, instant delivery, redeemable anywhere." />
            <p className="field__hint">Auto-hidden on small banners (320×50, 728×90, skyscrapers) that only fit a header. <span className="field__count" style={{float:"right"}}>{config.description.length}/120</span></p>
          </FieldBlock>

          <FieldBlock on={use.cta} onToggle={()=>toggleUse("cta")} title="Button (CTA)">
            <input className="input" maxLength={24} value={config.cta}
              onChange={(e)=>set({cta:e.target.value})} placeholder="Get started" />
            <p className="field__hint" style={{textAlign:"right"}}><span className="field__count">{config.cta.length}/24</span></p>
          </FieldBlock>

          <FieldBlock on={use.discount} onToggle={()=>toggleUse("discount")} title="Discount badge">
            <input className="input" maxLength={14} value={config.discount}
              onChange={(e)=>set({discount:e.target.value})} placeholder="‒50%" />
            <p className="field__hint">Keep it short (a percentage or a couple of words). Auto-hidden on thin banners. <span className="field__count" style={{float:"right"}}>{(config.discount||"").length}/14</span></p>
          </FieldBlock>

          <div className="field" style={{marginTop:24}}>
            <label>Source text language</label>
            <div className="select-wrap">
              <select className="select" value={config.srcLang} onChange={(e)=>set({srcLang:e.target.value})}>
                {window.LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Translate &amp; resize into <span className="field__count">{config.langs.length} selected</span></label>
            <div className="lang-grid">
              {window.LANGUAGES.map(l => (
                <button key={l.id} className={"lang-pill" + (config.langs.includes(l.id) ? " is-on":"")} onClick={()=>toggleLang(l.id)}>
                  <span className="lang-pill__flag">{l.flag}</span>{l.label}
                  {l.rtl && <span className="lang-pill__rtl">RTL</span>}
                </button>
              ))}
            </div>
            <p className="field__hint">Each language gets its own set of creatives. Copy is translated automatically for every language you pick.</p>
          </div>
        </section>

        {/* STEP 4 — FORMATS */}
        <section className={"step" + (totalFmts ? " is-done":"")}>
          <div className="step__head">
            <span className="step__num">4</span>
            <div className="step__titles"><h2 className="step__title">Formats</h2></div>
            {totalFmts>0 && <span className="step__badge">{totalFmts} formats</span>}
          </div>
          {["social","google","video"].map(cat => {
            const meta = window.CATEGORY_META[cat];
            const list = window.FORMATS[cat];
            const sel = config.formats[cat];
            return (
              <div className="fmt-cat" key={cat}>
                <div className="fmt-cat__head">
                  <span className="fmt-cat__icon" style={{background:meta.color}}>{CAT_ICON[cat]}</span>
                  <span className="fmt-cat__title">{meta.label}{meta.limitKB && <span style={{fontWeight:400,color:"var(--ink-3)",fontSize:13}}> · ≤{meta.limitKB} KB</span>}</span>
                  <button className="fmt-cat__all" onClick={()=>toggleAll(cat)}>{sel.length===list.length ? "Clear all":"Select all"}</button>
                </div>
                <div className="fmt-list">
                  {list.map(f => (
                    <button key={f.id} className={"fmt" + (sel.includes(f.id) ? " is-on":"")} onClick={()=>toggleFmt(cat,f.id)}>
                      <span className="fmt__check"></span>
                      <span className="fmt__body">
                        <span className="fmt__name">{f.name}</span>
                        <span className="fmt__dim">{f.w}×{f.h}{f.note ? " · "+f.note : ""}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>

      {/* ---------------- ASIDE ---------------- */}
      <aside className="builder__aside">
        <div className="aside__scroll">
          <p className="aside__label">Live preview {pvBusy && <span className="trans-busy"><span className="trans-busy__dot"></span>translating…</span>}</p>
          <div className="preview-stage">
            {totalFmts>0 ? (
              <Creative fmt={pvFmt} maxW={356} maxH={300}
                opts={{ template: config.template, cat: pvFmt.cat, img: config.image && config.image.url, headline: config.headline || "Buy gift cards worldwide. *For everyone.*", description: config.description, cta: config.cta || "Get started", discount: config.discount, bg: config.bg, use, lang: pvLangOk, rtl: pvRtl }} />
            ) : (
              <div className="preview-empty">{Ico.image}<p>Select at least one format to see a preview</p></div>
            )}
          </div>
          {totalFmts>0 &&
            <div className="preview-tabs">
              {allSelectedFmts.map(f => (
                <button key={f.id} className={"preview-tab" + ((pvFmt.id===f.id) ? " is-on":"")} onClick={()=>setPvFmtId(f.id)}>{f.w}×{f.h}</button>
              ))}
            </div>}
          {totalFmts>0 && config.langs.length>1 &&
            <div className="preview-tabs">
              {config.langs.map(id => {
                const l = window.LANGUAGES.find(x=>x.id===id);
                return <button key={id} className={"preview-tab" + ((pvLangOk===id) ? " is-on":"")} onClick={()=>setPvLang(id)}>{l.flag} {l.id.toUpperCase()}</button>;
              })}
            </div>}

          {/* SUMMARY */}
          <div className="summary">
            <p className="aside__label" style={{marginBottom:6}}>To generate</p>
            {["social","google","video"].map(cat => config.formats[cat].length>0 && (
              <div className="summary__row" key={cat}>
                <span className="k">{window.CATEGORY_META[cat].label}</span>
                <span className="v">{config.formats[cat].length} × {config.langs.length} = {config.formats[cat].length*config.langs.length}</span>
              </div>
            ))}
            <div className="summary__total">
              <span className="k">Total creatives</span>
              <span className="v">{totalCreatives}</span>
            </div>
            <p className="summary__break">{totalFmts} formats × {config.langs.length} {config.langs.length===1?"language":"languages"}</p>
          </div>
        </div>

        <div className="aside__foot">
          <button className="btn btn-primary btn-block btn-lg" disabled={!ready} onClick={onMake}>
            {Ico.spark} Make · generate {totalCreatives || ""}
          </button>
          <p className="make-note">
            {!ready
              ? "Add an image, template, copy and at least one format"
              : "We'll check against Google's requirements and pack a ZIP"}
          </p>
        </div>
      </aside>
    </div>
  );
}

window.Builder = Builder;
