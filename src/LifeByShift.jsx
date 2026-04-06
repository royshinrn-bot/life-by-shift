import { useState, useRef, useEffect } from "react";
import * as Tone from "tone";

// ── Sound engine ──────────────────────────────────────────────────────────
// AudioContext is created once and kept alive. Drag-and-drop loses the
// user-gesture context between dragstart and drop, so we resume() explicitly
// every time rather than relying on Tone.start() which only runs once.

let _audioReady = false;

async function ensureAudio() {
  // Resume the context if it was suspended (common after drag-and-drop)
  if (Tone.context.state !== "running") {
    await Tone.context.resume();
  }
  if (!_audioReady) {
    await Tone.start();
    _audioReady = true;
  }
}

function playCoinSound() {
  ensureAudio().then(() => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.0, release: 0.1 },
      volume: -6,
    }).toDestination();

    const now = Tone.now();
    synth.triggerAttackRelease("E6", "16n", now);
    synth.triggerAttackRelease("G6", "16n", now + 0.04);
    synth.triggerAttackRelease("B6", "16n", now + 0.08);
    synth.triggerAttackRelease("E7", "8n",  now + 0.13);

    const reverb = new Tone.Reverb({ decay: 0.4, wet: 0.3 }).toDestination();
    const shimmer = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
      volume: -14,
    }).connect(reverb);
    shimmer.triggerAttackRelease("C7", "16n", now + 0.15);

    setTimeout(() => { synth.dispose(); shimmer.dispose(); reverb.dispose(); }, 1500);
  });
}

function playVanishSound() {
  ensureAudio().then(() => {
    const noise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.2 },
      volume: -18,
    }).toDestination();

    const synth = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.2 },
      volume: -10,
    }).toDestination();

    const filter = new Tone.AutoFilter({ frequency: 4, depth: 0.8, wet: 0.6 }).toDestination().start();
    const vanishSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.3 },
      volume: -8,
    }).connect(filter);

    const now = Tone.now();
    noise.triggerAttackRelease("8n", now);
    vanishSynth.triggerAttack("A4", now);
    vanishSynth.frequency.exponentialRampToValueAtTime(80, now + 0.5);
    vanishSynth.triggerRelease(now + 0.45);
    synth.triggerAttackRelease("G3", "4n", now + 0.05);

    setTimeout(() => { noise.dispose(); synth.dispose(); vanishSynth.dispose(); filter.dispose(); }, 1500);
  });
}

// ── Icons (SVG inline) ────────────────────────────────────────────────────
const Icons = {
  sun: "☀️", moon: "🌙", bolt: "⚡", bed: "🛏️", star: "⭐",
  coffee: "☕", heart: "❤️", home: "🏠", money: "💵", clock: "🕐",
  medical: "🏥", school: "🎓",
};

// ── Default shift types ───────────────────────────────────────────────────
const defaultShiftTypes = () => [
  { id: 1, name: "Day",   icon: "sun",  color: "#FF8F00", hours: 8,  showOnCalendar: true,  isOvertimeRate: false },
  { id: 2, name: "Night", icon: "moon", color: "#3949AB", hours: 8,  showOnCalendar: true,  isOvertimeRate: false },
  { id: 3, name: "OT",    icon: "bolt", color: "#2E7D32", hours: 4,  showOnCalendar: true,  isOvertimeRate: true  },
  { id: 4, name: "Off",   icon: "bed",  color: "#757575", hours: 0,  showOnCalendar: false, isOvertimeRate: false },
];

const MONTH_NAMES = ["","January","February","March","April","May","June",
  "July","August","September","October","November","December"];

const PAY_PERIOD_COLORS = [
  { name: "Sky Blue", value: "#BBDEFB" }, { name: "Mint",     value: "#C8E6C9" },
  { name: "Lavender", value: "#E1BEE7" }, { name: "Peach",    value: "#FFCCBC" },
  { name: "Lemon",    value: "#FFF9C4" }, { name: "Rose",     value: "#F8BBD0" },
];

const SHIFT_COLORS = [
  { name: "Amber",     value: "#FF8F00" }, { name: "Deep Blue", value: "#3949AB" },
  { name: "Green",     value: "#2E7D32" }, { name: "Grey",      value: "#757575" },
  { name: "Red",       value: "#C62828" }, { name: "Teal",      value: "#00695C" },
  { name: "Purple",    value: "#6A1B9A" }, { name: "Pink",      value: "#AD1457" },
  { name: "Cyan",      value: "#00838F" }, { name: "Brown",     value: "#4E342E" },
];

const ICON_OPTIONS = [
  { name: "Sun", key: "sun" }, { name: "Moon", key: "moon" },
  { name: "Bolt", key: "bolt" }, { name: "Bed", key: "bed" },
  { name: "Star", key: "star" }, { name: "Coffee", key: "coffee" },
  { name: "Heart", key: "heart" }, { name: "Home", key: "home" },
  { name: "Money", key: "money" }, { name: "Clock", key: "clock" },
  { name: "Medical", key: "medical" }, { name: "School", key: "school" },
];

function key(d) { return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function isToday(d) {
  const n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}

function calendarWeeks(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last  = new Date(month.getFullYear(), month.getMonth()+1, 0);
  const startOffset = first.getDay();
  const endOffset   = (7 - last.getDay() - 1) % 7;
  const start = new Date(first); start.setDate(start.getDate() - startOffset);
  const total = startOffset + last.getDate() + endOffset;
  const weeks = [];
  for (let w = 0; w < total / 7; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dd = new Date(start); dd.setDate(dd.getDate() + w*7+d);
      week.push(new Date(dd));
    }
    weeks.push(week);
  }
  return weeks;
}

function payBand(date, payPeriodStart) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const a = new Date(payPeriodStart.getFullYear(), payPeriodStart.getMonth(), payPeriodStart.getDate());
  const diff = Math.round((d - a) / 86400000);
  // Math.floor handles negatives correctly: -1/14 → -1, not 0
  // ((n % 2) + 2) % 2 ensures result is always 0 or 1 even for negative periods
  const period = Math.floor(diff / 14);
  return ((period % 2) + 2) % 2;
}

function isPayDay(date, settings) {
  if (!settings.showPayDay) return false;
  if (settings.payDayFrequency === "monthly") return date.getDate() === settings.payDayOfMonth;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const a = new Date(settings.payDayAnchor.getFullYear(), settings.payDayAnchor.getMonth(), settings.payDayAnchor.getDate());
  const diff = Math.round((d - a) / 86400000);
  return diff % 14 === 0;
}

