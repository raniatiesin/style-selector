import { useState, useEffect, useRef } from 'react';
import OBSWebSocket from 'obs-websocket-js';
import { API } from '../../config/api';
import { 
  formatYTTime, 
  sanitizeFilenamePart, 
  getLocalStorageItem, 
  setLocalStorageItem,
  getLocalStorageJSON,
  setLocalStorageJSON
} from './utils';
import { 
  OBS_CONFIG, 
  STORAGE_KEYS,
  LOG_CONFIG 
} from './constants';
import './GrossGauntletApp.css';

export default function GrossGauntletControl() {
  const [adminKey, setAdminKey] = useState(() => getLocalStorageItem(STORAGE_KEYS.STREAM_ADMIN_KEY, ''));
  const [obsPassword, setObsPassword] = useState(() => getLocalStorageItem(STORAGE_KEYS.OBS_PASS, ''));
  
  const [inputKey, setInputKey] = useState('');
  const [inputObs, setInputObs] = useState('');
  const [explainTopic, setExplainTopic] = useState('');
  const [selectedStandby, setSelectedStandby] = useState('Coming Soon');
  
  const [streamUrl, setStreamUrl] = useState('');
  const [isLocked, setIsLocked] = useState(!adminKey);

  const [state, setState] = useState({
    contentCount: 0,
    salesCount: 0,
    mode: 'work',
    accumulatedTodaySeconds: 0,
    lastBreakEndTimestamp: Date.now(),
    modeTimestamp: Date.now(),
    isStreaming: false,
    standbySelection: 'Coming Soon',
    streamNumber: 1,
    sessionNumber: 1,
    title: '',
    timestamps: '',
    alphaGross: 0,
    totalGross: 0
  });

  // Sync selected standby to state when dropdown changes
  useEffect(() => {
    if (state.standbySelection !== selectedStandby) {
      setState(s => ({ ...s, standbySelection: selectedStandby }));
    }
  }, [selectedStandby, state.standbySelection]);

  const obsSceneChangeRef = useRef(false); // Track OBS-initiated scene changes
  const uiSceneChangeRef = useRef(false); // Set by setMode() before calling SetCurrentProgramScene
  const [obsConnected, setObsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const obsRef = useRef(null);
  const stateRef = useRef(state); // Track state for sync interval without dependency

  // Keep stateRef synchronized with current state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Auto-dismiss logs after configured time
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setLogs(prevLogs => prevLogs.filter(log => now - log.timestamp < LOG_CONFIG.AUTO_DISMISS_MS));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- YouTube Markers ---
  const [ytMarkers, setYtMarkers] = useState(() => getLocalStorageJSON(STORAGE_KEYS.YT_MARKERS, []));
  const [streamStart, setStreamStart] = useState(() => Number(getLocalStorageItem(STORAGE_KEYS.YT_STREAM_START, '0')) || null);
  const activeTaskRef = useRef("INITIAL_LOAD_FLAG");

  const addYtMarker = (text) => {
     const currentStart = Number(getLocalStorageItem(STORAGE_KEYS.YT_STREAM_START, '0')); 
     const m = `${formatYTTime(currentStart)} - ${text}`;
     
     setYtMarkers(prev => {
        // Check if the exact same marker already exists (same timestamp and text)
        if (prev.length > 0 && prev[prev.length - 1] === m) return prev;
        const next = [...prev, m];
        setLocalStorageJSON(STORAGE_KEYS.YT_MARKERS, next);
        return next;
     });
     
     // Also add to timestamps string for database and sync (no side effects inside setState)
     const s = stateRef.current;
     const currentTimestamps = s.timestamps || '';
     const newTimestamps = currentTimestamps ? `${currentTimestamps}\n${m}` : m;
// Guard: skip if last line of timestamps equals new marker (prevents duplicates like double break/standby)
      const lastLine = currentTimestamps.split('\n').filter(Boolean).pop() || '';
      if (lastLine === m) return;
     const updatedState = { ...s, timestamps: newTimestamps };
     setState(updatedState);
     
     // Only persist the timestamps field. Never send accumulatedTodaySeconds or
     // other timer fields here — a stale value would overwrite the authoritative total.
     fetch(API.postMetrics(), {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${adminKey}`
       },
       body: JSON.stringify({
         timestamps: newTimestamps,
         _skipPushCalc: true
       })
     }).then(res => {
       if (!res.ok) throw new Error(`Server returned ${res.status}`);
       addLog("Timestamp synced to database");
     }).catch(error => {
       addLog(`Timestamp sync error: ${error.message}`);
     }).finally(() => {
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

   const getStandbyMarkerText = (fallbackSelection = '') => {
      const trimmed = String(fallbackSelection || '').trim();
      return trimmed ? `standby - ${trimmed}` : 'standby';
   };

  const resetMarkers = () => {
    if (window.confirm("Start/Reset stream recording timeline from 00:00?")) {
       const now = Date.now();
       setStreamStart(now);
       setLocalStorageItem(STORAGE_KEYS.YT_STREAM_START, String(now));
       const initial = ["00:00 - Intro"];
       setYtMarkers(initial);
       setLocalStorageJSON(STORAGE_KEYS.YT_MARKERS, initial);
       setState(s => ({ ...s, timestamps: `STREAM ${s.streamNumber || 1}` }));
    }
  };

  const addLog = (msg) => setLogs(l => [...l, { message: `[${new Date().toLocaleTimeString()}] ${msg}`, timestamp: Date.now() }].slice(-LOG_CONFIG.MAX_LOGS));

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
    
    // Validate accumulated time doesn't go negative (except -1 which is a reset sentinel)
    if (s.accumulatedTodaySeconds < 0 && s.accumulatedTodaySeconds !== -1) {
      issues.push(`Negative accumulatedTodaySeconds: ${s.accumulatedTodaySeconds}`);
    }
    
    // Validate mode is valid
    const validModes = ['work', 'break', 'standby', 'explain'];
    if (!validModes.includes(s.mode) && !s.mode.startsWith('explain|')) {
      issues.push(`Invalid mode: ${s.mode}`);
    }
    
    // Validate timestamp is reasonable (not in the future, not too old)
    if (s.modeTimestamp && s.modeTimestamp > Date.now() + 60000) {
      issues.push(`modeTimestamp is in the future: ${s.modeTimestamp}`);
    }
    
    if (issues.length > 0) {
      addLog(`STATE VALIDATION ERROR: ${issues.join(', ')}`);
      console.error('State validation failed:', issues, s);
    }
    
    return issues.length === 0;
  };

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
        const res = await fetch(API.getStreamState());
        if (!res.ok) return;
        const data = await res.json();
        
        // Continuously hydrate state from API to avoid stale UI overrides,
        // but temporarily block syncing updates exactly when a manual push is happening
        if (data?.metrics) {
           setState(s => { 
              // Check if state actually changed to prevent unnecessary re-renders
              const metricsChanged = (
                (data.metrics.contentCount !== undefined && data.metrics.contentCount !== s.contentCount) ||
                (data.metrics.salesCount !== undefined && data.metrics.salesCount !== s.salesCount) ||
                (data.metrics.mode && data.metrics.mode !== s.mode) ||
                (data.metrics.accumulatedTodaySeconds !== undefined && data.metrics.accumulatedTodaySeconds !== s.accumulatedTodaySeconds) ||
                (data.metrics.modeTimestamp !== undefined && data.metrics.modeTimestamp !== s.modeTimestamp) ||
                (data.metrics.isStreaming !== undefined && data.metrics.isStreaming !== s.isStreaming) ||
                (data.metrics.isPaused !== undefined && data.metrics.isPaused !== s.isPaused) ||
                (data.metrics.alphaGross !== undefined && data.metrics.alphaGross !== s.alphaGross) ||
                (data.metrics.totalGross !== undefined && data.metrics.totalGross !== s.totalGross)
              );
              
              if (!metricsChanged) {
                return s; // No change needed
              }
              
              const newState = { 
                ...s, 
                contentCount: data.metrics.contentCount ?? data.metrics.contactedCount ?? s.contentCount,
                salesCount: data.metrics.salesCount ?? data.metrics.convertedCount ?? s.salesCount,
                mode: data.metrics.mode || s.mode,
                accumulatedTodaySeconds: (s.isStreaming && s.mode === 'work')
                  ? s.accumulatedTodaySeconds
                  : (data.metrics.accumulatedTodaySeconds ?? s.accumulatedTodaySeconds),
                modeTimestamp: (s.isStreaming && s.mode === 'work')
                  ? s.modeTimestamp
                  : (data.metrics.modeTimestamp ?? s.modeTimestamp),
                isStreaming: data.metrics.isStreaming !== undefined ? data.metrics.isStreaming : s.isStreaming,
                standbySelection: data.metrics.standbySelection ?? s.standbySelection,
                timestamps: data.metrics.timestamps ?? s.timestamps,
                streamNumber: data.metrics.streamNumber ?? data.metrics.sessionNumber ?? s.streamNumber,
                sessionNumber: data.metrics.sessionNumber ?? data.metrics.streamNumber ?? s.sessionNumber,
                title: data.metrics.title !== undefined ? data.metrics.title : s.title,
                isPaused: data.metrics.isPaused !== undefined ? data.metrics.isPaused : s.isPaused,
                pausedTimestamp: data.metrics.pausedTimestamp !== undefined ? data.metrics.pausedTimestamp : s.pausedTimestamp,
                alphaGross: data.metrics.alphaGross !== undefined ? data.metrics.alphaGross : s.alphaGross,
                totalGross: data.metrics.totalGross !== undefined ? data.metrics.totalGross : s.totalGross
              };
              
              // Validate the new state
              validateState(newState);
              
              return newState;
           });
           // Only sync dropdowns if they're different from current selection
           // This prevents reverting user selections during API polling
           if (data.metrics.standbySelection && data.metrics.standbySelection !== selectedStandby && data.metrics.standbySelection !== state.standbySelection) {
              setSelectedStandby(data.metrics.standbySelection);
           }
        }

        if (data?.tasks && Array.isArray(data.tasks)) {
           const activeTask = data.tasks.find(t => t.status === 'in_progress' || t.status === 'in progress');
           const taskName = activeTask ? activeTask.name : null;
           if (taskName && activeTaskRef.current !== taskName) {
              if (activeTaskRef.current !== "INITIAL_LOAD_FLAG" && stateRef.current.mode === 'work') {
                 addYtMarker(`work - ${taskName}`);
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
        addLog(`Attempting OBS WS connection to ${OBS_CONFIG.WS_URL}...`);
        await obs.connect(OBS_CONFIG.WS_URL, obsPassword);
        if (!keepConnecting) {
           obs.disconnect();
           return;
        }
        addLog("OBS Connected successfully!");
        setObsConnected(true);

        obs.on("CurrentProgramSceneChanged", (event) => {
           addLog(`OBS Scene changed to: ${event.sceneName}`);
           const map = { [OBS_CONFIG.SCENES.WORK]: "work", [OBS_CONFIG.SCENES.EXPLAIN]: "explain", [OBS_CONFIG.SCENES.BREAK]: "break", [OBS_CONFIG.SCENES.STANDBY]: "standby" };
           const mapped = map[event.sceneName];
           if (!mapped) return;

           // Mark this as a scene change being processed (used by drift-sync to avoid fighting)
           obsSceneChangeRef.current = true;

           // Verify this is a real scene change, not a duplicate event
           obs.call("GetCurrentProgramScene")
             .then((currentScene) => {
               if (currentScene.currentProgramSceneName !== event.sceneName) {
                 addLog(`Ignoring duplicate scene event. Current: ${currentScene.currentProgramSceneName}, Event: ${event.sceneName}`);
                 obsSceneChangeRef.current = false;
                 return;
               }

               const s = stateRef.current;
               if (s.mode === mapped) {
                 obsSceneChangeRef.current = false;
                 return;
               }

               addLog(`Processing legitimate scene change: ${s.mode} -> ${mapped}`);

               // UI-triggered: setMode() already folded elapsed, pushed the correct state,
               // and dispatched the instant-update event. We only need to keep the local
               // React "mode" in sync. Do NOT fold elapsed again and do NOT push/dispatch
               // a conflicting (stale) event.
               if (uiSceneChangeRef.current) {
                 uiSceneChangeRef.current = false;
                 addLog(`Skipping elapsed capture — scene change originated from setMode()`);
                 setState(prev => ({ ...prev, mode: mapped }));
                 setTimeout(() => { obsSceneChangeRef.current = false; }, 1000);
                 return;
               }

               // OBS-initiated change: run the full elapsed-capture logic.
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

               const isExplainToWork = (s.mode === 'explain' && mapped === 'work');
                const isBreakToWork = (s.mode === 'break' && mapped === 'work');
                const isStandbyToWork = (s.mode === 'standby' && mapped === 'work');
                const isWorkToExplain = (s.mode === 'work' && mapped === 'explain');
                const isWorkToStandby = (s.mode === 'work' && mapped === 'standby');
               
               if (isWorkToExplain || isWorkToStandby) {
                  // Exiting work: capture elapsed, add to accumulated, reset timestamp
                  if (s.modeTimestamp) {
                     const elapsed = Math.max(0, Math.floor((Date.now() - s.modeTimestamp) / 1000));
                     nextAccumulated = (s.accumulatedTodaySeconds || 0) + elapsed;
                  }
                  nextTimestamp = Date.now();
               } else if (isExplainToWork || isBreakToWork || isStandbyToWork) {
                  // Entering work: keep accumulated unchanged, reset timestamp
                  nextAccumulated = s.accumulatedTodaySeconds || 0;
                  nextTimestamp = Date.now();
               } else if (s.mode === 'work') {
                  if (s.modeTimestamp) {
                     const elapsed = Math.max(0, Math.floor((Date.now() - s.modeTimestamp) / 1000));
                     nextAccumulated += elapsed;
                  }
                  nextTimestamp = Date.now();
               }

               const newState = {
                  ...s,
                  mode: mapped,
                  accumulatedTodaySeconds: nextAccumulated,
                  lastBreakEndTimestamp: (isBreakToWork || isStandbyToWork) ? Date.now() : (s.lastBreakEndTimestamp || Date.now()),
                  modeTimestamp: nextTimestamp,
                  isStreaming: s.isStreaming
               };

               pushUpdate(newState);

               const hasTask = activeTaskRef.current && activeTaskRef.current !== "INITIAL_LOAD_FLAG";
               const workText = hasTask ? `work - ${activeTaskRef.current}` : 'work';
               const explainText = getExplainMarkerText(s.mode, explainTopic);
               const standbyText = getStandbyMarkerText(selectedStandby);
               addYtMarker(mapped === 'work' ? workText : mapped === 'explain' ? explainText : mapped === 'break' ? 'break' : standbyText);

               // Clear the flag after a short delay to allow subsequent changes
               setTimeout(() => { obsSceneChangeRef.current = false; }, 1000);
             })
             .catch(e => {
               addLog(`Scene verification failed: ${e.message}`);
               obsSceneChangeRef.current = false;
             });
        });

        obs.on("StreamStateChanged", async (event) => {
          addLog(`StreamStateChanged event - outputActive: ${event.outputActive}`);
          const s = stateRef.current;

          if (event.outputActive) {
            addLog("OBS Stream Started! Resetting setup...");

            const now = Date.now();
            setStreamStart(now);
            localStorage.setItem('YT_STREAM_START', String(now));
            const initial = ["00:00 - Stream Started"];
            setYtMarkers(initial);
            localStorage.setItem('YT_MARKERS', JSON.stringify(initial));

            obs.call("SetCurrentProgramScene", { sceneName: OBS_CONFIG.SCENES.STANDBY }).catch(e => addLog(`Scene err: ${e.message}`));

            // Fetch OBS stream title on stream start
            let obsTitle = null;
            try {
              const streamSettings = await obs.call('GetStreamServiceSettings').catch(() => null);
              obsTitle = streamSettings?.streamServiceSettings?.server
                ?? await obs.call('GetProfileParameter', {
                     parameterCategory: 'Info',
                     parameterName: 'Name'
                   }).catch(() => null);
            } catch (err) {
              // fallback
            }

            const currentSessionNumber = (s.sessionNumber || s.streamNumber || 1);
            const dayNumber = Math.max(1, Math.floor((Date.now() - new Date('2026-08-15').getTime()) / (1000 * 60 * 60 * 24)) + 1);
            const title = obsTitle || s.title || `Day ${dayNumber} — Session ${currentSessionNumber}`;
            const newTimestamps = s.timestamps ? s.timestamps : `STREAM ${currentSessionNumber}`;

            const standbyPayload = {
               ...s,
               mode: "standby",
               lastBreakEndTimestamp: now,
               modeTimestamp: now,
               sessionStartTimestamp: s.session_start_timestamp || now,
               isStreaming: true,
               streamNumber: currentSessionNumber,
               sessionNumber: currentSessionNumber,
               title: title,
               timestamps: newTimestamps
            };
            addLog(`Setting isStreaming to true (Title: "${title}"), pushing update...`);
            pushUpdate(standbyPayload);
          } else {
            addLog("OBS Stream Stopped!");

            // When stream stops, fold any elapsed work time into accumulated
            let nextAccumulated = s.accumulatedTodaySeconds || 0;
            if (s.mode === 'work' && s.modeTimestamp) {
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
          
          // Skip sync if we just processed an OBS scene change (prevents fighting with user changes)
          if (obsSceneChangeRef.current) return;
          
          try {
            const currentScene = await obs.call("GetCurrentProgramScene");
            const sceneName = currentScene.currentProgramSceneName;
            const map = { [OBS_CONFIG.SCENES.WORK]: "work", [OBS_CONFIG.SCENES.EXPLAIN]: "explain", [OBS_CONFIG.SCENES.BREAK]: "break", [OBS_CONFIG.SCENES.STANDBY]: "standby" };
            const expectedMode = map[sceneName];
            const currentState = stateRef.current;
            
            if (expectedMode && currentState.mode !== expectedMode) {
              addLog(`Scene drift detected! UI mode: ${currentState.mode}, OBS scene: ${sceneName} (${expectedMode}). Syncing UI to OBS...`);
              
              // Update local state immediately
              setState(s => ({ ...s, mode: expectedMode }));
              
              // Also sync to database to ensure overlay matches.
              // Only persist the mode field — never timer fields (avoids resetting total).
              fetch(API.postMetrics(), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${adminKey}`
                },
                body: JSON.stringify({
                  mode: expectedMode,
                  _skipPushCalc: true
                })
              }).then(res => {
                if (!res.ok) throw new Error(`Server returned ${res.status}`);
                addLog("Scene sync corrected in database");
              }).catch(error => {
                addLog(`Scene sync error: ${error.message}`);
              }).finally(() => {
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
      localStorage.setItem(STORAGE_KEYS.GROSSGAUNTLET_UNLOCKED, 'true');
      setAdminKey(inputKey.trim());
      setObsPassword(inputObs.trim());
      setIsLocked(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('STREAM_ADMIN_KEY');
    localStorage.removeItem('OBS_PASS');
    localStorage.removeItem(STORAGE_KEYS.GROSSGAUNTLET_UNLOCKED);
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
    
    // Check if state actually changed to prevent unnecessary updates
    const currentState = stateRef.current;
    const stateChanged = JSON.stringify(newState) !== JSON.stringify(currentState);
    if (!stateChanged) {
      addLog('State unchanged - skipping database update');
      return;
    }
    
    let payload = { ...newState };

    // Fold live work elapsed into accumulatedTodaySeconds before persisting.
    // This guarantees the authoritative today total never shrinks when a
    // non-mode-changing action (metric +/-, title blur, etc.) pushes stale
    // accumulated state. It is re-entrant safe:
    //   - pause sets isPaused=true  -> skipped (already folded)
    //   - work->break/explain/standby sets a non-work mode -> skipped (already folded)
    //   - enter work sets modeTimestamp=now -> adds ~0
    //   - stream stop sets isStreaming=false -> skipped (already folded)
    if (payload.mode === 'work' && payload.isStreaming && !payload.isPaused && payload.modeTimestamp) {
       const elapsed = Math.max(0, Math.floor((Date.now() - payload.modeTimestamp) / 1000));
       payload.accumulatedTodaySeconds = (payload.accumulatedTodaySeconds || 0) + elapsed;
       payload.modeTimestamp = Date.now();
    }

    if (payload.accumulatedTodaySeconds === -1) {
       payload.accumulatedTodaySeconds = 0;
       payload.modeTimestamp = Date.now();
       payload.mode = "standby";
    }
    
    // Ensure lastBreakEndTimestamp is always in payload
    if (!('lastBreakEndTimestamp' in payload)) {
      payload.lastBreakEndTimestamp = stateRef.current.lastBreakEndTimestamp ?? Date.now();
    }
    
    delete payload._skipPushCalc;

    try {
      addLog(`Pushing state update: mode=${payload.mode}, streaming=${payload.isStreaming}, paused=${payload.isPaused}`);
      const res = await fetch(API.postMetrics(), {
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
      // Only update local state if it's different from current
      setState(current => {
        const newStr = JSON.stringify(payload);
        const currentStr = JSON.stringify(current);
        return newStr !== currentStr ? payload : current;
      });
      
    } catch (e) {
      addLog(`Sync error: ${e.message}`);
      console.error("Failed to sync:", e);
    }
  };

  const handleMetric = (key, delta) => {
    const current = stateRef.current;
    pushUpdate({
      ...current,
      [key]: Math.max(0, current[key] + delta)
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
         accumulatedTodaySeconds: -1, // Triggers reset in pushUpdate
         modeTimestamp: Date.now(),
         contentCount: 0, 
         salesCount: 0 
      });
    }
  };

  const setMode = (mode) => {
    const current = stateRef.current;
    const isExplainTarget = mode.startsWith('explain');
    const isExplainCurrent = current.mode.startsWith('explain');
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

    
    if (current.mode === mode) return;

    let nextAccumulated = current.accumulatedTodaySeconds || 0;
    let nextTimestamp = Date.now();
    
    const isWorkToExplain = (current.mode === 'work' && isExplainTarget);
    const isExplainToWork = (isExplainCurrent && mode === 'work');
    const isWorkToStandby = (current.mode === 'work' && mode === 'standby');
    const isStandbyToWork = (current.mode === 'standby' && mode === 'work');
    const isBreakToWork = (current.mode === 'break' && mode === 'work');
    
    // If paused, don't calculate elapsed time - just keep current accumulated
    // But always reset modeTimestamp when entering break (stale paused timestamp would break the break timer)
    if (current.isPaused) {
       nextAccumulated = current.accumulatedTodaySeconds || 0;
       nextTimestamp = mode === 'break' ? Date.now() : (current.modeTimestamp || Date.now());
    } else if (isWorkToExplain || isWorkToStandby) {
       // Exiting work: capture elapsed, add to accumulated, reset timestamp
       if (current.modeTimestamp) {
          const elapsed = Math.max(0, Math.floor((Date.now() - current.modeTimestamp) / 1000));
          nextAccumulated = (current.accumulatedTodaySeconds || 0) + elapsed;
       }
       nextTimestamp = Date.now();
    } else if (isExplainToWork || isStandbyToWork || isBreakToWork) {
       // Entering work: keep accumulated unchanged, reset timestamp
       nextAccumulated = current.accumulatedTodaySeconds || 0;
       nextTimestamp = Date.now();
    } else if (current.mode === 'work') {
       if (current.modeTimestamp) {
          const elapsed = Math.max(0, Math.floor((Date.now() - current.modeTimestamp) / 1000));
          nextAccumulated += elapsed;
       }
    }
    
    const newState = {
      ...current,
      mode,
      accumulatedTodaySeconds: nextAccumulated,
      lastBreakEndTimestamp: (isBreakToWork || isStandbyToWork) ? Date.now() : current.lastBreakEndTimestamp,
      modeTimestamp: nextTimestamp,
      standbySelection: selectedStandby,
      timestamps: current.timestamps,
      streamNumber: current.streamNumber,
      _skipPushCalc: true
    };

    if (obsRef.current && obsConnected) {
      // Skip OBS scene change if this was triggered by OBS itself (prevents circular updates)
      if (obsSceneChangeRef.current) {
        addLog(`Skipping OBS scene change (originated from OBS)`);
        obsSceneChangeRef.current = false;
      } else {
        // Set flag so CurrentProgramSceneChanged handler knows this came from UI
        uiSceneChangeRef.current = true;
        // Safety: clear the flag if the OBS scene event never fires (e.g. already on that scene)
        setTimeout(() => { uiSceneChangeRef.current = false; }, 2000);
        const scene = mode === "work" ? OBS_CONFIG.SCENES.WORK : isExplainTarget ? OBS_CONFIG.SCENES.EXPLAIN : mode === "break" ? OBS_CONFIG.SCENES.BREAK : OBS_CONFIG.SCENES.STANDBY;
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
              const reverseMap = { "work": "work", "explain": "explain", "break": "break", "standby": "standby" };
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
    }

   // pushUpdate will now always update local state and set isSyncing
   // Ensure we don't accidentally carry reset sentinel flags (-1) from other flows
   const sanitizedState = { ...newState };
   if (sanitizedState.accumulatedTodaySeconds === -1) sanitizedState.accumulatedTodaySeconds = 0;
   pushUpdate(sanitizedState);
    
    const hasTask = activeTaskRef.current && activeTaskRef.current !== "INITIAL_LOAD_FLAG";
    const workText = hasTask ? `work - ${activeTaskRef.current}` : 'work';
   const explainText = getExplainMarkerText(mode, explainTopicTarget);
   const standbyText = getStandbyMarkerText(selectedStandby);
   addYtMarker(mode === 'work' ? workText : isExplainTarget ? explainText : mode === 'break' ? 'break' : standbyText);
   };

   if (isLocked) {
      return (
         <div className="dashboard-login">
            <div className="login-box overlay-root">
               <h2 className="login-title">GrossGauntlet Control Panel</h2>
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

  const toggleStream = () => {
    const s = stateRef.current;
    if (s.isStreaming) {
      let nextAccumulated = s.accumulatedTodaySeconds || 0;
      if (s.mode === 'work' && s.modeTimestamp) {
        const elapsed = Math.max(0, Math.floor((Date.now() - s.modeTimestamp) / 1000));
        nextAccumulated += elapsed;
      }
      const newTimestamps = s.timestamps ? `${s.timestamps}\n${'—'.repeat(50)}` : '';
      const stopPayload = {
        ...s,
        isStreaming: false,
        accumulatedTodaySeconds: nextAccumulated,
        modeTimestamp: Date.now(),
        timestamps: newTimestamps
      };
      addLog("Manual stream stop — pushing update...");
      pushUpdate(stopPayload);
    } else {
      const now = Date.now();
      const currentSessionNumber = (s.sessionNumber || s.streamNumber || 1);
      const newTimestamps = s.timestamps || `STREAM ${currentSessionNumber}`;
      const startPayload = {
        ...s,
        mode: s.mode || "standby",
        lastBreakEndTimestamp: now,
        modeTimestamp: now,
        sessionStartTimestamp: s.session_start_timestamp || now,
        isStreaming: true,
        streamNumber: currentSessionNumber,
        sessionNumber: currentSessionNumber,
        timestamps: newTimestamps
      };
      addLog("Manual stream start — pushing update...");
      pushUpdate(startPayload);
    }
  };

  async function handleSaveStreamUrl() {
    if (!streamUrl.trim()) return;
    try {
      const res = await fetch(API.postMetrics(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminKey}`
        },
        body: JSON.stringify({ streamUrl: streamUrl.trim() })
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      addLog("YouTube link saved.");
    } catch (err) {
      addLog(`YouTube link save error: ${err.message}`);
    }
  }

   return (
      <div className="dashboard-shell" style={{ minHeight: '100dvh', width: '100%', background: '#000000' }}>
         <main className="overlay-root no-scrollbar control-panel">

       {/* Header Box */}
       <div className="context-pill stack">
          <div className="side-line panel-header">
             <span>GrossGauntlet Control</span>
             <span className={`panel-status ${obsConnected ? 'connected' : 'disconnected'}`}>
                <span className="status-dot">●</span>
                {obsConnected ? 'Connected' : 'Disconnected'}
             </span>
          </div>
          <div className="grid-gap-top">
             <input
                type="text"
                placeholder="Session Title (e.g. Day 1 — Session 1)"
                value={state.title || ''}
                onChange={e => {
                   const newTitle = e.target.value;
                   setState(s => ({ ...s, title: newTitle }));
                }}
                onBlur={() => {
                   pushUpdate({ ...stateRef.current, title: state.title });
                }}
                className="input-full input-pad"
             />
          </div>
<div className="grid-2 grid-gap-top">
              <button
                 className={`mode-btn button-wide ${state.isStreaming ? 'active' : ''}`}
                 onClick={toggleStream}
                 style={state.isStreaming ? { borderColor: '#ff4444', color: '#ff4444' } : { borderColor: '#4DAA57', color: '#4DAA57' }}
              >
                 {state.isStreaming ? 'END STREAM' : 'GO LIVE'}
              </button>
              <span></span>
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
       </div>

       {/* YouTube Markers Box */}
       <div className="context-pill stack panel-grow">
         <div className="side-line panel-row">
            <span>Timestamps</span>
            <div className="inline-form">
               <button className="mode-btn button-sm" onClick={() => addYtMarker(state.mode === 'work' ? workText : state.mode.startsWith('explain') ? getExplainMarkerText(state.mode, explainTopic) : state.mode === 'standby' ? getStandbyMarkerText(selectedStandby) : state.mode === 'break' ? 'break' : 'standby')}>MARK</button>
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
            value={ytMarkers.join('\n')}
            onChange={(e) => {
               const newMarkers = e.target.value.split('\n').filter(line => line.trim() !== '');
               setYtMarkers(newMarkers);
               localStorage.setItem('YT_MARKERS', JSON.stringify(newMarkers));
               
               // Also update the timestamps string for database sync (no side effects inside setState)
               const s = stateRef.current;
               const newTimestamps = newMarkers.join('\n');
               const updatedState = { ...s, timestamps: newTimestamps };
               setState(updatedState);
               
               // Only persist the timestamps field. Never send timer fields here.
               fetch(API.postMetrics(), {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                   'Authorization': `Bearer ${adminKey}`
                 },
                 body: JSON.stringify({
                   timestamps: newTimestamps,
                   _skipPushCalc: true
                 })
               }).then(res => {
                 if (!res.ok) throw new Error(`Server returned ${res.status}`);
               }).catch(error => {
                 addLog(`Timestamp sync error: ${error.message}`);
               }).finally(() => {
               });
            }}
            className="yt-textarea"
         />
       </div>

       {/* Metrics Box */}
       <div className="context-pill stack">
         <div className="side-line panel-row">
            <span>CONTENT: {state.contentCount}</span>
           <div className="inline-form">
             <button className="mode-btn button-xs" onClick={() => handleMetric('contentCount', -1)}>-</button>
               <button className="mode-btn button-xs" onClick={() => handleMetric('contentCount', 1)}>+</button>
             </div>
           </div>
           <div className="side-line panel-row">
              <span>SALES: {state.salesCount}</span>
             <div className="inline-form">
               <button className="mode-btn button-xs" onClick={() => handleMetric('salesCount', -1)}>-</button>
               <button className="mode-btn button-xs" onClick={() => handleMetric('salesCount', 1)}>+</button>
             </div>
           </div>
           <div className="side-line panel-row">
              <span>ALPHA $: {state.alphaGross}</span>
             <div className="inline-form">
               <input
                 type="number"
                 min="0"
                 step="0.01"
                 value={state.alphaGross}
                 onChange={e => {
                   const val = Math.max(0, parseFloat(e.target.value) || 0);
                   setState(s => ({ ...s, alphaGross: val }));
                 }}
                 onBlur={() => {
                   pushUpdate({ ...stateRef.current, alphaGross: state.alphaGross });
                 }}
                 className="input-xs input-pad"
                 style={{ width: 80, textAlign: 'right' }}
               />
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

       {/* Action Buttons Box */}
       <div className="context-pill stack">
          <div className="grid-1">
             <button onClick={resetDay} className="mode-btn button-wide danger">Reset Overlay Clocks</button>
             <button onClick={logout} className="mode-btn button-wide">Disconnect & Lock</button>
          </div>
       </div>

       {/* YouTube VOD Link */}
       <div className="context-pill stack">
          <div className="side-line panel-row">
             <span>YOUTUBE LINK</span>
          </div>
          <div className="grid-2">
             <input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={streamUrl}
                onChange={e => setStreamUrl(e.target.value)}
                className="input-full input-pad"
             />
             <button
                className="mode-btn button-wide"
                onClick={handleSaveStreamUrl}
             >
                Save
             </button>
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
