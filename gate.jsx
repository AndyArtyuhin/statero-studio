/* ============================================================
   STATERO CREATIVE STUDIO — password gate
   Lightweight client-side gate. The REAL protection is Vercel's
   built-in password protection on the deployment; this screen is
   the branded entry experience.
   ============================================================ */

const ACCESS_CODE = "statero"; // change before deploy · also enable Vercel password

function Gate({ onUnlock }){
  const [val, setVal] = React.useState("");
  const [err, setErr] = React.useState("");
  const ref = React.useRef(null);

  React.useEffect(()=>{ ref.current && ref.current.focus(); }, []);

  function submit(e){
    e.preventDefault();
    if(val.trim().toLowerCase() === ACCESS_CODE){
      try{ sessionStorage.setItem("statero_studio_unlocked","1"); }catch(_){}
      onUnlock();
    } else {
      setErr("Incorrect access code. Please try again.");;
      setVal("");
      ref.current && ref.current.focus();
    }
  }

  return (
    <div className="gate">
      <div className="gate__pattern">
        <img src="assets/symbol-white.png" alt="" />
        <img src="assets/symbol-white.png" alt="" />
      </div>
      <div className="gate__card">
        <img className="gate__logo" src="assets/logo-black.png" alt="Statero" />
        <p className="gate__eyebrow">Creative Studio</p>
        <h1 className="gate__title">Private access</h1>
        <p className="gate__sub">Enter the access code to open the creative generator.</p>
        <form className="gate__form" onSubmit={submit}>
          <input
            ref={ref}
            className="input"
            type="password"
            placeholder="Access code"
            value={val}
            onChange={(e)=>{ setVal(e.target.value); setErr(""); }}
            autoComplete="off"
          />
          <p className="gate__err">{err}</p>
          <button type="submit" className="btn btn-primary btn-block btn-lg" style={{borderRadius:100}}>Enter</button>
        </form>
      </div>
    </div>
  );
}

window.Gate = Gate;
window.ACCESS_CODE = ACCESS_CODE;
