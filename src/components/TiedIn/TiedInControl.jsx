import { useState, useEffect, useRef } from 'react';
import OBSWebSocket from 'obs-websocket-js';
import './TiedInApp.css';

const OBS_WS_URL = "ws://localhost:4455";
const SCENE_WORK = "work";
const SCENE_PLAY = "play";
const SCENE_EXPLAIN = "explain";
const SCENE_BREAK = "break";
const SCENE_STANDBY = "standby";

export default function TiedInControl() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('STREAM_ADMIN_KEY') || '');
  const [obsPassword, setObsPassword] = useState(() => localStorage.getItem('OBS_PASS') || '');
  
  const [inputKey, setInputKey] = useState('');
  const [inputObs, setInputObs] = useState('');
  const [explainTopic, setExplainTopic] = useState('');
  const [selectedGame, setSelectedGame] = useState('Just Playing');
  const [selectedStandby, setSelectedStandby] = useState('Coming Soon');
  
  const [isLocked, setIsLocked] = useState(!adminKey);

  const [state, setState] = useState({
    contactedCount: 0,
    convertedCount: 0,
    mode: 'work',
    accumulatedTodaySeconds: 0,
    modeTimestamp: Date.now(),
    isStreaming: false,
    gameName: 'Just Playing',
    standbySelection: 'Coming Soon',
    streamNumber: 1,
    timestamps: ''
  });

  // Sync selected game to state when dropdown changes
  useEffect(() => {
    if (state.gameName !== selectedGame) {
      setState(s => ({ ...s, gameName: selectedGame }));
    }
  }, [selectedGame, state.gameName]);

  // Sync selected standby to state when dropdown changes
  useEffect(() => {
    if (state.standbySelection !== selectedStandby) {
      setState(s => ({ ...s, standbySelection: selectedStandby }));
    }
  }, [selectedStandby, state.standbySelection]);

  const isSyncingRef = useRef(false);
  const [obsConnected, setObsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const obsRef = useRef(null);
  const stateRef = useRef(state); // Track state for sync interval without dependency

  // Keep stateRef synchronized with current state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Auto-dismiss logs after 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setLogs(prevLogs => prevLogs.filter(log => now - log.timestamp < 10000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
     const currentStart = Number(localStorage.getItem('YT_STREAM_START')); 
     const m = `${formatYTTime(currentStart)} - ${text}`;
     
     setYtMarkers(prev => {
        // Check if the exact same marker already exists (same timestamp and text)
        if (prev.length > 0 && prev[prev.length - 1] === m) return prev;
        const next = [...prev, m];
        localStorage.setItem('YT_MARKERS', JSON.stringify(next));
        return next;
     });
     
     // Also add to timestamps string for database and sync
     setState(s => {
       const currentTimestamps = s.timestamps || '';
       const newTimestamps = currentTimestamps ? `${currentTimestamps}\n${m}` : m;
       const updatedState = { ...s, timestamps: newTimestamps };
       // Push to database without triggering sync loop
       isSyncingRef.current = true;
       fetch('https://tiesin.me/api/stream/metrics', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${adminKey}`
         },
         body: JSON.stringify({
           ...updatedState,
           _skipPushCalc: true
         })
       }).then(res => {
         if (!res.ok) throw new Error(`Server returned ${res.status}`);
         addLog("Timestamp synced to database");
       }).catch(error => {
         addLog(`Timestamp sync error: ${error.message}`);
       }).finally(() => {
         isSyncingRef.current = false;
       });
       return updatedState;
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

   const getPlayMarkerText = (fallbackGame = '') => {
      const trimmed = String(fallbackGame || '').trim();
      return trimmed ? `play - ${trimmed}` : 'play';
   };

   const getStandbyMarkerText = (fallbackSelection = '') => {
      const trimmed = String(fallbackSelection || '').trim();
      return trimmed ? `standby - ${trimmed}` : 'standby';
   };

  const resetMarkers = () => {
    if (window.confirm("Start/Reset stream recording timeline from 00:00?")) {
       const now = Date.now();
       setStreamStart(now);
       localStorage.setItem('YT_STREAM_START', String(now));
       const initial = ["00:00 - Intro"];
       setYtMarkers(initial);
       localStorage.setItem('YT_MARKERS', JSON.stringify(initial));
       setState(s => ({ ...s, timestamps: `STREAM ${s.streamNumber || 1}` }));
    }
  };

  const addLog = (msg) => setLogs(l => [...l, { message: `[${new Date().toLocaleTimeString()}] ${msg}`, timestamp: Date.now() }].slice(-20));

  // State validation function to catch inconsistencies
  const validateState = (s) => {
    const issues = [];
    
    // Validate streaming state consistency
    if (s.isStreaming === true && !s.modeTimestamp) {
      issues.push('Streaming true but no modeTimestamp');
    }
    
    // Validate pause state consistency
    if (s.isPaused === true && s.mode !== 'work') {
      issues.push('Paused true but not in work mode');
    }
    
    if (s.isPaused === true && !s.pausedTimestamp) {
      issues.push('Paused true but no pausedTimestamp');
    }
    
    // Validate accumulated time doesn't go negative
    if (s.accumulatedTodaySeconds < 0) {
      issues.push(`Negative accumulatedTodaySeconds: ${s.accumulatedTodaySeconds}`);
    }
    
    // Validate mode is valid
    const validModes = ['work', 'play', 'break', 'standby', 'explain'];
    if (!validModes.includes(s.mode) && !s.mode.startsWith('explain|')) {
      issues.push(`Invalid mode: ${s.mode}`);
    }
    
    if (issues.length > 0) {
      addLog(`STATE VALIDATION ERROR: ${issues.join(', ')}`);
      console.error('State validation failed:', issues, s);
    }
    
    return issues.length === 0;
  };

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
        
        // Continuously hydrate state from API to avoid stale UI overrides,
        // but temporarily block syncing updates exactly when a manual push is happening
        if (data?.metrics && !isSyncingRef.current) {
           setState(s => { 
              const newState = { 
                ...s, 
                contactedCount: data.metrics.contactedCount ?? s.contactedCount,
                convertedCount: data.metrics.convertedCount ?? s.convertedCount,
                mode: data.metrics.mode || s.mode,
                accumulatedTodaySeconds: data.metrics.accumulatedTodaySeconds ?? s.accumulatedTodaySeconds,
                modeTimestamp: data.metrics.modeTimestamp ?? s.modeTimestamp,
                isStreaming: data.metrics.isStreaming !== undefined ? data.metrics.isStreaming : s.isStreaming,
                gameName: data.metrics.gameName ?? s.gameName,
                standbySelection: data.metrics.standbySelection ?? s.standbySelection,
                timestamps: data.metrics.timestamps ?? s.timestamps,
                streamNumber: data.metrics.streamNumber ?? s.streamNumber,
                // Always update pause state from API to ensure sync
                // The isSyncingRef prevents overwriting during manual pushes
                isPaused: data.metrics.isPaused !== undefined ? data.metrics.isPaused : s.isPaused,
                pausedTimestamp: data.metrics.pausedTimestamp !== undefined ? data.metrics.pausedTimestamp : s.pausedTimestamp
              };
              
              // Validate the new state
              validateState(newState);
              
              return newState;
           });
           // Only sync dropdowns if they're different from current selection
           // This prevents reverting user selections during API polling
           if (data.metrics.gameName && data.metrics.gameName !== selectedGame && data.metrics.gameName !== state.gameName) {
              setSelectedGame(data.metrics.gameName);
           }
           if (data.metrics.standbySelection && data.metrics.standbySelection !== selectedStandby && data.metrics.standbySelection !== state.standbySelection) {
              setSelectedStandby(data.metrics.standbySelection);
           }
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
      } catch {
        // Silently ignore polling errors
      }
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
           const map = { [SCENE_WORK]: "work", [SCENE_PLAY]: "play", [SCENE_EXPLAIN]: "explain", [SCENE_BREAK]: "break", [SCENE_STANDBY]: "standby" };
           const mapped = map[event.sceneName];
           if (mapped) {
             // Verify this is a real scene change, not a duplicate event
             obs.call("GetCurrentProgramScene")
               .then((currentScene) => {
                 if (currentScene.currentProgramSceneName !== event.sceneName) {
                   addLog(`Ignoring duplicate scene event. Current: ${currentScene.currentProgramSceneName}, Event: ${event.sceneName}`);
                   return;
                 }
                 
                 setState(s => {
                   if (s.mode !== mapped) {
                     addLog(`Processing legitimate scene change: ${s.mode} -> ${mapped}`);
                         
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
                     const playText = getPlayMarkerText(selectedGame);
                     const standbyText = getStandbyMarkerText(selectedStandby);
                     addYtMarker(mapped === 'work' ? workText : mapped === 'explain' ? explainText : mapped === 'play' ? playText : mapped === 'break' ? 'break' : standbyText);
                     return newState;
                   }
                   return s;
                 });
               })
               .catch(e => addLog(`Scene verification failed: ${e.message}`));
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
               const currentStreamNumber = (s.streamNumber || 1);
               // Only add stream heading if timestamps is empty (first stream of day)
               const newTimestamps = s.timestamps ? s.timestamps : `STREAM ${currentStreamNumber}`;
               
               const standbyPayload = { 
                  ...s, 
                  mode: "standby", 
                  modeTimestamp: now,
                  isStreaming: true,
                  streamNumber: currentStreamNumber,
                  timestamps: newTimestamps
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
               
               // Add separator line when stream stops
               const newTimestamps = s.timestamps ? `${s.timestamps}\n${'—'.repeat(50)}` : '';
               
               const streamingPayload = {
                  ...s,
                  isStreaming: false,
                  accumulatedTodaySeconds: nextAccumulated,
                  modeTimestamp: Date.now(),
                  timestamps: newTimestamps
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

        // Periodic scene sync verification to catch drift
        const syncInterval = setInterval(async () => {
          if (!keepConnecting || !obsConnected) return;
          
          try {
            const currentScene = await obs.call("GetCurrentProgramScene");
            const sceneName = currentScene.currentProgramSceneName;
            const map = { [SCENE_WORK]: "work", [SCENE_PLAY]: "play", [SCENE_EXPLAIN]: "explain", [SCENE_BREAK]: "break", [SCENE_STANDBY]: "standby" };
            const expectedMode = map[sceneName];
            const currentState = stateRef.current;
            
            if (expectedMode && currentState.mode !== expectedMode) {
              addLog(`Scene drift detected! UI mode: ${currentState.mode}, OBS scene: ${sceneName} (${expectedMode}). Syncing UI to OBS...`);
              
              // Update local state immediately
              setState(s => ({ ...s, mode: expectedMode }));
              
              // Also sync to database to ensure overlay matches
              isSyncingRef.current = true;
              fetch('https://tiesin.me/api/stream/metrics', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${adminKey}`
                },
                body: JSON.stringify({
                  ...currentState,
                  mode: expectedMode,
                  _skipPushCalc: true
                })
              }).then(res => {
                if (!res.ok) throw new Error(`Server returned ${res.status}`);
                addLog("Scene sync corrected in database");
              }).catch(error => {
                addLog(`Scene sync error: ${error.message}`);
              }).finally(() => {
                isSyncingRef.current = false;
              });
            }
          } catch (e) {
            // Silently ignore sync check errors
          }
        }, 5000); // Check every 5 seconds

        // Store sync interval reference for cleanup
        obsRef.current._syncInterval = syncInterval;

      } catch (err) {
        if (!keepConnecting) return;
        addLog(`OBS Connection Error: ${err.message || err.code || err}`);
        setObsConnected(false);
        fallbackConnectTimer = setTimeout(connect, 5000);
      }
    }

    connect();
    
    // Cleanup function
    return () => { 
        keepConnecting = false; 
        clearTimeout(fallbackConnectTimer);
        if (obsRef.current?._syncInterval) {
          clearInterval(obsRef.current._syncInterval);
        }
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

  const pushUpdate = async (newState) => {
    if (!adminKey) return;
    
    // Validate state before pushing
    if (!validateState(newState)) {
      addLog('State validation failed - not pushing to database');
      return;
    }
    
    // Always set isSyncing to prevent loadMetrics from overwriting state during push
    isSyncingRef.current = true;
    
    let payload = { ...newState };

    if (payload.accumulatedTodaySeconds === -1 || payload.todayWorkSeconds === -1) {
       payload.accumulatedTodaySeconds = 0;
       payload.modeTimestamp = Date.now();
       payload.mode = "standby";
       payload.todayWorkSeconds = -1; // Keep for backend trigger just in case
    }
    
    delete payload._skipPushCalc;

    try {
      addLog(`Pushing state update: mode=${payload.mode}, streaming=${payload.isStreaming}, paused=${payload.isPaused}`);
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
        try { errData = await res.json(); } catch {
          // Ignore JSON parse errors
        }
        throw new Error(`Server returned ${res.status}: ${errData?.error || ''} ${errData?.details || ''}`);
      }
      
      addLog("State update synced successfully.");
      setState(payload);
    } catch (e) {
      addLog(`Sync error: ${e.message}`);
      console.error("Failed to sync:", e);
    } finally {
      isSyncingRef.current = false;
    }
  };

  const handleMetric = (key, delta) => {
    pushUpdate({
      ...state,
      [key]: Math.max(0, state[key] + delta)
    });
  };

  const togglePause = () => {
    if (state.mode !== 'work') return;
    
    let nextAccumulated = state.accumulatedTodaySeconds || 0;
    
    if (!state.isPaused) {
      // Pausing: capture elapsed time before pause
      if (state.modeTimestamp) {
        const elapsed = Math.max(0, Math.floor((Date.now() - state.modeTimestamp) / 1000));
        nextAccumulated += elapsed;
      }
      const pauseState = {
        ...state,
        isPaused: true,
        pausedTimestamp: new Date().toISOString(),
        accumulatedTodaySeconds: nextAccumulated,
        modeTimestamp: state.modeTimestamp // Keep original timestamp for resume calculation
      };
      
      addLog('Timer paused - pushing to database...');
      pushUpdate(pauseState);
      addYtMarker('pause');
      
      // Force local state update immediately for UI responsiveness
      setState(pauseState);
    } else {
      // Resuming: reset modeTimestamp to now so elapsed calculation starts fresh
      const resumeState = {
        ...state,
        isPaused: false,
        pausedTimestamp: null,
        modeTimestamp: Date.now()
      };
      
      addLog('Timer resumed - pushing to database...');
      pushUpdate(resumeState);
      addYtMarker('resume');
      
      // Force local state update immediately for UI responsiveness
      setState(resumeState);
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
         try { localStorage.setItem('EXPLAIN_TOPIC', explainTopicTarget); } catch {
           // Ignore localStorage errors
         }
      }

    
    if (state.mode === mode) return;

    let nextAccumulated = state.accumulatedTodaySeconds || 0;
    let nextTimestamp = Date.now();
    
    const isWorkToExplain = (state.mode === 'work' && isExplainTarget);
    const isExplainToWork = (isExplainCurrent && mode === 'work');
    const isWorkToPlay = (state.mode === 'work' && mode === 'play');
    const isPlayToWork = (state.mode === 'play' && mode === 'work');
    const isWorkToStandby = (state.mode === 'work' && mode === 'standby');
    const isStandbyToWork = (state.mode === 'standby' && mode === 'work');
    
    // If paused, don't calculate elapsed time - just keep current accumulated
    if (state.isPaused) {
       nextAccumulated = state.accumulatedTodaySeconds || 0;
       nextTimestamp = state.modeTimestamp || Date.now();
    } else if (isWorkToExplain || isExplainToWork || isWorkToPlay || isPlayToWork || isWorkToStandby || isStandbyToWork) {
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
      gameName: selectedGame,
      standbySelection: selectedStandby,
      timestamps: state.timestamps,
      streamNumber: state.streamNumber,
      _skipPushCalc: true
    };

    if (obsRef.current && obsConnected) {
      const scene = mode === "work" ? SCENE_WORK : isExplainTarget ? SCENE_EXPLAIN : mode === "break" ? SCENE_BREAK : mode === "play" ? SCENE_PLAY : SCENE_STANDBY;
      addLog(`Telling OBS to switch scene to: ${scene}`);
      
      obsRef.current.call("SetCurrentProgramScene", { sceneName: scene })
        .then(() => {
          addLog(`OBS scene changed successfully to: ${scene}`);
          
          // Verify the scene change by checking current scene
          return obsRef.current.call("GetCurrentProgramScene");
        })
        .then((currentScene) => {
          if (currentScene.currentProgramSceneName !== scene) {
            addLog(`WARNING: OBS scene mismatch! Expected: ${scene}, Got: ${currentScene.currentProgramSceneName}`);
            // Force sync to actual OBS state
            const reverseMap = { "work": "work", "play": "play", "explain": "explain", "break": "break", "standby": "standby" };
            const actualMode = reverseMap[currentScene.currentProgramSceneName] || mode;
            if (actualMode !== mode) {
              addLog(`Forcing mode sync to actual OBS state: ${actualMode}`);
              // Update state to match OBS reality
              setState(s => ({ ...s, mode: actualMode }));
            }
          }
          
          // Handle recording based on scene
          if (isExplainTarget) {
            setExplainRecordingName(explainTopicTarget);
            return obsRef.current.call("StartRecord");
          } else if (mode === "standby") {
            return obsRef.current.call("StopRecord");
          }
        })
        .then(() => {
          if (isExplainTarget || mode === "standby") {
            addLog(`Recording ${isExplainTarget ? 'started' : 'stopped'} successfully`);
          }
        })
        .catch(e => {
          addLog(`OBS Scene/Record Error: ${e.message}`);
        });
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
   const playText = getPlayMarkerText(selectedGame);
   const standbyText = getStandbyMarkerText(selectedStandby);
   addYtMarker(mode === 'work' ? workText : isExplainTarget ? explainText : mode === 'play' ? playText : mode === 'break' ? 'break' : standbyText);
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
             <select 
                value={selectedStandby} 
                onChange={e => setSelectedStandby(e.target.value)}
                className="input-full input-pad"
                style={{ cursor: 'pointer' }}
             >
                <option value="Beach">Beach</option>
                <option value="Gym">Gym</option>
                <option value="Lunch">Lunch</option>
                <option value="Dinner">Dinner</option>
                <option value="Coming Soon">Coming Soon</option>
             </select>
             <button className={`mode-btn button-wide ${state.mode === 'standby' ? 'active' : ''}`} onClick={() => setMode('standby')}>Standby</button>
          </div>
          <div className="grid-2 grid-gap-top">
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
             <button className={`mode-btn button-wide ${state.mode === 'play' ? 'active' : ''}`} onClick={() => setMode('play')}>Play</button>
          </div>
       </div>

       {/* Metrics Box */}
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
           {state.mode === 'work' && (
             <div className="side-line panel-row">
                <span className={state.isPaused ? 'paused-text' : ''}>
                  {state.isPaused ? `Paused since ${new Date(state.pausedTimestamp).toLocaleTimeString()}` : 'Active'}
                </span>
                <div className="inline-form">
                  <button 
                    className={`mode-btn button-sm ${state.isPaused ? 'active' : ''}`} 
                    onClick={() => togglePause()}
                  >
                    {state.isPaused ? 'Resume' : 'Pause'}
                  </button>
                </div>
             </div>
           )}
         </div>

       {/* YouTube Markers Box */}
       <div className="context-pill stack panel-grow">
          <div className="side-line panel-row">
             <span>Timestamps</span>
             <div className="inline-form">
                <button className="mode-btn button-sm" onClick={() => addYtMarker(state.mode === 'work' ? workText : state.mode.startsWith('explain') ? getExplainMarkerText(state.mode, explainTopic) : state.mode === 'play' ? getPlayMarkerText(selectedGame) : state.mode === 'standby' ? getStandbyMarkerText(selectedStandby) : state.mode === 'break' ? 'break' : 'standby')}>MARK</button>
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
                 {l.message}
              </div>
           ))}
       </div>

    </main>
    </div>
  );
}
