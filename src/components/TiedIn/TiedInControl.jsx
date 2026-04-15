import { useState, useEffect, useRef } from 'react';
import './TiedInApp.css';

const OBS_WS_URL = "ws://localhost:4455";
const SCENE_WORK = "work";
const SCENE_EXPLAIN = "explain";
const SCENE_BREAK = "break";

export default function TiedInControl() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('STREAM_ADMIN_KEY') || '');
  const [obsPassword, setObsPassword] = useState(() => localStorage.getItem('OBS_PASS') || '');
  
  const [inputKey, setInputKey] = useState('');
  const [inputObs, setInputObs] = useState('');
  
  const [isLocked, setIsLocked] = useState(!adminKey);

  const [state, setState] = useState({
    contactedCount: 0,
    convertedCount: 0,
    mode: 'work'
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [obsConnected, setObsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const obsRef = useRef(null);

  const addLog = (msg) => setLogs(l => [...l, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-20));

  // 1. Fetch Initial State from Vercel so Dashboard doesn't default to 0 on reload.
  useEffect(() => {
    if (isLocked) return;
    async function loadMetrics() {
       addLog("Fetching initial state from Vercel...");
       try {
         const response = await fetch("https://tiesin.me/api/stream/state");
         if (!response.ok) {
           addLog(`Vercel fetch failed with status ${response.status}`);
           return;
         }
         const data = await response.json();
         if (data?.metrics) {
           addLog("Vercel state loaded.");
           setState({
             contactedCount: Number(data.metrics.contactedCount) || 0,
             convertedCount: Number(data.metrics.convertedCount) || 0,
             mode: data.metrics.mode || 'work'
           });
         }
       } catch (e) {
         addLog(`Vercel fetch error: ${e.message}`);
         console.warn("Failed loading metrics on dash start", e);
       }
    }
    loadMetrics();
  }, [isLocked]);

  // 2. Connect to OBS when unlocked
  useEffect(() => {
    if (isLocked) return;
    if (typeof window.OBSWebSocket === "undefined") {
      addLog("OBSWebSocket library not found globally.");
      return;
    }
    
    let keepConnecting = true;
    obsRef.current = new window.OBSWebSocket();

    async function connect() {
      if (!keepConnecting) return;
      try {
        addLog(`Attempting OBS WS connection to ${OBS_WS_URL}...`);
        await obsRef.current.connect(OBS_WS_URL, obsPassword);
        addLog("OBS Connected successfully!");
        setObsConnected(true);

        obsRef.current.on("CurrentProgramSceneChanged", (event) => {
           addLog(`OBS Scene changed to: ${event.sceneName}`);
           const map = { [SCENE_WORK]: "work", [SCENE_EXPLAIN]: "explain", [SCENE_BREAK]: "break" };
           const mapped = map[event.sceneName];
           if (mapped) {
             setState(s => {
               if (s.mode !== mapped) {
                 addLog(`Syncing new mode to Vercel: ${mapped}`);
                 pushUpdate({ ...s, mode: mapped }, true);
                 return { ...s, mode: mapped };
               }
               return s;
             });
           }
        });

        obsRef.current.on("ConnectionClosed", () => {
          addLog("OBS Connection Closed. Retrying in 5s...");
          setObsConnected(false);
          setTimeout(connect, 5000);
        });

      } catch (err) {
        addLog(`OBS Connection Error: ${err.message || err.code || err}`);
        setObsConnected(false);
        setTimeout(connect, 5000);
      }
    }

    connect();
    return () => { keepConnecting = false; };
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
    
    try {
      addLog(`Pushing state update...`);
      const res = await fetch('/api/stream/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`
        },
        body: JSON.stringify(newState)
      });

      if (res.status === 401) {
        addLog("Sync Error: Unauthorized! Wrong STREAM_ADMIN_KEY.");
        alert("Unauthorized! Your STREAM_ADMIN_KEY is wrong.");
        logout();
        return;
      }
      
      addLog("State update synced.");
      if (!silent) setState(newState);
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

  const setMode = (mode) => {
    if (state.mode === mode) return;

    if (obsRef.current && obsConnected) {
      addLog(`Telling OBS to switch scene to: ${mode}`);
      const scene = mode === "work" ? SCENE_WORK : mode === "explain" ? SCENE_EXPLAIN : SCENE_BREAK;
      obsRef.current.call("SetCurrentProgramScene", { sceneName: scene })
        .then(() => addLog("OBS switch command succeeded"))
        .catch((e) => addLog(`OBS switch command failed: ${e.message}`));
    } else {
      addLog(`Cannot control OBS. Connection is down.`);
    }

    pushUpdate({ ...state, mode });
  };

  if (isLocked) {
    return (
      <div className={`overlay-root mode-${state.mode}`} style={{ width: '100vw', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <form onSubmit={saveAdminKey} className="context-pill stack" style={{ padding: '60px', width: 460, textAlign: 'center', alignItems: 'center', background: 'var(--panel-bg)' }}>
          <div className="tl-title" style={{ fontSize: 24, marginBottom: 12 }}>TIEDIN DASHBOARD</div>
          <div className="session-line" style={{ marginBottom: 40, color: 'var(--white-55)' }}>
             <span className="session-label" style={{ letterSpacing: 2 }}>AUTHENTICATION REQUIRED</span>
          </div>
          
          <input 
            type="password"
            placeholder="Vercel Webhook Secret"
            value={inputKey}
            onChange={e => setInputKey(e.target.value)}
            style={{ width: '100%', height: 48, padding: '0 20px', marginBottom: 12, background: 'transparent', border: '1px solid var(--white-25)', color: 'var(--white-92)', textAlign: 'center', fontFamily: 'var(--font)', fontSize: 16, outline: 'none' }}
          />

          <input 
            type="password"
            placeholder="OBS WebSocket Password (Optional)"
            value={inputObs}
            onChange={e => setInputObs(e.target.value)}
            style={{ width: '100%', height: 48, padding: '0 20px', marginBottom: 20, background: 'transparent', border: '1px solid var(--white-25)', color: 'var(--white-92)', textAlign: 'center', fontFamily: 'var(--font)', fontSize: 16, outline: 'none' }}
          />

          <button type="submit" className="mode-btn inverted active" style={{ width: '100%', height: 48, fontSize: 16, border: 'none', cursor: 'pointer' }}>
            UNLOCK PANEL
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`overlay-root mode-${state.mode}`} style={{ width: '100vw', height: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      
      <div style={{ width: 1000, maxWidth: '100%' }}>
         
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 80 }}>
            <div className="context-pill stack" style={{ display: 'inline-flex', padding: '12px 24px', flexDirection: 'row', gap: 16, alignItems: 'center', background: 'var(--panel-bg)' }}>
               <div className="tl-title" style={{ fontWeight: 500, letterSpacing: 1, fontSize: 18 }}>STREAM CONTROL CENTER</div>
               {isSyncing ? (
                 <div className="tl-meta current" style={{ color: 'var(--white-45)', fontSize: 14 }}>&#9679;&nbsp;&nbsp;SYNCING TO VERCEL...</div>
               ) : (
                 <div className="tl-meta current" style={{ color: obsConnected ? '#00ff88' : '#ff4444', fontSize: 14 }}>
                    &#9679;&nbsp;&nbsp;OBS {obsConnected ? 'CONNECTED' : 'DISCONNECTED'}
                 </div>
               )}
            </div>
            
            <button onClick={logout} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--white-25)', color: 'var(--white-55)', fontFamily: 'var(--font)', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 4 }}>
               LOCK DASHBOARD
            </button>
         </div>

         <div className="mode-buttons" style={{ marginBottom: 80, justifyContent: 'space-between', width: '100%' }}>
            <button className={`mode-btn inverted ${state.mode === 'work' ? 'active' : ''}`} onClick={() => setMode('work')}>WORK</button>
            <button className={`mode-btn inverted ${state.mode === 'explain' ? 'active' : ''}`} onClick={() => setMode('explain')}>EXPLAIN</button>
            <button className={`mode-btn inverted ${state.mode === 'break' ? 'active' : ''}`} onClick={() => setMode('break')}>BREAK</button>
         </div>

         <div className="controls-row inverted" style={{ gap: 60 }}>
            <div className="counter" style={{ background: 'var(--panel-bg)', display: 'flex', alignItems: 'stretch' }}>
              <div className="counter-label" style={{ fontSize: 24, padding: '0 32px', display: 'flex', alignItems: 'center' }}>Contacted</div>
              <button type="button" onClick={() => handleMetric('contactedCount', -1)} style={{ fontSize: 32, padding: '0 24px', border: '0', borderLeft: '1px solid var(--white-25)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>-</button>
              <input 
                type="number" 
                value={state.contactedCount} 
                onChange={(e) => pushUpdate({ ...state, contactedCount: Math.max(0, parseInt(e.target.value) || 0) })} 
                className="counter-label counter-value" 
                style={{ fontSize: 32, width: 100, border: '0', background: 'transparent', color: 'inherit', textAlign: 'center', fontFamily: 'var(--font)' }} 
              />
              <button type="button" onClick={() => handleMetric('contactedCount', 1)} style={{ fontSize: 32, padding: '0 24px', border: '0', borderLeft: '1px solid var(--white-25)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>+</button>
            </div>

            <div className="counter" style={{ background: 'var(--panel-bg)', display: 'flex', alignItems: 'stretch' }}>
              <div className="counter-label" style={{ fontSize: 24, padding: '0 32px', display: 'flex', alignItems: 'center' }}>Converted</div>
              <button type="button" onClick={() => handleMetric('convertedCount', -1)} style={{ fontSize: 32, padding: '0 24px', border: '0', borderLeft: '1px solid var(--white-25)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>-</button>
              <input 
                type="number" 
                value={state.convertedCount} 
                onChange={(e) => pushUpdate({ ...state, convertedCount: Math.max(0, parseInt(e.target.value) || 0) })} 
                className="counter-label counter-value" 
                style={{ fontSize: 32, width: 100, border: '0', background: 'transparent', color: 'inherit', textAlign: 'center', fontFamily: 'var(--font)' }} 
              />
              <button type="button" onClick={() => handleMetric('convertedCount', 1)} style={{ fontSize: 32, padding: '0 24px', border: '0', borderLeft: '1px solid var(--white-25)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>+</button>
            </div>
         </div>

         {/* Diagnostics Log Panel */}
         <div className="logs-panel" style={{ marginTop: 60, height: 200, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--white-12)', padding: 16, overflowY: 'auto', fontFamily: 'monospace', fontSize: 13, color: 'var(--white-70)' }}>
            <div style={{ marginBottom: 16, color: 'var(--white-92)', borderBottom: '1px solid var(--white-12)', paddingBottom: 8 }}>DIAGNOSTIC LOGS</div>
            {logs.length === 0 ? <div style={{ color: 'var(--white-45)' }}>Waiting for activity...</div> : logs.map((log, i) => (
              <div key={i} style={{ marginBottom: 4 }}>{log}</div>
            ))}
         </div>

      </div>
    </div>
  );
}
