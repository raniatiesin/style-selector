import { useState, useEffect, useRef, useReducer } from 'react';
import './TiedInApp.css';

// --- CONFIG ---
const OBS_WS_URL = "ws://localhost:4455";
const SCENE_WORK = "Work";
const SCENE_EXPLAIN = "Explain";
const SCENE_BREAK = "Break";
const HOURS_TARGET = 2000;
const CHALLENGE_START = "2026-04-10";
const CHALLENGE_TOTAL_DAYS = 265;
const CANVAS_WIDTH = 1440;
const CONTEXT_WIDTH = 1075.33;

const KEYS = {
  mode: "overlay_mode",
  sessionSeconds: "overlay_session_seconds",
  todaySeconds: "overlay_today_seconds",
  todayDate: "overlay_today_date",
  accumulatedSeconds: "overlay_accumulated_seconds",
  contacted: "overlay_contacted",
  converted: "overlay_converted",
  tasks: "overlay_tasks",
  currentTaskId: "overlay_current_task_id"
};

// --- Helpers ---
function clamp(number, min, max) { return Math.min(max, Math.max(min, number)); }
function pad(value) { return String(value).padStart(2, "0"); }
function formatHMS(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function formatHM(date) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function formatTime12(date) {
  let h = date.getHours();
  const m = pad(date.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
function toLongDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}
function todayKey(date) { return date.toISOString().slice(0, 10); }
function getDayNumber(date) {
  const start = new Date(CHALLENGE_START + "T00:00:00");
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((current - start) / 86400000) + 1;
  return Math.max(1, diffDays);
}
function formatHours(totalSeconds) { return (Math.max(0, totalSeconds) / 3600).toFixed(1); }
function relativeTime(timestamp) {
  const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}
function normalizeTaskStatus(status) {
  if (["done", "waiting", "in_progress", "in_review", "up_next"].includes(status)) return status;       
  return "waiting";
}
function statusLabel(status) {
  if (status === "in_progress") return "IN PROGRESS";
  if (status === "done") return "DONE";
  return "WAITING";
}

// Initial State Loader
function getInitialState() {
  const now = new Date();
  const today = todayKey(now);
  
  let savedDate = localStorage.getItem(KEYS.todayDate);
  let sessionSeconds = Number(localStorage.getItem(KEYS.sessionSeconds)) || 0;
  let todayWorkSeconds = Number(localStorage.getItem(KEYS.todaySeconds)) || 0;

  if (savedDate !== today) {
    sessionSeconds = 0;
    todayWorkSeconds = 0;
    localStorage.setItem(KEYS.todayDate, today);
  }

  let tasks = [];
  try {
    const rawTasks = localStorage.getItem(KEYS.tasks);
    let parsed = rawTasks ? JSON.parse(rawTasks) : [];
    if (!rawTasks || parsed.length === 0) {
       parsed = [
         { id: "mock_1", name: "Create Env", status: "done", createdAt: Date.now() - 3600000 * 4, completedAt: Date.now() - 3600000 * 3 },
         { id: "mock_2", name: "Refactor Main Grid Layout", status: "done", createdAt: Date.now() - 3600000 * 2, completedAt: Date.now() - 3600000 * 1 },
         { id: "mock_3", name: "Deploy DB", status: "in_progress", createdAt: Date.now() - 3600000 * 0.8, completedAt: null }
       ];
       localStorage.setItem(KEYS.currentTaskId, "mock_3");
    }
    tasks = parsed.map(t => ({
      id: String(t.id || ""),
      name: String(t.name || "Untitled task"),
      status: normalizeTaskStatus(t.status),
      createdAt: Number(t.createdAt || Date.now()),
      completedAt: t.completedAt ? Number(t.completedAt) : null
    }));
  } catch (e) {
    console.error("Tasks parse err", e);
  }

  const storedMode = localStorage.getItem(KEYS.mode);
  const mode = ["work", "explain", "break"].includes(storedMode) ? storedMode : "work";

  return {
    mode,
    sessionSeconds,
    todayWorkSeconds,
    accumulatedTotalSeconds: Number(localStorage.getItem(KEYS.accumulatedSeconds)) || 0,
    contactedCount: Number(localStorage.getItem(KEYS.contacted)) || 0,
    convertedCount: Number(localStorage.getItem(KEYS.converted)) || 0,
    tasks,
    currentTaskId: localStorage.getItem(KEYS.currentTaskId) || null,
    breakStartTime: mode === "break" ? Date.now() : null,
    streamStartDate: today
  };
}

export default function TiedInApp({ displayMode }) {
  const [state, setState] = useState(getInitialState);
  const [now, setNow] = useState(new Date());

  // --- Core Timer ---
  useEffect(() => {
    const interval = setInterval(() => {
      const currentNow = new Date();
      setNow(currentNow);

      setState(prev => {
        let { mode, sessionSeconds, todayWorkSeconds, accumulatedTotalSeconds } = prev;
        
        const dateKey = todayKey(currentNow);
        if (localStorage.getItem(KEYS.todayDate) !== dateKey) {
          todayWorkSeconds = 0;
          sessionSeconds = 0;
          localStorage.setItem(KEYS.todayDate, dateKey);
        }
        
        if (mode !== "break") {
          sessionSeconds++;
          todayWorkSeconds++;
          accumulatedTotalSeconds++;
        }
        return { ...prev, sessionSeconds, todayWorkSeconds, accumulatedTotalSeconds };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Save Loop ---
  useEffect(() => {
    localStorage.setItem(KEYS.mode, state.mode);
    localStorage.setItem(KEYS.sessionSeconds, String(state.sessionSeconds));
    localStorage.setItem(KEYS.todaySeconds, String(state.todayWorkSeconds));
    localStorage.setItem(KEYS.accumulatedSeconds, String(state.accumulatedTotalSeconds));
    localStorage.setItem(KEYS.contacted, String(state.contactedCount));
    localStorage.setItem(KEYS.converted, String(state.convertedCount));
    localStorage.setItem(KEYS.currentTaskId, state.currentTaskId || "");
    localStorage.setItem(KEYS.tasks, JSON.stringify(state.tasks));

    // If we transition into break mode, push the finalized time to the cloud    
    // so we don't drop accumulated time in the DB.
    if (state.mode === 'break') {
      const adminKey = localStorage.getItem('STREAM_ADMIN_KEY');
      if (adminKey) {
        fetch('https://tiesin.me/api/stream/metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminKey}`
          },
          body: JSON.stringify({
            todayWorkSeconds: state.todayWorkSeconds,
            accumulatedTotalSeconds: state.accumulatedTotalSeconds
          })
        }).catch(() => {});
      }
    }
  }, [state]);

  // --- Vercel Polling ---
  useEffect(() => {
    let pollingInterval;

    async function fetchKanbanState() {
      try {
        const response = await fetch("https://tiesin.me/api/stream/state");
        if (!response.ok) return;

        const stateData = await response.json();
        let newStateProps = {};

        // Sync global metrics from the new `/control` panel
        if (stateData?.metrics) {
           newStateProps.contactedCount = Number(stateData.metrics.contactedCount) || 0;
           newStateProps.convertedCount = Number(stateData.metrics.convertedCount) || 0;

           if (stateData.metrics.mode) {
              const fetchedMode = stateData.metrics.mode;
              newStateProps.mode = fetchedMode;
           }
        }

        if (stateData?.tasks && Array.isArray(stateData.tasks)) {
          setState(prev => {
            let tasks = [...prev.tasks];
            let currentTaskId = prev.currentTaskId;
            let changed = false;

            stateData.tasks.forEach(data => {
              if (!data.id || !data.name) return;

              const safeInputStatus = String(data.status || "waiting").toLowerCase();
              let mappedStatus = "waiting";
              if (safeInputStatus === "in progress" || safeInputStatus === "in_progress") mappedStatus = "in_progress";
              else if (safeInputStatus.includes("done") || safeInputStatus.includes("completed")) mappedStatus = "done";
              else if (safeInputStatus.includes("next")) mappedStatus = "up_next";
              else if (safeInputStatus.includes("review")) mappedStatus = "in_review";

              const taskId = String(data.id);

              let existingIdx = tasks.findIndex(t => t.id === taskId);
              
              if (existingIdx !== -1) {
                let existing = tasks[existingIdx];
                const dCreatedAt = Number(data.createdAt);
                const dCompletedAt = data.completedAt ? Number(data.completedAt) : null;
                
                if (
                  existing.name !== data.name || 
                  existing.status !== mappedStatus || 
                  (dCreatedAt && existing.createdAt !== dCreatedAt) ||
                  (dCompletedAt && existing.completedAt !== dCompletedAt)
                ) {
                  changed = true;
                  let updated = { 
                    ...existing, 
                    name: data.name, 
                    status: mappedStatus,
                    createdAt: dCreatedAt || existing.createdAt,
                    completedAt: dCompletedAt || existing.completedAt
                  };
                  if (mappedStatus === "done" && !updated.completedAt) updated.completedAt = Date.now();
                  tasks[existingIdx] = updated;
                }
              } else {
                changed = true;
                tasks.unshift({
                  id: taskId,
                  name: String(data.name).trim(),
                  status: mappedStatus,
                  createdAt: Number(data.createdAt) || Date.now(),
                  completedAt: data.completedAt ? Number(data.completedAt) : (mappedStatus === "done" ? Date.now() : null)
                });
              }

              if (mappedStatus === "in_progress") {
                currentTaskId = taskId;
                changed = true;
              } else if (mappedStatus === "done" && currentTaskId === taskId) {
                currentTaskId = null;
                changed = true;
              }
            });

            const merged = { ...prev };
            let hasNewProps = Object.keys(newStateProps).length > 0;
            
            if (hasNewProps) {
              if (newStateProps.contactedCount !== prev.contactedCount) { merged.contactedCount = newStateProps.contactedCount; changed = true; }
              if (newStateProps.convertedCount !== prev.convertedCount) { merged.convertedCount = newStateProps.convertedCount; changed = true; }
              if (newStateProps.mode && newStateProps.mode !== prev.mode) { 
                merged.mode = newStateProps.mode; 
                // We should also adjust break/session start times if mode changed
                merged.breakStartTime = newStateProps.mode === "break" ? Date.now() : prev.breakStartTime;
                merged.sessionSeconds = (prev.mode === "break" && newStateProps.mode !== "break") ? 0 : prev.sessionSeconds;
                changed = true; 
              }
            }

            return changed ? { ...merged, tasks, currentTaskId } : prev;      
          });
        }
      } catch (e) {
        console.error("Vercel Poll failed", e);
      }
    }

    fetchKanbanState();
    pollingInterval = setInterval(fetchKanbanState, 1500); // 1.5s snappy sync
    return () => clearInterval(pollingInterval);
  }, []);

  // --- Render Mappings ---
  const progress = clamp(state.todayWorkSeconds / (7 * 3600), 0, 1);
  const dayNumber = getDayNumber(now);
  const hours = formatHours(state.accumulatedTotalSeconds);
  const breakSeconds = state.mode === "break" && state.breakStartTime
          ? Math.max(0, Math.floor((Date.now() - state.breakStartTime) / 1000))
          : 0;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const inProgressTasks = state.tasks.filter(t => t.status === "in_progress").sort((a, b) => b.createdAt - a.createdAt);
  const inProgressIds = new Set(inProgressTasks.map(t => t.id));

  const inReviewTasks = state.tasks.filter(t => t.status === "in_review" && !inProgressIds.has(t.id)).sort((a, b) => b.createdAt - a.createdAt);
  const upNextTasks = state.tasks.filter(t => t.status === "up_next" && !inProgressIds.has(t.id)).sort((a, b) => b.createdAt - a.createdAt);

  const doneTasks = state.tasks.filter(t => t.status === "done" && !inProgressIds.has(t.id))
      .filter(t => (t.completedAt || t.createdAt) >= startOfToday)
      .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));

  const waitingTasks = state.tasks.filter(t => t.status === "waiting" && !inProgressIds.has(t.id))
      .sort((a, b) => a.createdAt - b.createdAt);

  const displayTasks = [];
  displayTasks.push(...waitingTasks);
  displayTasks.push(...upNextTasks);
  displayTasks.push(...inProgressTasks);
  displayTasks.push(...inReviewTasks);
  displayTasks.push(...doneTasks);

  return (
    <div className={`overlay-root mode-${displayMode || state.mode}`}>
      
      <div className="obs-frame frame-display" aria-hidden="true"></div>
      <div className="obs-frame frame-webcam" aria-hidden="true"></div>

      <section className="zone-top">
        <aside className="timeline" id="timeline">
          <div className="timeline-list">
             {displayTasks.map(task => {
                const isCurrent = inProgressIds.has(task.id);
                const pillClass = isCurrent ? "tl-pill current" : "tl-pill done";
                const metaClass = isCurrent ? "tl-meta current" : "tl-meta done";
                const when = task.status === "done" ? (task.completedAt || task.createdAt) : task.createdAt;
                
                let statusStr = "waiting";
                if (task.status === "in_progress") statusStr = "in progress";
                else if (task.status === "in_review") statusStr = "in review";
                else if (task.status === "up_next") statusStr = "up next";
                else if (task.status === "done") statusStr = "done";
                
                let timeStr = "";
                if (task.status === "in_progress") timeStr = "started " + relativeTime(task.createdAt);
                else if (task.status === "done" || task.status === "in_review") timeStr = "finished " + relativeTime(when);
                else timeStr = "added " + relativeTime(task.createdAt);

                return (
                  <div key={task.id} className="tl-item">
                    <div className={pillClass}>
                      <div className="tl-title">{task.name}</div>
                      <div className={metaClass}>&#9679;&nbsp;&nbsp;{statusStr} &middot; {timeStr}</div>
                    </div>
                  </div>
                )
             })}
          </div>
        </aside>
      </section>

      <section className="context-shell" id="contextShell" aria-label="Work and explain context panel">
        <div className="context-panel">
          <div className="hero-col">
            <div className="context-pill stack hero-timer-pill">
              <div className="today-time">{formatHMS(state.todayWorkSeconds)}</div>
              <div className="session-line">
                <span className="session-label">since last break</span>
                <span>{formatHMS(state.sessionSeconds)}</span>
              </div>
            </div>
            <div className="context-pill hero-pill">
              <div className="side-line">Day {dayNumber} - {hours}/{HOURS_TARGET} Hours Accumulated</div>
            </div>
          </div>
          <div className="side-col">
            <div className="context-pill stack">
              <div className="side-line">{(now.getMonth() + 1) + "/" + now.getDate() + "/" + now.getFullYear()}</div>
              <div className="side-line">{now.toLocaleDateString("en-US", { weekday: "short" })} - {formatTime12(now)}</div>
            </div>
            <div className="context-pill stack">
              <div className="side-line">Contacted: {state.contactedCount}</div>
              <div className="side-line">Converted: {state.convertedCount}</div>
            </div>
          </div>
          <div className="webcam-col"></div>
        </div>
      </section>

      <section className="progress-strip" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${(progress * CONTEXT_WIDTH).toFixed(2)}px` }}></div>
      </section>

      <section className="break-screen" id="breakScreen" style={{ display: (displayMode || state.mode) === 'break' ? 'flex' : 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', position: 'absolute', inset: 0, zIndex: 100 }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px' }}>
            <div style={{ fontSize: '200px', fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--white-100)', whiteSpace: 'nowrap' }}>
              WILL BE BACK
            </div>
            <div style={{ fontSize: '220px', fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--white-100)', fontFamily: 'monospace' }}>     
              {formatHMS(breakSeconds)}
            </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '32px', color: 'var(--white-75)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {formatTime12(now)}
            </div>
            <div style={{ fontSize: '20px', color: 'var(--white-45)', letterSpacing: '0.02em' }}>
              {toLongDate(now)}
            </div>
          </div>

          <div style={{ width: '60px', height: '2px', background: 'var(--white-25)' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '14px', letterSpacing: '0.2em', color: 'var(--white-45)', textTransform: 'uppercase' }}>To Continue</div>
            {state.tasks.filter(t => t.status === "in_progress").length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {state.tasks.filter(t => t.status === "in_progress").map(t => (
                  <div key={t.id} style={{ fontSize: '24px', color: 'var(--white-92)', fontWeight: 400 }}>
                     {t.name}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '20px', color: 'var(--white-25)', fontStyle: 'italic' }}>Enjoy your break</div>
            )}
          </div>

        </div>
      </section>
    </div>
  );
}