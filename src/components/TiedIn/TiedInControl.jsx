import { useState, useEffect, useRef } from 'react';
import OBSWebSocket from 'obs-websocket-js';
import './TiedInApp.css';

const OBS_WS_URL = "ws://localhost:4455";
const SCENE_WORK = "work";
const SCENE_EXPLAIN = "explain";
const SCENE_BREAK = "break";
const SCENE_STANDBY = "standby";

export default function TiedInControl() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('STREAM_ADMIN_KEY') || '');
  const [obsPassword, setObsPassword] = useState(() => localStorage.getItem('OBS_PASS') || '');
  
  const [inputKey, setInputKey] = useState('');
  const [inputObs, setInputObs] = useState('');
  
  const [isLocked, setIsLocked] = useState(!adminKey);

  const [state, setState] = useState({
    contactedCount: 0,
    convertedCount: 0,
    mode: 'work',
    accumulatedTodaySeconds: 0,
    modeTimestamp: Date.now()
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [obsConnected, setObsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const obsRef = useRef(null);

  // --- YouTube Markers ---
  const [ytMarkers, setYtMarkers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('YT_MARKERS')) || []; }
    catch { return []; }
  });
  const [streamStart, setStreamStart] = useState(() => Number(localStorage.getItem('YT_STREAM_START')) || null);
  const activeTaskRef = useRef("INITIAL_LOAD_FLAG");

  const formatYTTime = (startMillis) => {
     if (!startMillis) return "00:00";
     const diffSec = Math.max(0, Math.floor((Date.now() - startMillis) / 1000));
     const h = Math.floor(diffSec / 3600);
     const m = Math.floor((diffSec % 3600) / 60);
     const s = diffSec % 60;
     if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
     return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const addYtMarker = (text) => {
     setYtMarkers(prev => {
        const currentStart = Number(localStorage.getItem('YT_STREAM_START')); 
        const m = `${formatYTTime(currentStart)} - ${text}`;
        if (prev.length > 0 && prev[prev.length - 1].endsWith(`- ${text}`)) return prev;
        const next = [...prev, m];
        localStorage.setItem('YT_MARKERS', JSON.stringify(next));
        return next;
     });
  };

  const resetMarkers = () => {
    if (window.confirm("Start/Reset stream recording timeline from 00:00?")) {
       const now = Date.now();
       setStreamStart(now);
       localStorage.setItem('YT_STREAM_START', String(now));
       const initial = ["00:00 - Intro"];
       setYtMarkers(initial);
       localStorage.setItem('YT_MARKERS', JSON.stringify(initial));
    }
  };

  const addLog = (msg) => setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-20));

  useEffect(() => {
    if (isLocked) return;

    let intervalId;
    async function loadMetrics() {
      try {
        const res = await fetch(`https://tiesin.me/api/stream/state`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data?.webhookLogs) setWebhookLogs(data.webhookLogs);
        
        // Continuously hydrate state from API to avoid stale UI overrides,
        // but temporarily block syncing updates exactly when a manual push is happening
        if (data?.metrics && !isSyncing) {
           setState(s => ({ 
              ...s, 
              contactedCount: data.metrics.contactedCount ?? s.contactedCount,
              convertedCount: data.metrics.convertedCount ?? s.convertedCount,
              mode: data.metrics.mode || s.mode,
              accumulatedTodaySeconds: data.metrics.accumulatedTodaySeconds ?? s.accumulatedTodaySeconds,
              modeTimestamp: data.metrics.modeTimestamp ?? s.modeTimestamp
           }));
        }

        if (data?.tasks && Array.isArray(data.tasks)) {
           const activeTask = data.tasks.find(t => t.status === 'in_progress' || t.status === 'in progress');
           const taskName = activeTask ? activeTask.name : null;
           if (taskName && activeTaskRef.current !== taskName) {
              if (activeTaskRef.current !== "INITIAL_LOAD_FLAG") {
                 setState(s => {
                    if (s.mode === 'work') addYtMarker(`work - ${taskName}`);
                    return s;
                 });
              }
              activeTaskRef.current = taskName;
           } else if (!taskName && activeTaskRef.current !== null) {
              activeTaskRef.current = null;
           }
        }
      } catch (e) {}
    }
    loadMetrics();
    intervalId = setInterval(loadMetrics, 2000);
    return () => clearInterval(intervalId);
  }, [isLocked, isSyncing]);

  // Connect to OBS when unlocked
  useEffect(() => {
    if (isLocked) return;

    let keepConnecting = true;
    let fallbackConnectTimer;
    
    // Create OBS instance scoped to this effect run to avoid overlapping connection attempts
    const obs = new OBSWebSocket();
    obsRef.current = obs;

    async function connect() {
      if (!keepConnecting) return;
      try {
        addLog(`Attempting OBS WS connection to ${OBS_WS_URL}...`);
        await obs.connect(OBS_WS_URL, obsPassword);
        if (!keepConnecting) {
           obs.disconnect();
           return;
        }
        addLog("OBS Connected successfully!");
        setObsConnected(true);

        obs.on("CurrentProgramSceneChanged", (event) => {
           addLog(`OBS Scene changed to: ${event.sceneName}`);
           const map = { [SCENE_WORK]: "work", [SCENE_EXPLAIN]: "explain", [SCENE_BREAK]: "break", [SCENE_STANDBY]: "standby" };
           const mapped = map[event.sceneName];
           if (mapped) {
             setState(s => {
               if (s.mode !== mapped) {
                 if (mapped === "explain") {
                   obs.call("StartRecord")
                     .then(() => addLog("OBS record started (from scene)"))
                     .catch(e => addLog(`StartRecord failed: ${e.message}`));
                 } else {
                   obs.call("StopRecord")
                     .then(() => addLog("OBS record stopped (from scene)"))
                     .catch(e => addLog(`StopRecord failed: ${e.message}`));
                 }

                 addLog(`Syncing new mode to Vercel: ${mapped}`);
                 
                 let nextAccumulated = s.accumulatedTodaySeconds || 0;
                 let nextTimestamp = Date.now();
                 
                 const isWorkToExplain = (s.mode === 'work' && mapped === 'explain');
                 const isExplainToWork = (s.mode === 'explain' && mapped === 'work');

                 if (isWorkToExplain || isExplainToWork) {
                    nextAccumulated = s.accumulatedTodaySeconds || 0;
                    nextTimestamp = s.modeTimestamp || Date.now();
                 } else if (s.mode === 'work' || s.mode === 'explain') {
                    if (s.modeTimestamp) {
                       const elapsed = Math.max(0, Math.floor((Date.now() - s.modeTimestamp) / 1000));
                       nextAccumulated += elapsed;
                    }
                 }
                 
                 const newState = { 
                    ...s, 
                    mode: mapped,
                    accumulatedTodaySeconds: nextAccumulated,
                    modeTimestamp: nextTimestamp,
                    _skipPushCalc: true
                 };

                 pushUpdate(newState, true);
                 const hasTask = activeTaskRef.current && activeTaskRef.current !== "INITIAL_LOAD_FLAG";
                 const workText = hasTask ? `work - ${activeTaskRef.current}` : 'work';
                 addYtMarker(mapped === 'work' ? workText : mapped === 'explain' ? 'explain' : mapped === 'break' ? 'break' : 'standby');
                 return newState;
               }
               return s;
             });
           }
        });

        obs.on("ConnectionClosed", () => {
          if (!keepConnecting) return;
          addLog("OBS Connection Closed. Retrying in 5s...");
          setObsConnected(false);
          fallbackConnectTimer = setTimeout(connect, 5000);
        });

      } catch (err) {
        if (!keepConnecting) return;
        addLog(`OBS Connection Error: ${err.message || err.code || err}`);
        setObsConnected(false);
        fallbackConnectTimer = setTimeout(connect, 5000);
      }
    }

    connect();
    return () => { 
        keepConnecting = false; 
        clearTimeout(fallbackConnectTimer);
        obs.disconnect().catch(() => {});
    };
  }, [isLocked, obsPassword]);

  const saveAdminKey = (e) => {
    e.preventDefault();
    if (inputKey.trim()) {
      localStorage.setItem('STREAM_ADMIN_KEY', inputKey.trim());
      localStorage.setItem('OBS_PASS', inputObs.trim());
      setAdminKey(inputKey.trim());
      setObsPassword(inputObs.trim());
      setIsLocked(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('STREAM_ADMIN_KEY');
    localStorage.removeItem('OBS_PASS');
    setAdminKey('');
    setObsPassword('');
    setIsLocked(true);
    setObsConnected(false);
    if (obsRef.current) {
       obsRef.current.disconnect();
    }
  };

  const pushUpdate = async (newState, silent = false) => {
    if (!adminKey) return;
    if (!silent) setIsSyncing(true);
    
    let payload = { ...newState };

    if (payload.accumulatedTodaySeconds === -1 || payload.todayWorkSeconds === -1) {
       payload.accumulatedTodaySeconds = 0;
       payload.modeTimestamp = Date.now();
       payload.mode = "standby";
       payload.todayWorkSeconds = -1; // Keep for backend trigger just in case
    }
    
    delete payload._skipPushCalc;

    try {
      addLog(`Pushing state update...`);
      const res = await fetch('https://tiesin.me/api/stream/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        if (res.status === 401) {
          addLog("Sync Error: Unauthorized! Wrong STREAM_ADMIN_KEY.");
          alert("Unauthorized! Your STREAM_ADMIN_KEY is wrong.");
          logout();
          return;
        }
        let errData;
        try { errData = await res.json(); } catch(e) {}
        throw new Error(`Server returned ${res.status}: ${errData?.error || ''} ${errData?.details || ''}`);
      }
      
      addLog("State update synced.");
      if (!silent) setState(payload);
    } catch (e) {
      addLog(`Sync error: ${e.message}`);
      console.error("Failed to sync:", e);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  const handleMetric = (key, delta) => {
    pushUpdate({
      ...state,
      [key]: Math.max(0, state[key] + delta)
    });
  };

  const resetDay = () => {
    if (window.confirm("Reset entire day overlay clock back to zero and pause the screen? (Accumulated total will NOT be reset)")) {
      pushUpdate({ 
         ...state, 
         mode: "standby", 
         todayWorkSeconds: -1, // Backend uses this as the dedicated flush flag
         accumulatedTodaySeconds: -1, // Triggers reset in pushUpdate
         modeTimestamp: Date.now(),
         contactedCount: 0, 
         convertedCount: 0 
      });
    }
  };

  const setMode = (mode) => {
    if (state.mode === mode) return;

    let nextAccumulated = state.accumulatedTodaySeconds || 0;
    let nextTimestamp = Date.now();
    
    const isWorkToExplain = (state.mode === 'work' && mode === 'explain');
    const isExplainToWork = (state.mode === 'explain' && mode === 'work');
    
    if (isWorkToExplain || isExplainToWork) {
       nextAccumulated = state.accumulatedTodaySeconds || 0;
       nextTimestamp = state.modeTimestamp || Date.now();
    } else if (state.mode === 'work' || state.mode === 'explain') {
       if (state.modeTimestamp) {
          const elapsed = Math.max(0, Math.floor((Date.now() - state.modeTimestamp) / 1000));
          nextAccumulated += elapsed;
       }
    }
    
    const newState = {
      ...state,
      mode,
      accumulatedTodaySeconds: nextAccumulated,
      modeTimestamp: nextTimestamp,
      _skipPushCalc: true
    };

    if (obsRef.current && obsConnected) {
      addLog(`Telling OBS to switch scene to: ${mode}`);
      const scene = mode === "work" ? SCENE_WORK : mode === "explain" ? SCENE_EXPLAIN : mode === "break" ? SCENE_BREAK : SCENE_STANDBY;
      obsRef.current.call("SetCurrentProgramScene", { sceneName: scene }).catch(e => {
         addLog(`OBS Scene Change Error: ${e.message}`);
      });

      if (mode === "explain") {
        obsRef.current.call("StartRecord").catch(e => addLog(`obs err: ${e.message}`));
      } else if (mode === "standby") {
        obsRef.current.call("StopRecord").catch(e => addLog(`obs err: ${e.message}`));
      }
    }
    
    pushUpdate(newState, true);
    setState(newState);
    
    const hasTask = activeTaskRef.current && activeTaskRef.current !== "INITIAL_LOAD_FLAG";
    const workText = hasTask ? `work - ${activeTaskRef.current}` : 'work';
    addYtMarker(mode === 'work' ? workText : mode === 'explain' ? 'explain' : mode === 'break' ? 'break' : 'standby');
  };

  if (isLocked) {
    return (
      <div className="dashboard-login">
         <div className="login-box overlay-root">
             <h2 style={{color: '#fff', marginBottom: 24, fontSize: 18}}>TiedIn Control Panel</h2>
             <form onSubmit={saveAdminKey} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <input 
                   type="password" 
                   autoFocus
                   placeholder="Vercel Admin Secret" 
                   value={inputKey} 
                   onChange={e => setInputKey(e.target.value)} 
                 />
                 <input 
                   type="password" 
                   placeholder="OBS WS Password" 
                   value={inputObs} 
                   onChange={e => setInputObs(e.target.value)} 
                 />
                 <button type="submit" style={{marginTop: 8}}>UNCLOCK</button>
             </form>
         </div>
      </div>
    );
  }

  const workText = activeTaskRef.current && activeTaskRef.current !== "INITIAL_LOAD_FLAG" ? `work - ${activeTaskRef.current}` : 'work';

  return (
    <main className="overlay-root stack" style={{ width: '100%', height: '100dvh', background: 'var(--bg)', color: 'var(--white-92)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: 'var(--space-24)', gap: 'var(--space-16)' }}>

       {/* Header Box */}
       <div className="context-pill stack" style={{ padding: 'var(--space-16)', background: 'var(--panel-bg)' }}>
          <div className="side-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ fontSize: '18px', fontWeight: 'var(--weight-light)' }}>TiedIn Control</span>
             <span style={{ color: obsConnected ? '#4DAA57' : '#F95738', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
                <span className="status-dot" style={{ animationDuration: '3s' }}>&#9679;</span> {obsConnected ? 'OBS Connected' : 'OBS Disconnected'}
             </span>
          </div>
       </div>

       {/* Mode Panel */}
       <div className="context-pill stack" style={{ padding: 'var(--space-16)', background: 'var(--panel-bg)' }}>
          <div className="side-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--white-45)', textTransform: 'uppercase', fontSize: '12px', tracking: '0.1em' }}>
             <span>Current Mode</span>
             <span style={{ fontSize: '14px', fontWeight: 'var(--weight-regular)', color: 'var(--white-92)' }}>{state.mode.toUpperCase()}</span>
          </div>
          <div className="mode-buttons no-blur" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', marginTop: 'var(--space-12)' }}>
             <button className={`mode-btn ${state.mode === 'work' ? 'active' : ''}`} onClick={() => setMode('work')} style={{ borderColor: state.mode === 'work' ? 'var(--white-92)' : 'var(--white-25)', background: state.mode === 'work' ? 'var(--white-92)' : 'transparent', color: state.mode === 'work' ? 'var(--bg)' : 'var(--white-92)', padding: 'var(--space-12) 0', borderRadius: 0, textTransform: 'uppercase' }}>Work</button>
             <button className={`mode-btn ${state.mode === 'explain' ? 'active' : ''}`} onClick={() => setMode('explain')} style={{ borderColor: state.mode === 'explain' ? 'var(--white-92)' : 'var(--white-25)', background: state.mode === 'explain' ? 'var(--white-92)' : 'transparent', color: state.mode === 'explain' ? 'var(--bg)' : 'var(--white-92)', padding: 'var(--space-12) 0', borderRadius: 0, textTransform: 'uppercase' }}>Explain</button>
             <button className={`mode-btn ${state.mode === 'break' ? 'active' : ''}`} onClick={() => setMode('break')} style={{ borderColor: state.mode === 'break' ? 'var(--white-55)' : 'var(--white-25)', background: state.mode === 'break' ? 'var(--white-55)' : 'transparent', color: state.mode === 'break' ? 'var(--bg)' : 'var(--white-92)', padding: 'var(--space-12) 0', borderRadius: 0, textTransform: 'uppercase' }}>Break</button>
             <button className={`mode-btn ${state.mode === 'standby' ? 'active' : ''}`} onClick={() => setMode('standby')} style={{ borderColor: state.mode === 'standby' ? 'var(--white-40)' : 'var(--white-25)', background: state.mode === 'standby' ? 'var(--white-40)' : 'transparent', color: state.mode === 'standby' ? 'var(--bg)' : 'var(--white-92)', padding: 'var(--space-12) 0', borderRadius: 0, textTransform: 'uppercase' }}>Standby</button>
          </div>
       </div>

       {/* Metrics Box */}
       <div className="context-pill stack" style={{ padding: 'var(--space-16)', background: 'var(--panel-bg)' }}>
          <div className="side-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ color: 'var(--white-45)', textTransform: 'uppercase', fontSize: '12px' }}>Contacted</span>
             <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                <button className="metric-btn dec" onClick={() => handleMetric('contactedCount', -1)} style={{ padding: 'var(--space-4) var(--space-12)', borderRadius: 0, background: 'var(--white-12)', border: 'none', color: 'var(--white-92)', fontSize: '16px' }}>-</button>
                <span style={{ fontSize: '24px', width: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--weight-light)' }}>{state.contactedCount}</span>
                <button className="metric-btn inc" onClick={() => handleMetric('contactedCount', 1)} style={{ padding: 'var(--space-4) var(--space-12)', borderRadius: 0, background: 'var(--white-12)', border: 'none', color: 'var(--white-92)', fontSize: '16px' }}>+</button>
             </div>
          </div>
          <div className="side-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-16)' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <span style={{ color: 'var(--white-45)', textTransform: 'uppercase', fontSize: '12px' }}>Converted</span>
                <span style={{ fontSize: '10px', background: 'var(--white-12)', color: 'var(--white-92)', padding: '1px var(--space-4)', width: 'fit-content' }}>+1% CVR</span>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                <button className="metric-btn dec" onClick={() => handleMetric('convertedCount', -1)} style={{ padding: 'var(--space-4) var(--space-12)', borderRadius: 0, background: 'rgba(255, 186, 8, 0.1)', border: 'none', color: '#FFBA08', fontSize: '16px' }}>-</button>
                <span style={{ fontSize: '24px', width: 40, textAlign: 'center', color: '#FFBA08', fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--weight-light)' }}>{state.convertedCount}</span>
                <button className="metric-btn inc" onClick={() => handleMetric('convertedCount', 1)} style={{ padding: 'var(--space-4) var(--space-12)', borderRadius: 0, background: 'rgba(255, 186, 8, 0.1)', border: 'none', color: '#FFBA08', fontSize: '16px' }}>+</button>
             </div>
          </div>
       </div>

       {/* YouTube Markers Box */}
       <div className="context-pill stack" style={{ flex: 1, minHeight: 200, display: 'flex', flexDirection: 'column', padding: 'var(--space-16)', background: 'var(--panel-bg)' }}>
          <div className="side-line" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-12)' }}>
             <span style={{ color: 'var(--white-45)', textTransform: 'uppercase', fontSize: '12px' }}>Timestamps</span>
             <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
                <button onClick={() => addYtMarker(state.mode === 'work' ? workText : state.mode === 'explain' ? 'explain' : state.mode === 'break' ? 'break' : 'standby')} style={{ padding: 'var(--space-4) var(--space-12)', fontSize: '11px', background: 'var(--white-92)', border: 'none', color: 'var(--bg)', textTransform: 'uppercase' }}>+ Marker</button>
                <button onClick={resetMarkers} style={{ padding: 'var(--space-4) var(--space-12)', fontSize: '11px', background: 'transparent', border: '1px solid var(--white-45)', color: 'var(--white-92)', textTransform: 'uppercase' }}>Reset</button>
             </div>
          </div>
          {streamStart && (
             <div className="side-line" style={{ marginBottom: 'var(--space-12)', color: '#4DAA57', fontSize: '12px' }}>
                Live: {formatYTTime(streamStart)}
             </div>
          )}
          {ytMarkers.length === 0 ? <div className="side-line" style={{ color: 'var(--white-35)' }}>No markers yet...</div> : null}
          <textarea 
             readOnly
             value={ytMarkers.join('\n')}
             style={{ flex: 1, width: '100%', minHeight: 120, background: 'transparent', border: 'none', color: 'var(--white-70)', resize: 'none', outline: 'none', fontSize: '12px', fontFamily: 'monospace' }}
          />
       </div>

       {/* Action Buttons Box */}
       <div className="context-pill stack" style={{ gap: 'var(--space-12)', padding: 'var(--space-16)', background: 'var(--panel-bg)' }}>
          <button onClick={resetDay} style={{ width: '100%', padding: 'var(--space-12)', background: 'transparent', border: '1px solid rgba(249, 87, 56, 0.5)', color: '#F95738', textTransform: 'uppercase', fontSize: '12px', tracking: '0.05em' }}>Reset Overlay Clocks</button>
          <button onClick={logout} style={{ width: '100%', padding: 'var(--space-12)', background: 'transparent', border: '1px solid var(--white-25)', color: 'var(--white-55)', textTransform: 'uppercase', fontSize: '12px', tracking: '0.05em' }}>Disconnect & Lock</button>
       </div>

       {/* Floating Logs */}
       <div className="floating-logs" style={{ position: 'fixed', bottom: 'var(--space-20)', right: 'var(--space-20)', width: 300, pointerEvents: 'none' }}>
           {logs.map((l, i) => (
              <div key={i} style={{ background: 'var(--panel-bg)', color: 'var(--white-92)', fontSize: '11px', fontFamily: 'monospace', padding: '6px var(--space-12)', borderLeft: '2px solid var(--white-45)', marginBottom: 'var(--space-4)', backdropFilter: 'blur(10px)' }}>
                 {l}
              </div>
           ))}
       </div>

    </main>
  );
}
