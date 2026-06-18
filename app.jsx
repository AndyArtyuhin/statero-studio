/* ============================================================
   STATERO CREATIVE STUDIO — App orchestration + mount
   Flow: gate → builder → processing → results
   ============================================================ */

const PROC_STEPS = [
  "Analysing the source image…",
  "Translating copy into selected languages…",
  "Applying the template to each format…",
  "Resizing for social media…",
  "Resizing for Google Display…",
  "Rendering video formats…",
  "Checking against Google's requirements…",
  "Packing the set…",
];

const DEFAULT_CONFIG = {
  image: { url:"assets/t04-photo.jpg", name:"statero-lifestyle.jpg", w:1200, h:962, sizeKB:397 },
  template: 0,
  headline: "Buy gift cards worldwide. *For everyone.*",
  description: "1,000+ brands, instant delivery, redeemable anywhere.",
  cta: "Get started",
  discount: "‒50%",
  bg: "#08C55D",
  use: { headline:true, description:true, cta:true, discount:false },
  srcLang: "en",
  langs: ["en"],
  formats: {
    social: ["ig_square","story","fb_link"],
    google: ["med_rect","leaderbrd","skyscraper","half_page"],
    video: [],
  },
};

function Processing({ config, total, onDone }){
  const [pct, setPct] = React.useState(0);
  const [stepIdx, setStepIdx] = React.useState(0);
  React.useEffect(()=>{
    const DURATION = 2600;
    const t0 = Date.now();

    // kick off the real translation work
    const texts = [];
    if(config.use.headline && config.headline.trim()) texts.push(config.headline);
    if(config.use.description && config.description.trim()) texts.push(config.description);
    if(config.use.cta && config.cta.trim()) texts.push(config.cta);
    if(config.use.discount && (config.discount||"").trim()) texts.push(config.discount);
    let transDone = false, animDone = false, finished = false;
    const maybeFinish = ()=>{
      if(transDone && animDone && !finished){ finished = true; clearInterval(iv); setTimeout(onDone, 360); }
    };
    window.ensureTranslations(texts, config.langs)
      .catch(()=>{})
      .finally(()=>{ transDone = true; maybeFinish(); });

    const iv = setInterval(()=>{
      const raw = Math.min(100, ((Date.now()-t0)/DURATION)*100);
      // hold just shy of 100% until translation actually resolves
      const p = transDone ? raw : Math.min(raw, 94);
      setPct(p);
      setStepIdx(Math.min(PROC_STEPS.length-1, Math.floor((transDone?raw:p)/100*PROC_STEPS.length)));
      if(raw >= 100){ animDone = true; maybeFinish(); }
    }, 120);
    return ()=>clearInterval(iv);
  }, []);
  return (
    <div className="processing">
      <div className="processing__card">
        <div className="processing__spin"></div>
        <h3 className="processing__title">Generating {total} creatives</h3>
        <p className="processing__step">{PROC_STEPS[stepIdx]}</p>
        <div className="processing__bar"><div className="processing__fill" style={{width:pct+"%"}}></div></div>
        <p className="processing__pct">{Math.round(pct)}%</p>
      </div>
    </div>
  );
}

function App(){
  const [unlocked, setUnlocked] = React.useState(()=>{ try{ return sessionStorage.getItem("statero_studio_unlocked")==="1"; }catch(_){ return false; } });
  const [view, setView] = React.useState("builder"); // builder | processing | results
  const [config, setConfig] = React.useState(DEFAULT_CONFIG);
  const [toastMsg, setToastMsg] = React.useState("");
  const toastTimer = React.useRef(null);

  function set(patch){ setConfig(c => ({ ...c, ...(typeof patch === "function" ? patch(c) : patch) })); }
  function toast(msg){
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(()=>setToastMsg(""), 4200);
  }

  const total = (config.formats.social.length+config.formats.google.length+config.formats.video.length) * config.langs.length;

  if(!unlocked) return <window.Gate onUnlock={()=>setUnlocked(true)} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand"><img src="assets/logo-black.png" alt="Statero" /></div>
        <div className="topbar__divider"></div>
        <span className="topbar__name">Creative Studio</span>
        <span className="topbar__chip">Beta</span>
        <div className="topbar__spacer"></div>
        <span className="topbar__meta">{view==="results" ? "Results" : "Campaign builder"}</span>
      </header>

      {view==="builder" &&
        <window.Builder config={config} set={set} onMake={()=>setView("processing")} />}

      {view==="results" &&
        <window.Results config={config} onBack={()=>setView("builder")} toast={toast} />}

      {view==="processing" &&
        <Processing config={config} total={total} onDone={()=>setView("results")} />}

      <div className={"toast" + (toastMsg ? " is-on":"")}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        {toastMsg}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