// ── Hex with opacity helper ───────────────────────────────────────────────
function hexOp(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Modal ─────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, actions }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:400, boxShadow:"0 8px 40px rgba(0,0,0,0.18)", maxHeight:"90vh", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"18px 20px 0", fontWeight:700, fontSize:17 }}>{title}</div>
        <div style={{ padding:"12px 20px", overflowY:"auto", flex:1 }}>{children}</div>
        {actions && <div style={{ padding:"8px 16px 16px", display:"flex", gap:8, justifyContent:"flex-end" }}>{actions}</div>}
      </div>
    </div>
  );
}

// ── Shift Edit Dialog ─────────────────────────────────────────────────────
function ShiftEditDialog({ shift, onSave, onClose }) {
  const [name, setName] = useState(shift.name);
  const [icon, setIcon] = useState(shift.icon);
  const [color, setColor] = useState(shift.color);
  const [hours, setHours] = useState(shift.hours);
  const [showOnCalendar, setShowOnCalendar] = useState(shift.showOnCalendar);
  const [isOvertimeRate, setIsOvertimeRate] = useState(shift.isOvertimeRate);

  return (
    <Modal
      title="Edit Shift Type"
      onClose={onClose}
      actions={[
        <button key="c" onClick={onClose} style={btnOutline}>Cancel</button>,
        <button key="s" onClick={() => { onSave({...shift,name:name||shift.name,icon,color,hours,showOnCalendar,isOvertimeRate}); onClose(); }} style={btnFilled}>Save</button>
      ]}
    >
      {/* Preview */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16 }}>
        <div style={{ width:60,height:60,borderRadius:16,background:hexOp(color,0.15),border:`2.5px solid ${color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28 }}>{Icons[icon]}</div>
        <div style={{ marginTop:6, fontWeight:700, color, fontSize:17 }}>{name||"—"}</div>
      </div>
      {/* Name */}
      <label style={labelStyle}>Name</label>
      <input value={name} maxLength={10} onChange={e=>setName(e.target.value)}
        style={{ ...inputStyle, marginBottom:14 }} />
      {/* Icon */}
      <label style={labelStyle}>Icon</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
        {ICON_OPTIONS.map(opt => (
          <button key={opt.key} onClick={()=>setIcon(opt.key)}
            style={{ width:40,height:40,borderRadius:10,border:`2px solid ${icon===opt.key?color:"transparent"}`,background:icon===opt.key?hexOp(color,0.2):"#f0f0f0",fontSize:20,cursor:"pointer",transition:"all 0.12s" }}>
            {Icons[opt.key]}
          </button>
        ))}
      </div>
      {/* Show on Calendar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <span style={{ fontWeight:700, fontSize:15 }}>Show on Calendar</span>
        <Toggle value={showOnCalendar} onChange={setShowOnCalendar} />
      </div>
      {showOnCalendar && <>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <span style={{ fontWeight:700, fontSize:15 }}>Uses OT Rate</span>
          <Toggle value={isOvertimeRate} onChange={setIsOvertimeRate} color="#6A1B9A" />
        </div>
        {/* Hours — now above Color */}
        <label style={labelStyle}>Hours per shift</label>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:16 }}>
          <button onClick={()=>setHours(h=>Math.max(0,h-1))} style={iconBtn}>−</button>
          <span style={{ fontSize:26, fontWeight:700, width:40, textAlign:"center" }}>{hours}</span>
          <button onClick={()=>setHours(h=>Math.min(24,h+1))} style={iconBtn}>+</button>
          <span style={{ color:"#999" }}>h</span>
        </div>
      </>}
      {/* Color — now below Hours */}
      <label style={labelStyle}>Color</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
        {SHIFT_COLORS.map(opt => (
          <button key={opt.value} onClick={()=>setColor(opt.value)}
            style={{ width:36,height:36,borderRadius:"50%",border:`2.5px solid ${color===opt.value?"#333":"transparent"}`,background:opt.value,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14 }}>
            {color===opt.value?"✓":""}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Toggle({ value, onChange, color="#1565C0" }) {
  return (
    <div onClick={()=>onChange(!value)} style={{ width:44,height:26,borderRadius:13,background:value?color:"#ccc",cursor:"pointer",position:"relative",transition:"background 0.2s" }}>
      <div style={{ position:"absolute",top:3,left:value?20:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
    </div>
  );
}

// ── OT Hours Dialog ───────────────────────────────────────────────────────
function OTDialog({ date, shift, onConfirm, onClose }) {
  const [hours, setHours] = useState(shift.hours);
  return (
    <Modal title={<span style={{display:"flex",alignItems:"center",gap:8}}><span>{Icons[shift.icon]}</span> OT Hours</span>} onClose={onClose}
      actions={[
        <button key="c" onClick={onClose} style={btnOutline}>Cancel</button>,
        <button key="ok" onClick={()=>{ playCoinSound(); onConfirm(hours); onClose(); }} style={{...btnFilled,background:shift.color}}>Confirm</button>
      ]}>
      <div style={{ textAlign:"center", color:"#9E9E9E", marginBottom:16 }}>
        {MONTH_NAMES[date.getMonth()+1]} {date.getDate()}, {date.getFullYear()}
      </div>
      <div style={{ fontSize:16, textAlign:"center", marginBottom:12 }}>How many OT hours?</div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:16 }}>
        <button onClick={()=>setHours(h=>Math.max(1,h-1))} style={{...iconBtn,color:shift.color,fontSize:24}}>−</button>
        <div style={{ width:72,padding:"10px 0",borderRadius:12,background:hexOp(shift.color,0.12),border:`2px solid ${shift.color}`,textAlign:"center",fontSize:26,fontWeight:700,color:shift.color }}>{hours}h</div>
        <button onClick={()=>setHours(h=>Math.min(24,h+1))} style={{...iconBtn,color:shift.color,fontSize:24}}>+</button>
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
        {[2,3,4,6,8].map(h=>(
          <button key={h} onClick={()=>setHours(h)}
            style={{ padding:"6px 14px",borderRadius:16,border:`1.5px solid ${shift.color}`,background:hours===h?shift.color:hexOp(shift.color,0.1),color:hours===h?"#fff":shift.color,fontWeight:700,fontSize:15,cursor:"pointer" }}>
            {h}h
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ── Note Editor ───────────────────────────────────────────────────────────
function NoteDialog({ date, note, onSave, onDelete, onClose }) {
  const [text, setText] = useState(note||"");
  return (
    <Modal title={<span style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:"#E65100"}}>📝</span> {MONTH_NAMES[date.getMonth()+1]} {date.getDate()}, {date.getFullYear()}</span>} onClose={onClose}
      actions={[
        note && <button key="d" onClick={()=>{onDelete();onClose();}} style={{...btnOutline,color:"red",borderColor:"red",marginRight:"auto"}}>Delete</button>,
        <button key="c" onClick={onClose} style={btnOutline}>Cancel</button>,
        <button key="s" onClick={()=>{onSave(text.trim());onClose();}} style={btnFilled}>Save</button>
      ].filter(Boolean)}>
      <textarea value={text} onChange={e=>setText(e.target.value)} rows={5} placeholder="Add a note for this day..."
        style={{ width:"100%", border:"1.5px solid #ddd", borderRadius:8, padding:12, fontSize:15, resize:"vertical", fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
    </Modal>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}
      actions={[
        <button key="c" onClick={onClose} style={btnOutline}>Cancel</button>,
        <button key="ok" onClick={()=>{onConfirm();onClose();}} style={{...btnFilled,background:"#ef5350"}}>Remove</button>
      ]}>
      <p style={{ margin:0, fontSize:15 }}>{message}</p>
    </Modal>
  );
}

// ── Settings Sheet ────────────────────────────────────────────────────────
function SettingsSheet({ settings, shiftTypes, onSave, onClose }) {
  const [tab, setTab] = useState(0);
  const [s, setS] = useState({...settings});
  const [shifts, setShifts] = useState(shiftTypes.map(x=>({...x})));
  const [editingShift, setEditingShift] = useState(null);
  const [addingShift, setAddingShift] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [rate, setRate] = useState(settings.hourlyRate > 0 ? settings.hourlyRate.toFixed(2) : "");

  const parsedRate = parseFloat(rate)||0;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:520,maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 -4px 30px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex",justifyContent:"center",padding:"10px 0 4px" }}>
          <div style={{ width:40,height:4,borderRadius:2,background:"#ccc" }} />
        </div>
        <div style={{ textAlign:"center",fontWeight:700,fontSize:20,paddingBottom:4 }}>Settings</div>
        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"2px solid #eee" }}>
          {["📅  Pay Period","💰  Pay Rate","⚙️  Shifts"].map((t,i)=>(
            <button key={i} onClick={()=>setTab(i)}
              style={{ flex:1,padding:"10px 0",border:"none",background:"none",fontWeight:tab===i?700:400,color:tab===i?"#1565C0":"#666",borderBottom:tab===i?"2px solid #1565C0":"2px solid transparent",cursor:"pointer",fontSize:14,marginBottom:-2 }}>
              {t}
            </button>
          ))}
        </div>
        {/* Tab content */}
        <div style={{ overflowY:"auto", flex:1, padding:16 }}>
          {tab===0 && (
            <div>
              <label style={labelStyle}>Pay Period Start Date</label>
              <input type="date" value={fmtDateInput(s.payPeriodStartDate)} onChange={e=>setS({...s,payPeriodStartDate:new Date(e.target.value+"T00:00:00")})}
                style={{...inputStyle,marginBottom:20}} />
              <label style={labelStyle}>Pay Period Highlight Color</label>
              <div style={{ display:"flex",flexWrap:"wrap",gap:10,marginBottom:24 }}>
                {PAY_PERIOD_COLORS.map(c=>(
                  <button key={c.value} onClick={()=>setS({...s,payPeriodColor:c.value})}
                    style={{ width:38,height:38,borderRadius:"50%",background:c.value,border:`2.5px solid ${s.payPeriodColor===c.value?"#333":"transparent"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>
                    {s.payPeriodColor===c.value?"✓":""}
                  </button>
                ))}
              </div>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
                <span style={{ fontWeight:700,fontSize:16 }}>Show PayDay on Calendar</span>
                <Toggle value={s.showPayDay} onChange={v=>setS({...s,showPayDay:v})} />
              </div>
              {s.showPayDay && <>
                <label style={labelStyle}>PayDay Frequency</label>
                <div style={{ display:"flex",gap:10,marginBottom:16 }}>
                  {["biweekly","monthly"].map(f=>(
                    <button key={f} onClick={()=>setS({...s,payDayFrequency:f})}
                      style={{ padding:"8px 16px",borderRadius:20,border:`1px solid ${s.payDayFrequency===f?"#1565C0":"#ccc"}`,background:s.payDayFrequency===f?"#1565C0":"#f5f5f5",color:s.payDayFrequency===f?"#fff":"#333",fontWeight:s.payDayFrequency===f?700:400,cursor:"pointer",fontSize:15 }}>
                      {f==="biweekly"?"Every 2 Weeks":"Monthly"}
                    </button>
                  ))}
                </div>
                {s.payDayFrequency==="biweekly" && <>
                  <label style={labelStyle}>First PayDay (anchor date)</label>
                  <input type="date" value={fmtDateInput(s.payDayAnchor)} onChange={e=>setS({...s,payDayAnchor:new Date(e.target.value+"T00:00:00")})}
                    style={{...inputStyle,marginBottom:6}} />
                  <p style={{ fontSize:14,color:"#777",margin:"0 0 16px" }}>PayDay repeats every 14 days from this date.</p>
                </>}
                {s.payDayFrequency==="monthly" && <>
                  <label style={labelStyle}>PayDay — day of month</label>
                  <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:16 }}>
                    <select value={s.payDayOfMonth} onChange={e=>setS({...s,payDayOfMonth:parseInt(e.target.value)})}
                      style={{ padding:"8px 12px",borderRadius:8,border:"1.5px solid #ddd",fontSize:16 }}>
                      {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d}>{d}</option>)}
                    </select>
                    <span style={{ background:"#2E7D32",color:"#fff",padding:"4px 10px",borderRadius:6,fontWeight:700,fontSize:15 }}>$ PayDay</span>
                  </div>
                </>}
              </>}
            </div>
          )}
          {tab===1 && (
            <div>
              <label style={labelStyle}>Hourly Rate</label>
              <p style={{ fontSize:14,color:"#777",margin:"2px 0 10px" }}>Enter your base hourly pay rate.</p>
              <div style={{ position:"relative",marginBottom:24 }}>
                <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:18,fontWeight:700,color:"#555" }}>$</span>
                <input value={rate} onChange={e=>setRate(e.target.value.replace(/[^0-9.]/g,""))} placeholder="0.00"
                  style={{ ...inputStyle,paddingLeft:30,fontSize:20,fontWeight:700 }} />
              </div>
              <label style={labelStyle}>Overtime (OT) Multiplier</label>
              <p style={{ fontSize:14,color:"#777",margin:"2px 0 12px" }}>Shifts marked as OT will multiply the hourly rate by this amount.</p>
              <div style={{ display:"flex",gap:10,marginBottom:24 }}>
                {[[1.5,"1.5×  (Time & Half)"],[2.0,"2×  (Double Time)"]].map(([m,l])=>(
                  <button key={m} onClick={()=>setS({...s,otMultiplier:m})}
                    style={{ padding:"8px 16px",borderRadius:20,border:`1px solid ${s.otMultiplier===m?"#6A1B9A":"#ccc"}`,background:s.otMultiplier===m?"#6A1B9A":"#f5f5f5",color:s.otMultiplier===m?"#fff":"#333",fontWeight:s.otMultiplier===m?700:400,cursor:"pointer",fontSize:14 }}>
                    {l}
                  </button>
                ))}
              </div>
              {parsedRate > 0 && <>
                <label style={labelStyle}>Preview</label>
                <div style={{ background:hexOp("#6A1B9A",0.08),border:`1px solid ${hexOp("#6A1B9A",0.3)}`,borderRadius:10,padding:14 }}>
                  {shifts.filter(sh=>sh.showOnCalendar&&sh.hours>0).map(sh=>(
                    <div key={sh.id} style={{ display:"flex",alignItems:"center",padding:"3px 0" }}>
                      <span style={{ marginRight:6 }}>{Icons[sh.icon]}</span>
                      <span style={{ fontWeight:700,color:sh.color,fontSize:15 }}>{sh.name}</span>
                      <span style={{ color:"#999",fontSize:14,marginLeft:4 }}>({sh.hours}h)</span>
                      <span style={{ marginLeft:"auto",fontWeight:700,fontSize:15 }}>
                        ${((sh.isOvertimeRate?parsedRate*s.otMultiplier:parsedRate)*sh.hours).toFixed(2)}/shift
                      </span>
                    </div>
                  ))}
                  <hr style={{ margin:"8px 0",border:"none",borderTop:"1px solid #ddd" }}/>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:14 }}>
                    <span>OT rate per hour:</span>
                    <span style={{ fontWeight:700,color:"#6A1B9A" }}>${(parsedRate*s.otMultiplier).toFixed(2)}/h</span>
                  </div>
                </div>
              </>}
            </div>
          )}
          {tab===2 && (
            <div>
              <label style={labelStyle}>Customize Shift Types</label>
              <p style={{ fontSize:14,color:"#777",margin:"2px 0 14px" }}>Tap to edit · Swipe or tap 🗑️ to delete · Max 8 types.</p>
              {shifts.map((sh,i)=>(
                <div key={sh.id||i} style={{ display:"flex",alignItems:"center",background:"#fff",border:"1.5px solid #eee",borderRadius:12,padding:"10px 12px",marginBottom:10,gap:12,boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ width:44,height:44,borderRadius:10,background:hexOp(sh.color,0.15),border:`2px solid ${sh.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>{Icons[sh.icon]}</div>
                  <div style={{ flex:1, cursor:"pointer" }} onClick={()=>setEditingShift(i)}>
                    <div style={{ fontWeight:700,fontSize:16 }}>{sh.name}</div>
                    <div style={{ fontSize:13,color:"#777" }}>{sh.showOnCalendar ? `${sh.hours}h${sh.isOvertimeRate?" · OT Rate":""}` : "Clears calendar entry"}</div>
                  </div>
                  <button onClick={()=>setEditingShift(i)} style={{ background:"none",border:"none",cursor:"pointer",padding:4,color:"#999",fontSize:18 }}>✏️</button>
                  {shifts.length>1 && <button onClick={()=>setDeleteConfirm(i)} style={{ background:"none",border:"none",cursor:"pointer",padding:4,color:"#ef5350",fontSize:18 }}>🗑️</button>}
                </div>
              ))}
              {shifts.length < 8 && (
                <button onClick={()=>setAddingShift(true)}
                  style={{ width:"100%",padding:14,borderRadius:10,border:"1.5px dashed #1565C0",background:"none",color:"#1565C0",fontWeight:700,fontSize:15,cursor:"pointer",marginTop:4 }}>
                  + Add Shift Type
                </button>
              )}
            </div>
          )}
        </div>
        {/* Footer */}
        <div style={{ display:"flex",gap:12,padding:"8px 16px 20px" }}>
          <button onClick={onClose} style={{ ...btnOutline, flex:1 }}>Cancel</button>
          <button onClick={()=>{ onSave({...s,hourlyRate:parsedRate},shifts); onClose(); }} style={{ ...btnFilled, flex:1 }}>Save</button>
        </div>
      </div>
      {/* Nested dialogs */}
      {editingShift!==null && (
        <ShiftEditDialog shift={shifts[editingShift]} onClose={()=>setEditingShift(null)}
          onSave={u=>{ const ns=[...shifts]; ns[editingShift]=u; setShifts(ns); }} />
      )}
      {addingShift && (
        <ShiftEditDialog shift={{ id:Date.now(),name:"New",icon:"star",color:"#00838F",hours:8,showOnCalendar:true,isOvertimeRate:false }}
          onClose={()=>setAddingShift(false)} onSave={u=>setShifts([...shifts,{...u,id:Date.now()}])} />
      )}
      {deleteConfirm!==null && (
        <ConfirmDialog title="Delete Shift Type?"
          message={`Remove "${shifts[deleteConfirm].name}" from your shift types? Days already assigned will keep their data.`}
          onClose={()=>setDeleteConfirm(null)}
          onConfirm={()=>{ setShifts(shifts.filter((_,i)=>i!==deleteConfirm)); setDeleteConfirm(null); }} />
      )}
    </div>
  );
}

function fmtDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padLeft??""}${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── Shared styles ─────────────────────────────────────────────────────────
const btnFilled = { padding:"9px 18px",borderRadius:8,border:"none",background:"#1565C0",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:15 };
const btnOutline = { padding:"9px 18px",borderRadius:8,border:"1.5px solid #1565C0",background:"none",color:"#1565C0",fontWeight:700,cursor:"pointer",fontSize:15 };
const labelStyle = { display:"block",fontWeight:700,fontSize:16,marginBottom:6 };
const inputStyle = { width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid #ddd",fontSize:16,outline:"none",boxSizing:"border-box",fontFamily:"inherit" };
const iconBtn = { background:"none",border:"none",fontSize:28,cursor:"pointer",padding:"0 8px",color:"#555",lineHeight:1 };

// ── MAIN APP ──────────────────────────────────────────────────────────────

export default function LifeByShift() {
  const now = new Date();

  // ── localStorage helpers ──
  function loadJSON(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }
  function loadSettings() {
    const s = loadJSON("lbs_settings", null);
    if (!s) return {
      payPeriodStartDate: new Date(now.getFullYear(), now.getMonth(), 1),
      payPeriodColor: "#BBDEFB", showPayDay: true, payDayFrequency: "biweekly",
      payDayOfMonth: 15, payDayAnchor: new Date(now.getFullYear(), now.getMonth(), 1),
      hourlyRate: 0, otMultiplier: 1.5,
    };
    return { ...s,
      payPeriodStartDate: new Date(s.payPeriodStartDate),
      payDayAnchor: new Date(s.payDayAnchor),
    };
  }
  function loadShiftTypes() {
    return loadJSON("lbs_shiftTypes", null) || defaultShiftTypes();
  }

  const [darkMode, setDarkMode]   = useState(() => loadJSON("lbs_darkMode", false));
  const [month, setMonth]         = useState(new Date(now.getFullYear(), now.getMonth()));
  const [schedule, setSchedule]   = useState(() => loadJSON("lbs_schedule", {}));
  const [notes, setNotes]         = useState(() => loadJSON("lbs_notes", {}));
  const [selectedDate, setSelectedDate] = useState(null);
  const [shiftTypes, setShiftTypes] = useState(() => loadShiftTypes());
  const [dragging, setDragging]   = useState(null);
  const [selectedShift, setSelectedShift] = useState(null);
  const [hovering, setHovering]   = useState(null);
  const [otDialog, setOtDialog]   = useState(null);
  const [noteDialog, setNoteDialog] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dayRates, setDayRates] = useState(() => loadJSON("lbs_dayRates", {}));
  const [rateDialog, setRateDialog] = useState(null);
  const [settings, setSettings]   = useState(() => loadSettings());

  // ── auto-save ──
  useEffect(() => { saveJSON("lbs_schedule", schedule); }, [schedule]);
  useEffect(() => { saveJSON("lbs_notes", notes); }, [notes]);
  useEffect(() => { saveJSON("lbs_shiftTypes", shiftTypes); }, [shiftTypes]);
  useEffect(() => { saveJSON("lbs_darkMode", darkMode); }, [darkMode]);
  useEffect(() => { saveJSON("lbs_dayRates", dayRates); }, [dayRates]);
  useEffect(() => { saveJSON("lbs_settings", {
    ...settings,
    payPeriodStartDate: settings.payPeriodStartDate.toISOString(),
    payDayAnchor: settings.payDayAnchor.toISOString(),
  }); }, [settings]);

  const bg   = darkMode ? "#1a1a2e" : "#f5f7fa";
  const surf = darkMode ? "#16213e"  : "#ffffff";
  const text = darkMode ? "#e0e0e0"  : "#212121";
  const sub  = darkMode ? "#888"     : "#9E9E9E";

  // ── Pay period summary ──────────────────────────────────────────────────
  // Finds the pay period that contains `targetDate` and sums hours within it.
  function calcPeriodSummary(targetDate) {
    const anchor = settings.payPeriodStartDate;
    const targetD = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const anchorD = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const diff    = Math.round((targetD - anchorD) / 86400000);
    const idx     = Math.floor(diff / 14);
    const periodStart = new Date(anchorD);
    periodStart.setDate(periodStart.getDate() + idx * 14);

    const todayD = new Date();
    todayD.setHours(0,0,0,0);

    let worked=0, scheduled=0, workedIncome=0, scheduledIncome=0, shifts=0, totalHours=0;
    for (let i = 0; i < 14; i++) {
      const d = new Date(periodStart);
      d.setDate(d.getDate() + i);
      const k = key(d);
      const sh = schedule[k];
      if (sh && sh.showOnCalendar) {
        const otMult = sh.isOvertimeRate ? settings.otMultiplier : 1;
        const dayMult = dayRates[k] || 1;
        const rate = sh.isOvertimeRate
          ? settings.hourlyRate * settings.otMultiplier
          : settings.hourlyRate;
        // shifts: OT 배율 반영 (2x OT = 2 shifts 기준 12h)
        shifts += (sh.hours * otMult * dayMult) / 12;
        totalHours += sh.hours * otMult * dayMult;
        scheduled += sh.hours;
        if (settings.hourlyRate > 0) scheduledIncome += sh.hours * rate * dayMult;
        if (d <= todayD) {
          worked += sh.hours;
          if (settings.hourlyRate > 0) workedIncome += sh.hours * rate * dayMult;
        }
      }
    }
    return {
      periodStart,
      shifts,
      totalHours,
      worked,
      scheduled,
      remaining: Math.max(0, 80 - scheduled),
      workedIncome,
      scheduledIncome,
    };
  }

  // Summary shows the pay period that contains:
  //   1. the selected date (if user clicked a date), or
  //   2. today (default)
  // Navigating months alone never changes the summary.
  const today = new Date();
  const summary = calcPeriodSummary(selectedDate || today);

  const weeks = calendarWeeks(month);

  function dropShift(date, shift) {
    const k = key(date);
    if (!shift.showOnCalendar) {
      // "Off" / reset type — clear the cell + vanish sound
      setSchedule(s => { const n={...s}; delete n[k]; return n; });
      playVanishSound();
    } else if (shift.isOvertimeRate) {
      // OT type — always ask how many hours (coin plays after confirm)
      setOtDialog({date, shift});
    } else {
      setSchedule(s => ({...s, [k]: shift}));
      playCoinSound();
    }
  }

  function handleCellClick(date) {
    const k = key(date);
    // If a shift is selected (tap mode), assign it to this date
    if (selectedShift) {
      dropShift(date, selectedShift);
      setSelectedShift(null);
      setSelectedDate(date);
      return;
    }
    // Otherwise toggle date selection
    if (selectedDate && key(selectedDate)===k) setSelectedDate(null);
    else setSelectedDate(date);
  }

  function handleCellDblClick(date) {
    const k = key(date);
    if (schedule[k]) setConfirmDialog({date, k});
  }

  // ── Long press ───────────────────────────────────────────────────────────
  const longPressTimer = useRef(null);
  function handleLongPressStart(date) {
    const k = key(date);
    if (!schedule[k]) return;
    longPressTimer.current = setTimeout(() => {
      setRateDialog(date);
    }, 600);
  }
  function handleLongPressEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  // ── Drag & drop (mouse) ─────────────────────────────────────────────────
  const dragShiftRef = useRef(null);

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", background:bg, minHeight:"100vh", display:"flex", flexDirection:"column", width:"100%", position:"relative" }}>
      {/* ── Header ── */}
      <div style={{ background:surf, padding:"10px 16px 10px 16px", display:"flex", alignItems:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.07)" }}>
        <img src="/app_title.png" style={{ height:32,objectFit:"contain" }} alt="Life by Shift" />
        <div style={{ marginLeft:"auto",display:"flex",gap:2 }}>
          <button onClick={()=>setDarkMode(d=>!d)} style={headerBtn}>{darkMode?"☀️":"🌙"}</button>
          <button onClick={()=>setShowHelp(true)} style={headerBtn}>❓</button>
          <button onClick={()=>setShowSettings(true)} style={headerBtn}>⚙️</button>
        </div>
      </div>

      {/* ── Shift Palette ── */}
      <div style={{ background:surf,boxShadow:"0 2px 6px rgba(0,0,0,0.06)",overflowX:"auto" }}>
        <div style={{ display:"flex",padding:"10px 8px",gap:0,minWidth:"max-content",width:"100%" }}>
          {[...shiftTypes]
            .sort((a,b) => {
              // Off/Reset types always go to the far right
              if (!a.showOnCalendar && b.showOnCalendar) return 1;
              if (a.showOnCalendar && !b.showOnCalendar) return -1;
              return 0;
            })
            .map(shift=>(
            <div key={shift.id||shift.name}
              draggable
              onDragStart={()=>{ dragShiftRef.current=shift; setDragging(shift); ensureAudio(); setSelectedShift(null); }}
              onDragEnd={()=>{ setDragging(null); setHovering(null); }}
              onClick={()=>{ setSelectedShift(s => s===shift ? null : shift); }}
              style={{ display:"flex",flexDirection:"column",alignItems:"center",flex:"1 0 auto",padding:"0 6px",cursor:"pointer",opacity:dragging===shift?0.35:1,transition:"all 0.15s",
                transform: selectedShift===shift ? "scale(1.12)" : "scale(1)",
              }}>
              <div style={{ width:46,height:46,borderRadius:14,
                background: selectedShift===shift ? shift.color : hexOp(shift.color,0.12),
                border:`2px solid ${shift.color}`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,
                boxShadow: selectedShift===shift ? `0 0 0 3px ${hexOp(shift.color,0.35)}` : "none",
                transition:"all 0.15s",
              }}>
                {Icons[shift.icon]}
              </div>
              <span style={{ fontSize:12,fontWeight:700,color:selectedShift===shift?"#fff":shift.color,marginTop:4,whiteSpace:"nowrap",
                background: selectedShift===shift ? shift.color : "transparent",
                padding: selectedShift===shift ? "1px 6px" : "0",
                borderRadius:8, transition:"all 0.15s",
              }}>
                {shift.showOnCalendar ? shift.name : `${shift.name} (Reset)`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tap mode hint ── */}
      {selectedShift && (
        <div style={{ background:selectedShift.color,color:"#fff",textAlign:"center",padding:"7px 12px",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          <span style={{fontSize:16}}>{Icons[selectedShift.icon]}</span>
          <span>{selectedShift.showOnCalendar ? selectedShift.name : "Reset"} selected — tap a date to assign</span>
          <button onClick={()=>setSelectedShift(null)}
            style={{marginLeft:"auto",background:"rgba(255,255,255,0.25)",border:"none",color:"#fff",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:13,fontWeight:700}}>
            ✕
          </button>
        </div>
      )}

      {/* ── Month nav ── */}}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 4px 2px" }}>
        <button onClick={()=>setMonth(m=>new Date(m.getFullYear(),m.getMonth()-1))} style={navBtn}>‹</button>
        <span style={{ fontSize:18,fontWeight:700,color:text }}>{MONTH_NAMES[month.getMonth()+1]}  {month.getFullYear()}</span>
        <button onClick={()=>setMonth(m=>new Date(m.getFullYear(),m.getMonth()+1))} style={navBtn}>›</button>
      </div>

      {/* ── Week labels ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"2px 0" }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(l=>(
          <div key={l} style={{ textAlign:"center",fontSize:13,fontWeight:700,color:sub,padding:"2px 0" }}>{l}</div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div style={{ flex:1 }}>
        {weeks.map((week,wi)=>(
          <div key={wi} style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)" }}>
            {week.map(date=>{
              const k = key(date);
              const inMonth = date.getMonth()===month.getMonth();
              const today   = isToday(date);
              const payday  = isPayDay(date,settings);
              const shift   = schedule[k];
              const band    = payBand(date,settings.payPeriodStartDate);
              const hasNote = !!(notes[k]);
              const isSel   = selectedDate && key(selectedDate)===k;
              const isHov   = hovering===k;
              const isShiftHov = selectedShift && isSel; // cell is selected + shift ready
              const bgCell  = isHov ? hexOp("#1565C0",0.15)
                : isShiftHov ? hexOp(selectedShift.color,0.20)
                : band===0 ? hexOp(settings.payPeriodColor,0.40)
                : "transparent";

              return (
                <div key={k}
                  onDragOver={e=>{e.preventDefault();setHovering(k);}}
                  onDragLeave={()=>setHovering(null)}
                  onDrop={e=>{ e.preventDefault(); setHovering(null); if(dragShiftRef.current) dropShift(date,dragShiftRef.current); }}
                  onClick={()=>handleCellClick(date)}
                  onDoubleClick={()=>handleCellDblClick(date)}
                  onMouseDown={()=>handleLongPressStart(date)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStart={()=>handleLongPressStart(date)}
                  onTouchEnd={handleLongPressEnd}
                  onContextMenu={e=>{e.preventDefault();setNoteDialog(date);}}
                  style={{ height:68,margin:1.5,borderRadius:8,background:bgCell,border:`${isSel||today?2:1}px solid ${isSel?"#1565C0":today?"#1565C0":isHov?hexOp("#1565C0",0.5):"rgba(0,0,0,0.13)"}`,position:"relative",cursor:"pointer",transition:"all 0.13s",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  {/* Rate badge */}
                  {shift && dayRates[k] && dayRates[k] !== 1 && (
                    <div style={{ position:"absolute",top:2,left:2,background:"#6A1B9A",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 4px",borderRadius:3 }}>{dayRates[k]}x</div>
                  )}
                  {/* PayDay badge */}
                  {payday && <div style={{ position:"absolute",top:2,right:2,background:"#2E7D32",color:"#fff",fontSize:9,fontWeight:700,padding:"1px 3px",borderRadius:3 }}>$</div>}
                  {/* Note dot */}
                  {hasNote && <div style={{ position:"absolute",bottom:3,right:3,width:6,height:6,borderRadius:"50%",background:"#E65100" }} />}
                  <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:1 }}>
                    <div style={{ width:24,height:24,borderRadius:"50%",background:today?"#1565C0":"transparent",display:"flex",alignItems:"center",justifyContent:"center" }}>
                      <span style={{ fontSize:14,fontWeight:today?700:400,color:today?"#fff":inMonth?(darkMode?"#e0e0e0":"#212121"):"#bbb" }}>{date.getDate()}</span>
                    </div>
                    {shift && shift.showOnCalendar && <>
                      <span style={{ fontSize:14 }}>{Icons[shift.icon]}</span>
                      <span style={{ fontSize:9,fontWeight:700,color:shift.color }}>{shift.name}</span>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Selected date detail ── */}
      {selectedDate && (
        <div style={{ margin:"6px 8px 0",padding:12,background:surf,borderRadius:12,border:"1px solid "+hexOp("#1565C0",0.3),boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:6 }}>
            <span style={{ fontSize:13,color:"#1565C0" }}>📅</span>
            <span style={{ fontWeight:700,fontSize:15,color:"#1565C0" }}>{MONTH_NAMES[selectedDate.getMonth()+1]} {selectedDate.getDate()}, {selectedDate.getFullYear()}</span>
            {schedule[key(selectedDate)]?.showOnCalendar && (
              <span style={{ marginLeft:8,padding:"2px 8px",borderRadius:10,background:hexOp(schedule[key(selectedDate)].color,0.15),border:`1px solid ${schedule[key(selectedDate)].color}`,fontSize:13,fontWeight:700,color:schedule[key(selectedDate)].color }}>
                {Icons[schedule[key(selectedDate)].icon]} {schedule[key(selectedDate)].name}
              </span>
            )}
            <button onClick={()=>setNoteDialog(selectedDate)} style={{ marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:sub,fontSize:16 }}>✏️</button>
          </div>
          {notes[key(selectedDate)] ? (
            <div style={{ marginTop:8,paddingTop:8,borderTop:"1px solid #eee",fontSize:15,lineHeight:1.4,display:"flex",gap:6 }}>
              <span style={{ color:"#E65100",fontSize:14 }}>📝</span>
              <span style={{ color:text }}>{notes[key(selectedDate)]}</span>
            </div>
          ) : (
            <p style={{ margin:"6px 0 0",fontSize:14,color:sub,fontStyle:"italic" }}>Right-click / long-press to add a note</p>
          )}
        </div>
      )}

      <div style={{ height:8 }} />

      {/* ── Summary bar ── */}
      <div style={{ background:surf,padding:"10px 12px 16px",boxShadow:"0 -3px 10px rgba(0,0,0,0.08)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:8 }}>
          <div style={{ width:10,height:10,borderRadius:2,background:settings.payPeriodColor,border:"1px solid rgba(0,0,0,0.15)",flexShrink:0 }} />
          {(() => {
            const ps = summary.periodStart;
            const pe = new Date(ps); pe.setDate(pe.getDate()+13);
            const fmt = d => `${MONTH_NAMES[d.getMonth()+1].slice(0,3)} ${d.getDate()}`;
            const isCurrentPeriod = calcPeriodSummary(new Date()).periodStart.getTime() === ps.getTime();
            return (
              <span style={{ fontSize:13,fontWeight:600,color:sub }}>
                {isCurrentPeriod ? "Current" : "Viewing"} Pay Period
                <span style={{ fontWeight:400 }}>  ·  {fmt(ps)} – {fmt(pe)}</span>
              </span>
            );
          })()}
        </div>
        <div style={{ display:"flex",justifyContent:"space-evenly",alignItems:"center" }}>
          <SummaryTile label="Shifts" value={summary.shifts % 1 === 0 ? summary.shifts : summary.shifts.toFixed(1)} icon="🔄" color="#1565C0" subtitle="this period" />
          <div style={{ width:1,height:38,background:"rgba(0,0,0,0.12)" }} />
          <SummaryTile label="Hours" value={`${summary.totalHours % 1 === 0 ? summary.totalHours : summary.totalHours.toFixed(1)}h`} icon="🕐" color="#E65100" subtitle="straight pay" />
          {settings.hourlyRate > 0 && <>
            <div style={{ width:1,height:38,background:"rgba(0,0,0,0.12)" }} />
            <SummaryTile label="Est. Income" value={`$${Math.round(summary.scheduledIncome)}`} icon="💵" color="#6A1B9A" subtitle="this period" />
          </>}
        </div>
      </div>

      {/* ── Dialogs ── */}
      {otDialog && (
        <OTDialog date={otDialog.date} shift={otDialog.shift} onClose={()=>setOtDialog(null)}
          onConfirm={h=>{ const k=key(otDialog.date); setSchedule(s=>({...s,[k]:{...otDialog.shift,hours:h}})); playCoinSound(); }} />
      )}
      {noteDialog && (
        <NoteDialog date={noteDialog} note={notes[key(noteDialog)]||""} onClose={()=>setNoteDialog(null)}
          onSave={t=>setNotes(n=>t?{...n,[key(noteDialog)]:t}:(({[key(noteDialog)]:_,...r})=>r)(n))}
          onDelete={()=>setNotes(n=>(({[key(noteDialog)]:_,...r})=>r)(n))} />
      )}
      {confirmDialog && (
        <ConfirmDialog title="Remove Shift?"
          message={`Remove ${schedule[confirmDialog.k]?.name} from ${MONTH_NAMES[confirmDialog.date.getMonth()+1]} ${confirmDialog.date.getDate()}?`}
          onClose={()=>setConfirmDialog(null)}
          onConfirm={()=>setSchedule(s=>{ const n={...s}; delete n[confirmDialog.k]; return n; })} />
      )}
      {showHelp && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
          <div style={{ background:"#fff",borderRadius:20,width:"100%",maxWidth:400,boxShadow:"0 8px 40px rgba(0,0,0,0.18)",overflow:"hidden",maxHeight:"90vh",display:"flex",flexDirection:"column" }}>
            {/* 헤더 */}
            <div style={{ background:"#1565C0",padding:"20px 20px 16px" }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                <div>
                  <div style={{ color:"#fff",fontWeight:800,fontSize:20 }}>Life by Shift</div>
                  <div style={{ color:"rgba(255,255,255,0.7)",fontSize:12,marginTop:2,letterSpacing:1 }}>BETA VERSION</div>
                </div>
                <button onClick={()=>setShowHelp(false)} style={{ background:"rgba(255,255,255,0.15)",border:"none",borderRadius:10,width:32,height:32,cursor:"pointer",fontSize:18,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center" }}>×</button>
              </div>
            </div>
            {/* 내용 */}
            <div style={{ padding:"20px 20px 24px",display:"flex",flexDirection:"column",gap:16,overflowY:"auto" }}>

              {/* 베타 안내 */}
              <div style={{ background:"#FFF8E1",borderRadius:12,padding:"12px 14px",border:"1px solid #FFE082" }}>
                <div style={{ fontWeight:700,fontSize:13,color:"#F57F17",marginBottom:4 }}>⚠️ Beta Version</div>
                <div style={{ fontSize:13,color:"#5D4037",lineHeight:1.6 }}>
                  This app is currently running as a <strong>web app beta</strong>. A native iOS/Android app is coming soon to the App Store.
                </div>
              </div>

              {/* 데이터 저장 */}
              <div style={{ background:"#E3F2FD",borderRadius:12,padding:"12px 14px",border:"1px solid #BBDEFB" }}>
                <div style={{ fontWeight:700,fontSize:13,color:"#1565C0",marginBottom:4 }}>📱 Your Data</div>
                <div style={{ fontSize:13,color:"#1A237E",lineHeight:1.6 }}>
                  Your data is stored <strong>locally on your device only</strong>. Clearing your browser cache will erase your data. We do not store anything on our servers.
                </div>
              </div>

              {/* 보안 */}
              <div style={{ background:"#E8F5E9",borderRadius:12,padding:"12px 14px",border:"1px solid #C8E6C9" }}>
                <div style={{ fontWeight:700,fontSize:13,color:"#2E7D32",marginBottom:4 }}>🔒 Privacy & Security</div>
                <div style={{ fontSize:13,color:"#1B5E20",lineHeight:1.6 }}>
                  <strong>No data collection. No servers. No API keys.</strong> Everything stays on your device. This is one of the safest structures possible for a web app.
                </div>
              </div>

              {/* 팁 */}
              <div style={{ background:"#F3E5F5",borderRadius:12,padding:"12px 14px",border:"1px solid #E1BEE7" }}>
                <div style={{ fontWeight:700,fontSize:13,color:"#6A1B9A",marginBottom:4 }}>💡 Tip</div>
                <div style={{ fontSize:13,color:"#4A148C",lineHeight:1.6 }}>
                  Add this app to your home screen for the best experience! In Safari, tap the Share button and select <strong>"Add to Home Screen"</strong>.
                </div>
              </div>

              <button onClick={()=>setShowHelp(false)} style={{ background:"#1565C0",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontWeight:700,fontSize:15,cursor:"pointer",marginTop:4 }}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
      {rateDialog && (
        <RateDialog
          date={rateDialog}
          currentRate={dayRates[key(rateDialog)] || 1}
          onClose={()=>setRateDialog(null)}
          onSave={r=>{
            const k=key(rateDialog);
            setDayRates(d=>r===1 ? (({[k]:_,...rest})=>rest)(d) : {...d,[k]:r});
            setRateDialog(null);
          }}
        />
      )}
      {showSettings && (
        <SettingsSheet settings={settings} shiftTypes={shiftTypes} onClose={()=>setShowSettings(false)}
          onSave={(ns,nst)=>{ setSettings(ns); setShiftTypes(nst); }} />
      )}
    </div>
  );
}

function RateDialog({ date, currentRate, onClose, onSave }) {
  const [selected, setSelected] = useState(currentRate);
  const [custom, setCustom] = useState(
    [1, 1.5, 2].includes(currentRate) ? "" : String(currentRate)
  );
  const presets = [
    { label:"1x", sub:"Regular", value:1 },
    { label:"1.5x", sub:"Time & Half", value:1.5 },
    { label:"2x", sub:"Double Time", value:2 },
  ];
  const finalRate = custom ? parseFloat(custom) : selected;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"#fff",borderRadius:20,width:"100%",maxWidth:360,boxShadow:"0 8px 40px rgba(0,0,0,0.18)",maxHeight:"90vh",display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"18px 20px 0" }}>
          <div style={{ fontWeight:800,fontSize:17,marginBottom:2 }}>Holiday / Special Rate</div>
          <div style={{ fontSize:13,color:"#888",marginBottom:16 }}>
            {MONTH_NAMES[date.getMonth()+1]} {date.getDate()} — tap a preset or enter custom
          </div>
        </div>
        <div style={{ padding:"0 20px 20px",overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:10 }}>
          {/* 프리셋 버튼 */}
          <div style={{ display:"flex",gap:8 }}>
            {presets.map(p=>(
              <button key={p.value} onClick={()=>{ setSelected(p.value); setCustom(""); }}
                style={{ flex:1,padding:"10px 4px",borderRadius:12,border:`2px solid ${selected===p.value&&!custom?"#6A1B9A":"#e0e0e0"}`,background:selected===p.value&&!custom?"#F3E5F5":"#f9f9f9",cursor:"pointer",transition:"all 0.15s" }}>
                <div style={{ fontWeight:800,fontSize:18,color:selected===p.value&&!custom?"#6A1B9A":"#333" }}>{p.label}</div>
                <div style={{ fontSize:11,color:"#888",marginTop:2 }}>{p.sub}</div>
              </button>
            ))}
          </div>
          {/* Custom 입력 */}
          <div style={{ background:"#f5f5f5",borderRadius:12,padding:"12px 14px" }}>
            <div style={{ fontSize:13,fontWeight:700,color:"#555",marginBottom:6 }}>Custom multiplier</div>
            <div style={{ display:"flex",alignItems:"center",gap:8 }}>
              <input
                type="number" min="1" max="5" step="0.25"
                placeholder="e.g. 1.75"
                value={custom}
                onChange={e=>{ setCustom(e.target.value); setSelected(null); }}
                style={{ flex:1,padding:"8px 12px",borderRadius:8,border:"1.5px solid #ddd",fontSize:16,outline:"none" }}
              />
              <span style={{ fontSize:15,color:"#888" }}>x</span>
            </div>
          </div>
          {/* 미리보기 */}
          {finalRate && finalRate > 0 && (
            <div style={{ background:"#EDE7F6",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#4A148C" }}>
              This shift will be calculated at <strong>{finalRate}x</strong> your hourly rate
            </div>
          )}
          {/* 버튼 */}
          <div style={{ display:"flex",gap:8,marginTop:4 }}>
            <button onClick={onClose} style={{ flex:1,padding:"12px",borderRadius:12,border:"1.5px solid #ddd",background:"#f5f5f5",fontWeight:700,fontSize:15,cursor:"pointer" }}>Cancel</button>
            <button onClick={()=>onSave(finalRate&&finalRate>0?finalRate:1)}
              style={{ flex:2,padding:"12px",borderRadius:12,border:"none",background:"#6A1B9A",color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer" }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, icon, color, subtitle }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center" }}>
      <div style={{ display:"flex",alignItems:"center",gap:3 }}>
        <span style={{ fontSize:13 }}>{icon}</span>
        <span style={{ fontSize:18,fontWeight:700,color }}>{value}</span>
      </div>
      <span style={{ fontSize:12,color:"#9E9E9E" }}>{label}</span>
      {subtitle && <span style={{ fontSize:11,color:"#9E9E9E" }}>{subtitle}</span>}
    </div>
  );
}

const headerBtn = { background:"none",border:"none",cursor:"pointer",fontSize:20,padding:"4px 6px",borderRadius:8 };
const navBtn    = { background:"none",border:"none",cursor:"pointer",fontSize:26,padding:"0 8px",color:"#555" };
