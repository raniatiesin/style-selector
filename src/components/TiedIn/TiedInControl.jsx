import { useState, useEffect, useRef } from 'react';
import OBSWebSocket from 'obs-websocket-js';
import './TiedInApp.css';

const OBS_WS_URL = "ws://localhost:4455";
const SCENE_WORK = "work";
const SCENE_PLAY = "play";
const SCENE_EXPLAIN = "explain";
const SCENE_BREAK = "break";
const SCENE_STANDBY = "standby";
const SCENE_MINECRAFT = "minecraft";

export default function TiedInControl() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('STREAM_ADMIN_KEY') || '');
  const [obsPassword, setObsPassword] = useState(() => localStorage.getItem('OBS_PASS') || '');
  
  const [inputKey, setInputKey] = useState('');
  const [inputObs, setInputObs] = useState('');
  const [explainTopic, setExplainTopic] = useState('');
  const [gameTimeInput, setGameTimeInput] = useState('');
  const [isSubmittingGame, setIsSubmittingGame] = useState(false);
  const [selectedGame, setSelectedGame] = useState('Just Playing');
  
  const [isLocked, setIsLocked] = useState(!adminKey);

  const [state, setState] = useState({
    contactedCount: 0,
    convertedCount: 0,
    mode: 'work',
    accumulatedTodaySeconds: 0,
    modeTimestamp: Date.now(),
    isStreaming: false,
    gameName: 'Just Playing'
  });

  const isSyncingRef = useRef(false);
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

   const getExplainMarkerText = (modeValue, fallbackTopic = '') => {
      const raw = String(modeValue || '');
      if (raw.startsWith('explain|')) {
         const topic = raw.split('|').slice(1).join('|').trim();
         return topic ? `explain - ${topic}` : 'explain';
      }
      const trimmed = String(fallbackTopic || '').trim();
      return trimmed ? `explain - ${trimmed}` : 'explain';
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

   const sanitizeFilenamePart = (value) => value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
   const formatExplainRecordingName = (topic) => {
      const safeTopic = sanitizeFilenamePart(topic) || 'Explain';
      return `%CCYY-%MM-%DD - %hh%mm - ${safeTopic}`;
   };
   const setExplainRecordingName = (topic) => {
      if (!obsRef.current || !obsConnected) return;
      const filenameFormat = formatExplainRecordingName(topic);
      obsRef.current.call("SetRecordFilenameFormat", { filenameFormat })
         .catch(e => addLog(`SetRecordFilenameFormat failed: ${e.message}`));
   };

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
        if (data?.metrics && !isSyncingRef.current) {
           setState(s => ({ 
              ...s, 
              contactedCount: data.metrics.contactedCount ?? s.contactedCount,
              convertedCount: data.metrics.convertedCount ?? s.convertedCount,
              mode: data.metrics.mode || s.mode,
              accumulatedTodaySeconds: data.metrics.accumulatedTodaySeconds ?? s.accumulatedTodaySeconds,
              modeTimestamp: data.metrics.modeTimestamp ?? s.modeTimestamp,
              isStreaming: data.metrics.isStreaming ?? s.isStreaming,
              gameName: data.metrics.gameName ?? s.gameName
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
  }, [isLocked]); // Removed isSyncing to prevent interval reset on push

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
           const map = { [SCENE_WORK]: "work", [SCENE_PLAY]: "play", [SCENE_EXPLAIN]: "explain", [SCENE_BREAK]: "break", [SCENE_STANDBY]: "standby", [SCENE_MINECRAFT]: "minecraft" };
           const mapped = map[event.sceneName];
           if (mapped) {
             setState(s => {
               if (s.mode !== mapped) {
                         if (mapped === "explain") {
                            const topic = (s.mode.startsWith('explain|') ? s.mode.split('|').slice(1).join('|') : explainTopic).trim();
                            if (topic) setExplainRecordingName(topic);
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
                 const isWorkToPlay = (s.mode === 'work' && mapped === 'play');
                 const isPlayToWork = (s.mode === 'play' && mapped === 'work');

                 if (isWorkToExplain || isExplainToWork || isWorkToPlay || isPlayToWork) {
                    nextAccumulated = s.accumulatedTodaySeconds || 0;
                    nextTimestamp = s.modeTimestamp || Date.now();
                 } else if (s.mode === 'work' || s.mode === 'play') {
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
                    _skipPushCalc: true,
                    isStreaming: s.isStreaming
                 };

                 pushUpdate(newState);
                 const hasTask = activeTaskRef.current && activeTaskRef.current !== "INITIAL_LOAD_FLAG";
                 const workText = hasTask ? `work - ${activeTaskRef.current}` : 'work';
                 const explainText = getExplainMarkerText(s.mode, explainTopic);
                 addYtMarker(mapped === 'work' ? workText : mapped === 'explain' ? explainText : mapped === 'play' ? 'play' : mapped === 'break' ? 'break' : mapped === 'minecraft' ? 'minecraft' : 'standby');
                 return newState;
               }
               return s;
             });
           }
        });

        obs.on("StreamStateChanged", (event) => {
          addLog(`StreamStateChanged event - outputActive: ${event.outputActive}`);
          if (event.outputActive) {
            addLog("OBS Stream Started! Resetting setup...");
            
            const now = Date.now();
            setStreamStart(now);
            localStorage.setItem('YT_STREAM_START', String(now));
            const initial = ["00:00 - Stream Started"];
            setYtMarkers(initial);
            localStorage.setItem('YT_MARKERS', JSON.stringify(initial));

            obs.call("SetCurrentProgramScene", { sceneName: SCENE_STANDBY }).catch(e => addLog(`Scene err: ${e.message}`));

            setState(s => {
               // Switch to standby and update timestamp, but DO NOT reset accumulated time.
               // This preserves today's already-tracked work/play seconds across multiple stream sessions.
               const standbyPayload = { 
                  ...s, 
                  mode: "standby", 
                  modeTimestamp: now,
                  isStreaming: true
               };
               addLog(`Setting isStreaming to true, pushing update...`);
               pushUpdate(standbyPayload);
               return s;
            });
          } else {
            addLog("OBS Stream Stopped!");
            setState(s => {
               // When stream stops, capture any elapsed work/play time and add to accumulated
               let nextAccumulated = s.accumulatedTodaySeconds || 0;
               if ((s.mode === 'work' || s.mode === 'play') && s.modeTimestamp) {
                  const elapsed = Math.max(0, Math.floor((Date.now() - s.modeTimestamp) / 1000));
                  nextAccumulated += elapsed;
                  addLog(`Captured ${elapsed} seconds of elapsed time on stream stop`);
               }
               
               const streamingPayload = {
                  ...s,
                  isStreaming: false,
                  accumulatedTodaySeconds: nextAccumulated,
                  modeTimestamp: Date.now()
               };
               addLog(`Setting isStreaming to false, pushing update...`);
               pushUpdate(streamingPayload);
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
    // Always set isSyncing to prevent loadMetrics from overwriting state during push
    isSyncingRef.current = true;
    setIsSyncing(true);
    
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
      setState(payload);
    } catch (e) {
      addLog(`Sync error: ${e.message}`);
      console.error("Failed to sync:", e);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  const handleMetric = (key, delta) => {
    pushUpdate({
      ...state,
      [key]: Math.max(0, state[key] + delta)
    });
  };

  const submitGameTime = async () => {
    const raw = gameTimeInput.trim();
    if (!raw) return;
    // Parse MM:SS — digits only, auto-format as minutes:seconds
    // e.g. "1148" → 11 min 48 sec → (11*60 + 48) * 1000 = 708000ms
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 3) {
      addLog("Type at least 3 digits (e.g. 1148 for 11:48)");
      return;
    }
    const secPart = parseInt(digits.slice(-2), 10);
    const minPart = parseInt(digits.slice(0, -2), 10);
    if (secPart > 59) {
      addLog("Seconds must be ≤ 59");
      return;
    }
    const totalSec = minPart * 60 + secPart;
    if (totalSec <= 0) {
      addLog("Time must be > 0");
      return;
    }
    const ms = totalSec * 1000;
    const displayStr = `${String(minPart).padStart(2, '0')}:${String(secPart).padStart(2, '0')}`;

    setIsSubmittingGame(true);
    try {
      const res = await fetch('https://tiesin.me/api/stream/minecraft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`
        },
        body: JSON.stringify({ timePlayedMs: ms })
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      addLog(`Game recorded: ${displayStr} (${ms}ms)`);
      setGameTimeInput('');
    } catch (e) {
      addLog(`Game submit error: ${e.message}`);
    } finally {
      setIsSubmittingGame(false);
    }
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
    const isExplainTarget = mode.startsWith('explain');
    const isExplainCurrent = state.mode.startsWith('explain');
      const explainTopicTarget = isExplainTarget ? mode.split('|').slice(1).join('|').trim() : '';

      if (isExplainTarget && !explainTopicTarget) {
         alert('Please enter an explain topic before switching to Explain mode.');
         return;
      }

      if (isExplainTarget) {
         try { localStorage.setItem('EXPLAIN_TOPIC', explainTopicTarget); } catch {}
      }

    
    if (state.mode === mode) return;

    let nextAccumulated = state.accumulatedTodaySeconds || 0;
    let nextTimestamp = Date.now();
    
    const isWorkToExplain = (state.mode === 'work' && isExplainTarget);
    const isExplainToWork = (isExplainCurrent && mode === 'work');
    const isWorkToPlay = (state.mode === 'work' && mode === 'play');
    const isPlayToWork = (state.mode === 'play' && mode === 'work');
    
    if (isWorkToExplain || isExplainToWork || isWorkToPlay || isPlayToWork) {
       nextAccumulated = state.accumulatedTodaySeconds || 0;
       nextTimestamp = state.modeTimestamp || Date.now();
    } else if (state.mode === 'work' || state.mode === 'play') {
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
      gameName: mode === 'play' ? selectedGame : state.gameName,
      _skipPushCalc: true
    };

    if (obsRef.current && obsConnected) {
      addLog(`Telling OBS to switch scene to: ${isExplainTarget ? 'explain' : mode}`);
      const scene = mode === "work" ? SCENE_WORK : isExplainTarget ? SCENE_EXPLAIN : mode === "break" ? SCENE_BREAK : mode === "minecraft" ? SCENE_MINECRAFT : mode === "play" ? SCENE_PLAY : SCENE_STANDBY;
      obsRef.current.call("SetCurrentProgramScene", { sceneName: scene }).catch(e => {
         addLog(`OBS Scene Change Error: ${e.message}`);
      });

         if (isExplainTarget) {
            setExplainRecordingName(explainTopicTarget);
        obsRef.current.call("StartRecord").catch(e => addLog(`obs err: ${e.message}`));
      } else if (mode === "standby") {
        obsRef.current.call("StopRecord").catch(e => addLog(`obs err: ${e.message}`));
      }
    }

   // pushUpdate will now always update local state and set isSyncing
   // Ensure we don't accidentally carry reset sentinel flags (-1) from other flows
   const sanitizedState = { ...newState };
   if (sanitizedState.todayWorkSeconds === -1) delete sanitizedState.todayWorkSeconds;
   if (sanitizedState.accumulatedTodaySeconds === -1) sanitizedState.accumulatedTodaySeconds = 0;
   pushUpdate(sanitizedState);
    
    const hasTask = activeTaskRef.current && activeTaskRef.current !== "INITIAL_LOAD_FLAG";
    const workText = hasTask ? `work - ${activeTaskRef.current}` : 'work';
   const explainText = getExplainMarkerText(mode, explainTopicTarget);
   addYtMarker(mode === 'work' ? workText : isExplainTarget ? explainText : mode === 'play' ? 'play' : mode === 'break' ? 'break' : mode === 'minecraft' ? 'minecraft' : 'standby');
   };

   if (isLocked) {
      return (
         <div className="dashboard-login">
            <div className="login-box overlay-root">
               <h2 className="login-title">TiedIn Control Panel</h2>
               <form onSubmit={saveAdminKey} className="form-stack">
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
                  <button type="submit" className="button-tight">UNCLOCK</button>
               </form>
            </div>
         </div>
      );
   }

  const workText = activeTaskRef.current && activeTaskRef.current !== "INITIAL_LOAD_FLAG" ? `work - ${activeTaskRef.current}` : 'work';

   return (
      <div className="dashboard-shell" style={{ minHeight: '100dvh', width: '100%', background: '#000000' }}>
         <main className="overlay-root no-scrollbar control-panel">

       {/* Header Box */}
       <div className="context-pill stack">
          <div className="side-line panel-header">
             <span>TiedIn Control</span>
             <span className={`panel-status ${obsConnected ? 'connected' : 'disconnected'}`}>
                <span className="status-dot">●</span>
                {obsConnected ? 'Connected' : 'Disconnected'}
             </span>
          </div>
       </div>

       {/* Mode Panel */}
       <div className="context-pill stack">
          <div className="grid-2 grid-gap-bottom">
             <button className={`mode-btn button-wide ${state.mode === 'work' ? 'active' : ''}`} onClick={() => setMode('work')}>Work</button>
             <button className={`mode-btn button-wide ${state.mode === 'break' ? 'active' : ''}`} onClick={() => setMode('break')}>Break</button>
          </div>
          <div className="grid-2">
             <input type="text" placeholder="what are you explaining?" value={explainTopic} onChange={e => setExplainTopic(e.target.value)} className="input-full input-pad" />
             <button className={`mode-btn button-wide ${state.mode.startsWith('explain') ? 'active' : ''}`} onClick={() => setMode('explain|' + explainTopic.trim())}>Explain</button>
          </div>
          <div className="grid-2 grid-gap-top">
             <button className={`mode-btn button-wide ${state.mode === 'standby' ? 'active' : ''}`} onClick={() => setMode('standby')}>Standby</button>
             <button className={`mode-btn button-wide ${state.mode === 'play' ? 'active' : ''}`} onClick={() => setMode('play')}>Play</button>
          </div>
          <div className="grid-1 grid-gap-top">
             <select 
                value={selectedGame} 
                onChange={e => setSelectedGame(e.target.value)}
                className="input-full input-pad"
                style={{ cursor: 'pointer' }}
             >
                <option value="Just Playing">Just Playing</option>
                <option value="Red Dead Redemption">Red Dead Redemption</option>
                <option value="Sons of the Forest">Sons of the Forest</option>
                <option value="Minecraft">Minecraft</option>
             </select>
          </div>
          <div className="grid-1 grid-gap-top">
             <button className={`mode-btn button-wide ${state.mode === 'minecraft' ? 'active' : ''}`} onClick={() => setMode('minecraft')}>Minecraft</button>
          </div>
       </div>

       {/* Metrics Box — switches to game time input when in Play mode */}
       {state.mode === 'minecraft' ? (
         <div className="context-pill stack">
           <div className="side-line panel-row" style={{ marginBottom: '8px' }}>
             <span>Record Game Time</span>
           </div>
           <div className="side-line panel-row">
             <input
               type="text"
               inputMode="numeric"
               maxLength={5}
               placeholder="MM:SS"
               value={(() => {
                 const d = gameTimeInput.replace(/\D/g, '');
                 if (!d) return '';
                 if (d.length <= 2) return d;
                 return `${d.slice(0, -2)}:${d.slice(-2)}`;
               })()}
               onChange={e => {
                 const raw = e.target.value;
                 // If user deleted the colon, just store the cleaned digits
                 const cleaned = raw.replace(/[^0-9]/g, '').slice(0, 4);
                 setGameTimeInput(cleaned);
               }}
               onKeyDown={e => { if (e.key === 'Enter') submitGameTime(); }}
               className="input-full input-pad"
               style={{ width: '160px', fontSize: '24px', padding: '10px 16px', letterSpacing: '0.15em', fontVariantNumeric: 'tabular-nums' }}
             />
             <button
               className="mode-btn button-sm"
               onClick={submitGameTime}
               disabled={isSubmittingGame || !gameTimeInput.trim()}
               style={{ minWidth: '80px', fontSize: '16px', padding: '10px 16px' }}
             >
               {isSubmittingGame ? '...' : 'ADD'}
             </button>
           </div>
         </div>
       ) : (
         <div className="context-pill stack">
           <div className="side-line panel-row">
              <span>Projects: {state.contactedCount}</span>
             <div className="inline-form">
               <button className="mode-btn button-xs" onClick={() => handleMetric('contactedCount', -1)}>-</button>
               <button className="mode-btn button-xs" onClick={() => handleMetric('contactedCount', 1)}>+</button>
             </div>
           </div>
           <div className="side-line panel-row">
              <span>Contacts: {state.convertedCount}</span>
             <div className="inline-form">
               <button className="mode-btn button-xs" onClick={() => handleMetric('convertedCount', -1)}>-</button>
               <button className="mode-btn button-xs" onClick={() => handleMetric('convertedCount', 1)}>+</button>
             </div>
           </div>
         </div>
       )}

       {/* YouTube Markers Box */}
       <div className="context-pill stack panel-grow">
          <div className="side-line panel-row">
             <span>Timestamps</span>
             <div className="inline-form">
                <button className="mode-btn button-sm" onClick={() => addYtMarker(state.mode === 'work' ? workText : state.mode.startsWith('explain') ? getExplainMarkerText(state.mode, explainTopic) : state.mode === 'play' ? 'play' : state.mode === 'break' ? 'break' : state.mode === 'minecraft' ? 'minecraft' : 'standby')}>MARK</button>
                <button className="mode-btn button-sm" onClick={resetMarkers}>CLEAR</button>
             </div>
          </div>
          {streamStart && (
             <div className="side-line yt-live">
                Live: {formatYTTime(streamStart)}
             </div>
          )}
          {ytMarkers.length === 0 ? <div className="side-line yt-empty">No markers yet</div> : null}
          <textarea
             readOnly
             value={ytMarkers.join('\n')}
             className="yt-textarea"
          />
       </div>

       {/* Action Buttons Box */}
       <div className="context-pill stack">
          <div className="grid-1">
             <button onClick={resetDay} className="mode-btn button-wide danger">Reset Overlay Clocks</button>
             <button onClick={logout} className="mode-btn button-wide">Disconnect & Lock</button>
          </div>
       </div>

       {/* Floating Logs */}
       <div className="floating-logs">
           {logs.map((l, i) => (
              <div key={i} className="floating-log">
                 {l}
              </div>
           ))}
       </div>

    </main>
    </div>
  );
}
