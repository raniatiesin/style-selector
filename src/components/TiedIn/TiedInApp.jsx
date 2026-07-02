/* eslint-disable react-hooks/refs, react-hooks/exhaustive-deps */

import { useState, useEffect, useRef } from 'react';
import './TiedInApp.css?v=20260529o';

const HOURS_TARGET = 1000;
const CONTEXT_WIDTH = 1075.33;
const EXPLAIN_TOPIC_KEY = 'EXPLAIN_TOPIC';
const MINECRAFT_OVERLAY_VERSION = 'mc-overlay-v2';
const MINECRAFT_API_URL = import.meta.env.VITE_MINECRAFT_API_URL?.trim() || '';

function clamp(number, min, max) { return Math.min(max, Math.max(min, number)); }
function pad(value) { return String(value).padStart(2, "0"); }
function formatHMS(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function formatTime12(date) {
  let h = date.getHours();
  const m = pad(date.getMinutes());
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
function formatMillis(ms) {
  const safe = Math.max(0, Number(ms) || 0);
  if (!safe) return "--:--";
  const totalSeconds = Math.floor(safe / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function toLongDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
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

export default function TiedInApp({ displayMode }) {
  // Purely data-driven state for UI lists (tasks, counts)
  const [tasks, setTasks] = useState([]);
  const [counts, setCounts] = useState({ contacted: 0, converted: 0 });
  const [minecraftStats, setMinecraftStats] = useState({
    today: { totalGames: 0, bestTimeMs: null, totalPlaytimeMs: 0 },
    totality: { totalGames: 0, bestTimeMs: null, totalPlaytimeMs: 0 }
  });
  const [modeReact, setModeReact] = useState("standby"); // for changing class names

  // Refs for requestAnimationFrame clock updates
  const timerRefs = {
    todayTime: useRef(null),
    sessionTime: useRef(null),
    mcSessionTime: useRef(null),
    mcProgressFill: useRef(null),
    dayHoursTrack: useRef(null),
    nowDateMain: useRef(null),
    nowTimeMain: useRef(null),
    progressFill: useRef(null),
    breakTime: useRef(null),
    nowTimeBreak: useRef(null),
    nowDateBreak: useRef(null),
    nowTimeStandby: useRef(null),
    nowDateStandby: useRef(null),
    explainDate: useRef(null),
    explainDay: useRef(null),
    explainTime: useRef(null),
    explainAccumulated: useRef(null),
    explainTopicText: useRef(null),
    gameName1: useRef(null),
    gameName2: useRef(null),
    standbyTitle: useRef(null)
  };

  // Mutable source of truth for the animation loop
  const liveStateRef = useRef({
    mode: "standby",
    accumulatedTodaySeconds: 0,
    modeTimestamp: 0,
    previousDaysSeconds: 0,
    totalDays: 1,
    explainTopic: "",
    isStreaming: false,
    gameName: "Just Playing",
    standbySelection: "Coming Soon",
    playTopic: "",
    standbyTopic: ""
  });

  // Ref for the timeline list container to enable scroll-to-in-progress
  const timelineListRef = useRef(null);

  // Scroll to the first in_progress task whenever tasks change
  useEffect(() => {
    const container = timelineListRef.current;
    if (!container) return;
    const firstInProgress = container.querySelector('.tl-item.in_progress');
    if (firstInProgress) {
      firstInProgress.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      // If nothing in progress, scroll to top
      container.scrollTop = 0;
    }
  }, [tasks]);

  const getStoredExplainTopic = () => {
    try { return localStorage.getItem(EXPLAIN_TOPIC_KEY) || ""; }
    catch { return ""; }
  };

  const setStoredExplainTopic = (topic) => {
    try { localStorage.setItem(EXPLAIN_TOPIC_KEY, topic); } catch { return; }
  };

  // Animation Loop - Updates DOM directly
  useEffect(() => {
    let frame;
    function tick() {
      const nowMs = Date.now();
      const d = new Date(nowMs);
      const ls = liveStateRef.current;
      
      const isWorking = ls.mode === 'work';
      const isPlay = ls.mode === 'play';
      const isBreak = ls.mode === 'break';
      const isMinecraft = ls.mode === 'minecraft';
      const isStreaming = ls.isStreaming ?? false;
      
      let todaySecs = ls.accumulatedTodaySeconds || 0;
      let sessionSecs = 0;
      let breakSecs = 0;
      let mcSessionSecs = 0;
      
      if (isStreaming && (isWorking || isPlay)) {
        const elapsed = Math.floor(Math.max(0, nowMs - ls.modeTimestamp) / 1000);
        todaySecs += elapsed;
        sessionSecs = elapsed;
      } else if (isBreak) {
        breakSecs = Math.floor(Math.max(0, nowMs - ls.modeTimestamp) / 1000);
      } else if (isMinecraft) {
        mcSessionSecs = Math.floor(Math.max(0, nowMs - ls.modeTimestamp) / 1000);
      }
      
      if (timerRefs.todayTime.current) timerRefs.todayTime.current.innerText = formatHMS(todaySecs);
      if (timerRefs.sessionTime.current) timerRefs.sessionTime.current.innerText = formatHMS(sessionSecs);
      if (timerRefs.breakTime.current) timerRefs.breakTime.current.innerText = formatHMS(breakSecs);
      if (timerRefs.mcSessionTime.current) timerRefs.mcSessionTime.current.innerText = formatHMS(mcSessionSecs);
      
      if (timerRefs.mcProgressFill.current) {
        let mcProgress = mcSessionSecs / 3600; // reaches end at 1 hour
        if (mcProgress > 1) mcProgress = 1;
        timerRefs.mcProgressFill.current.style.width = `${(mcProgress * 100).toFixed(2)}%`;
      }
      
      const time12 = formatTime12(d);
      const ldate = toLongDate(d);
      const shortDate = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
      const weekdayShort = d.toLocaleDateString("en-US", { weekday: "short" });
      const sideDate = `${weekdayShort} - ${time12}`;

      if (timerRefs.nowTimeMain.current) timerRefs.nowTimeMain.current.innerText = sideDate;
      if (timerRefs.nowDateMain.current) timerRefs.nowDateMain.current.innerText = shortDate;
      
      if (timerRefs.nowTimeBreak.current) timerRefs.nowTimeBreak.current.innerText = time12;
      if (timerRefs.nowDateBreak.current) timerRefs.nowDateBreak.current.innerText = ldate;
      
      if (timerRefs.nowTimeStandby.current) timerRefs.nowTimeStandby.current.innerText = time12;
      if (timerRefs.nowDateStandby.current) timerRefs.nowDateStandby.current.innerText = ldate;

      if (timerRefs.explainDate.current) timerRefs.explainDate.current.innerText = shortDate;
      if (timerRefs.explainDay.current) timerRefs.explainDay.current.innerText = `Day ${ls.totalDays || 1}`;
      if (timerRefs.explainTime.current) timerRefs.explainTime.current.innerText = sideDate;

      const progressVal = clamp(todaySecs / (10 * 3600), 0, 1);
      if (timerRefs.progressFill.current) {
        timerRefs.progressFill.current.style.width = `${(progressVal * CONTEXT_WIDTH).toFixed(2)}px`;
      }

      const accumulatedTotalSeconds = (ls.previousDaysSeconds || 0) + todaySecs;
      const hoursString = `Day ${ls.totalDays || 1} - ${formatHours(accumulatedTotalSeconds)}/${HOURS_TARGET} Hours Accumulated`;
      
      // Update the hours track for work/standby modes
      if (timerRefs.dayHoursTrack.current) {
        if (isPlay) {
          // Show game name instead of accumulated hours in play mode
          timerRefs.dayHoursTrack.current.innerText = ls.gameName || "Just Playing";
        } else {
          timerRefs.dayHoursTrack.current.innerText = hoursString;
        }
      }

      // Update game name refs in play mode
      if (isPlay) {
        const rawMode = String(ls.mode || "");
        let displayText = ls.gameName || "Just Playing";
        if (rawMode.startsWith('play|') && ls.playTopic) {
          displayText = `play - ${ls.playTopic}`;
        }
        if (timerRefs.gameName1.current) timerRefs.gameName1.current.innerText = displayText;
        if (timerRefs.gameName2.current) timerRefs.gameName2.current.innerText = displayText;
      }

      // Update standby title
      if (timerRefs.standbyTitle.current) {
        const rawMode = String(ls.mode || "");
        if (rawMode.startsWith('standby|') && ls.standbyTopic) {
          timerRefs.standbyTitle.current.innerText = `standby - ${ls.standbyTopic}`;
        } else {
          timerRefs.standbyTitle.current.innerText = ls.standbySelection || "Coming Soon";
        }
      }

      // Process and update the explain topic text
      const rawModeLocal = String(ls.mode || "");
      let currentTopicText = 'Explain Topic';
      
      if (rawModeLocal.startsWith('explain|')) {
        const topic = rawModeLocal.split('|').slice(1).join('|') || 'Explain Topic';
        if (topic && topic !== ls.explainTopic) {
          ls.explainTopic = topic;
          setStoredExplainTopic(topic);
        }
        currentTopicText = topic;
      } else if (rawModeLocal.startsWith('explain')) {
        currentTopicText = ls.explainTopic || getStoredExplainTopic() || 'Explain Topic';
        ls.explainTopic = currentTopicText;
      } else {
        currentTopicText = "";
      }

      // Update the UI element specifically for the explain topic
      if (timerRefs.explainTopicText.current) {
        timerRefs.explainTopicText.current.innerText = currentTopicText;
      }

      // Update the accumulated hours track for explain mode
      if (timerRefs.explainAccumulated.current) {
        if (rawModeLocal.startsWith('explain')) {
          timerRefs.explainAccumulated.current.innerText = hoursString;
        } else {
          timerRefs.explainAccumulated.current.innerText = "";
        }
      }

      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // API Polling Loop
  useEffect(() => {
    if (displayMode === 'minecraft') return;
    let pollingInterval;
    async function fetchState() {
      try {
        const response = await fetch("https://tiesin.me/api/stream/state");
        if (!response.ok) return;

        const stateData = await response.json();
        
        // Update Live Refs for the clock
        if (stateData?.metrics) {
          const m = stateData.metrics;
          
          let acc = Number(m.accumulatedTodaySeconds ?? m.todayWorkSeconds ?? 0);
          
          if (acc === -1) {
            acc = 0;
            liveStateRef.current.modeTimestamp = Date.now();
          } else {
            liveStateRef.current.modeTimestamp = Number(m.modeTimestamp || Date.now());
          }

          liveStateRef.current.mode = m.mode || "standby";
          liveStateRef.current.accumulatedTodaySeconds = acc;
          liveStateRef.current.previousDaysSeconds = Number(m.previousDaysSeconds || 0);
          liveStateRef.current.totalDays = Number(m.totalDays || 1);
          liveStateRef.current.isStreaming = m.isStreaming ?? false;
          liveStateRef.current.gameName = m.gameName ?? "Just Playing";
          liveStateRef.current.standbySelection = m.standbySelection ?? "Coming Soon";
          liveStateRef.current.playTopic = m.playTopic ?? "";
          liveStateRef.current.standbyTopic = m.standbyTopic ?? "";
          const rawMode = String(m.mode || "");
          if (rawMode.startsWith('explain|')) {
            const topic = rawMode.split('|').slice(1).join('|').trim();
            if (topic) {
              liveStateRef.current.explainTopic = topic;
              setStoredExplainTopic(topic);
            }
          } else if (rawMode.startsWith('explain') && !liveStateRef.current.explainTopic) {
            liveStateRef.current.explainTopic = getStoredExplainTopic();
          }

          // Update React Mode state just for mapping CSS classes and hiding/showing screens
          setModeReact(m.mode || "standby");

          setCounts({
            contacted: Number(m.contactedCount || 0),
            converted: Number(m.convertedCount || 0)
          });
        }

        // Process Tasks
        if (stateData?.tasks && Array.isArray(stateData.tasks)) {
          let updatedTasks = stateData.tasks.map(data => {
            const rawStatus = String(data.status || "waiting").toLowerCase();
            let mappedStatus = "waiting";
            if (rawStatus.includes("progress")) mappedStatus = "in_progress";
            else if (rawStatus.includes("done") || rawStatus.includes("complete")) mappedStatus = "done";
            else if (rawStatus.includes("next")) mappedStatus = "up_next";
            else if (rawStatus.includes("review")) mappedStatus = "in_review";

            return {
              id: String(data.id),
              name: String(data.name).trim(),
              status: mappedStatus,
              createdAt: Number(data.createdAt) || Date.now(),
              completedAt: data.completedAt ? Number(data.completedAt) : null
            };
          });
          setTasks(updatedTasks);
        }

      } catch (e) {
        console.error("Poll failed", e);
      }
    }

    fetchState();
    pollingInterval = setInterval(fetchState, 1500);
    return () => clearInterval(pollingInterval);
  }, [displayMode]);

  useEffect(() => {
    const rawMode = displayMode || modeReact;
    const activeMode = rawMode.startsWith('explain') ? 'explain' : rawMode;
    if (activeMode !== 'minecraft') return;

    const useServerApi = Boolean(MINECRAFT_API_URL) || window.location.hostname !== 'localhost';

    if (useServerApi) {
      let cancelled = false;

      const fetchMinecraftStats = async () => {
        try {
          const response = await fetch(MINECRAFT_API_URL || '/api/stream/minecraft', { cache: 'no-store' });
          if (!response.ok) return;

          const payload = await response.json();
          if (!cancelled) {
            setMinecraftStats(payload.stats || payload);
          }
        } catch (error) {
          console.error('Minecraft stats fetch failed', error);
        }
      };

      fetchMinecraftStats();
      const interval = setInterval(fetchMinecraftStats, 10000);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    const source = new EventSource('http://localhost:2026/events');
    const handleStats = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setMinecraftStats(payload.stats || payload);
      } catch (error) {
        console.error('Minecraft stats parse failed', error);
      }
    };

    source.addEventListener('stats', handleStats);
    source.onerror = () => {
      // Let EventSource handle reconnects.
    };

    return () => {
      source.removeEventListener('stats', handleStats);
      source.close();
    };
  }, [displayMode, modeReact]);

  // --- Render Mappings ---
  const rawMode = displayMode || modeReact;
  const activeMode = rawMode.startsWith('explain') ? 'explain' : rawMode;
  const inProgressIds = new Set(tasks.filter(t => t.status === "in_progress").map(t => t.id));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const displayTasks = [
    ...tasks.filter(t => t.status === "waiting" && !inProgressIds.has(t.id)).sort((a, b) => a.createdAt - b.createdAt),
    ...tasks.filter(t => t.status === "up_next" && !inProgressIds.has(t.id)).sort((a, b) => a.createdAt - b.createdAt),
    ...tasks.filter(t => t.status === "in_progress").sort((a, b) => b.createdAt - a.createdAt),
    ...tasks.filter(t => t.status === "in_review" && !inProgressIds.has(t.id)).sort((a, b) => b.createdAt - a.createdAt),
    ...tasks.filter(t => t.status === "done" && !inProgressIds.has(t.id) && (t.completedAt || t.createdAt) >= startOfToday.getTime())
            .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt))
  ];

  return (
    <div className={`overlay-root mode-${activeMode}`}>
      
      {/* Top Banner specific for Explain Mode */}
      <div className="explain-banner">
        <div className="explain-banner-date" ref={timerRefs.explainDate}>--/--/----</div>
        <div className="explain-banner-day" ref={timerRefs.explainDay}>Day --</div>
        <div className="explain-banner-time" ref={timerRefs.explainTime}>--- - --:-- --</div>
      </div>

      <div className="obs-frame frame-display" aria-hidden="true"></div>
      <div className="obs-frame frame-webcam" aria-hidden="true"></div>
      <div className="obs-frame frame-context" aria-hidden="true"></div>
      {activeMode === 'minecraft' ? (
        <div className="tl-pill current minecraft-run-badge">
          <div className="tl-title">
            Run <br />
            #{ (Number(minecraftStats.today?.totalGames || minecraftStats.totals?.totalRuns || 0)) + 1 }
          </div>
        </div>
      ) : null}

      <section className="zone-top">
        <aside className="timeline" id="timeline">
          <div className="timeline-list" ref={timelineListRef}>
             {displayTasks.map(task => {
                const isCurrent = inProgressIds.has(task.id);
                const pillClass = isCurrent ? "tl-pill current" : "tl-pill done";
                const metaClass = isCurrent ? "tl-meta current" : "tl-meta done";
                const when = task.status === "done" ? (task.completedAt || task.createdAt) : task.createdAt;
                
                let statusStr = "waiting";
                let dotColor = "#9113A4"; // waiting (purple)
                
                if (task.status === "in_progress") { statusStr = "in progress"; dotColor = "#4DAA57"; }
                else if (task.status === "in_review") { statusStr = "in review"; dotColor = "#FFBA08"; }
                else if (task.status === "up_next") { statusStr = "up next"; dotColor = "#2F6690"; }
                else if (task.status === "done") { statusStr = "done"; dotColor = "#F95738"; }
                
                let timeStr = "";
                if (task.status === "in_progress") timeStr = "started " + relativeTime(task.createdAt);
                else if (task.status === "done" || task.status === "in_review") timeStr = "finished " + relativeTime(when);
                else timeStr = "added " + relativeTime(task.createdAt);

                return (
                  <div key={task.id} className={`tl-item ${task.status}`}>
                    <div className={pillClass}>
                      <div className="tl-title">{task.name}</div>
                      <div className={metaClass}>
                        <span className="status-dot" style={{ color: dotColor }}>&#9679;</span>
                        &nbsp;&nbsp;{statusStr} &middot; {timeStr}
                      </div>
                    </div>
                  </div>
                )
               })}
          </div>
        </aside>
      </section>

      <section className="context-shell" id="contextShell" aria-label="Work and explain context panel">
        <div className="context-panel">
          {activeMode === 'minecraft' ? (
            <>
              {/* TODAY BOX */}
              <div className="minecraft-box mc-today-box">
                <div className="mc-box-header">Today</div>
                <div className="minecraft-metric mc-stat-row">
                  <span className="tl-meta">Games Played</span>
                  <span className="side-line">{minecraftStats.today?.totalGames || 0}</span>
                </div>
                <div className="minecraft-metric mc-stat-row">
                  <span className="tl-meta">Best Time</span>
                  <span className="side-line" style={{ color: 'var(--white-92)' }}>
                    {formatMillis(minecraftStats.today?.bestTimeMs || 0)}
                  </span>
                </div>
                <div className="minecraft-metric mc-stat-row">
                  <span className="tl-meta">Playtime</span>
                  <span className="side-line">
                    {Math.floor((minecraftStats.today?.totalPlaytimeMs || 0) / 3600000)}h {Math.floor(((minecraftStats.today?.totalPlaytimeMs || 0) % 3600000) / 60000)}m
                  </span>
                </div>
              </div>

              {/* TOTALITY BOX */}
              <div className="minecraft-box mc-totality-box">
                <div className="mc-box-header">Totality</div>
                <div className="minecraft-metric mc-stat-row">
                  <span className="tl-meta">Games Played</span>
                  <span className="side-line">{minecraftStats.totality?.totalGames || 0}</span>
                </div>
                <div className="minecraft-metric mc-stat-row">
                  <span className="tl-meta">Best Time</span>
                  <span className="side-line" style={{ color: 'var(--white-92)' }}>
                    {formatMillis(minecraftStats.totality?.bestTimeMs || 0)}
                  </span>
                </div>
                <div className="minecraft-metric mc-stat-row">
                  <span className="tl-meta">Playtime</span>
                  <span className="side-line">
                    {Math.floor((minecraftStats.totality?.totalPlaytimeMs || 0) / 3600000)}h {Math.floor(((minecraftStats.totality?.totalPlaytimeMs || 0) % 3600000) / 60000)}m
                  </span>
                </div>
              </div>

              {/* 2ND MONITOR CAPTURE (16:9) */}
              <div className="mc-monitor-box">
                <div className="obs-frame frame-monitor" aria-hidden="true"></div>
              </div>

              {/* WEBCAM (already positioned via CSS) */}
              <div className="mc-webcam-box"></div>
            </>
          ) : (
            <>
              <div className="hero-col">
                <div className="context-pill stack hero-timer-pill">
                  <div className="today-time" ref={timerRefs.todayTime}>00:00:00</div>
                  <div className="session-line">
                    <span className="session-label">since last break</span>
                    <span ref={timerRefs.sessionTime}>00:00:00</span>
                  </div>
                </div>
                {activeMode === 'explain' ? (
                  <div className="explain-pill-stack">
                    <div className="context-pill explain-pill">
                      <div className="side-line" ref={timerRefs.explainTopicText}>Explain Topic</div>
                    </div>
                    <div className="context-pill explain-pill">
                      <div className="side-line" ref={timerRefs.explainAccumulated}>Day 1 - 0.0/{HOURS_TARGET} Hours Accumulated</div>
                    </div>
                  </div>
                ) : (
                  <div className="context-pill hero-pill">
                    <div className="side-line" ref={timerRefs.dayHoursTrack}>Day 1 - 0.0/{HOURS_TARGET} Hours Accumulated</div>
                  </div>
                )}
              </div>
              <div className="side-col">
                <div className="context-pill stack">
                  <div className="side-line" ref={timerRefs.nowDateMain}>--/--/----</div>
                  <div className="side-line" ref={timerRefs.nowTimeMain}>--- - --:-- --</div>
                </div>
                <div className="context-pill stack side-line-counts">
                  {activeMode === 'play' ? (
                    <>
                      <div className="side-line" ref={timerRefs.gameName1}>{liveStateRef.current.gameName}</div>
                      <div className="side-line" ref={timerRefs.gameName2}>{liveStateRef.current.gameName}</div>
                    </>
                  ) : (
                    <>
                      <div className="side-line">Projects: {counts.contacted}</div>
                      <div className="side-line">Contacts: {counts.converted}</div>
                    </>
                  )}
                </div>
              </div>
              <div className="webcam-col"></div>
            </>
          )}
        </div>
      </section>

      <section className="progress-strip" aria-hidden="true">
        <div className="progress-fill" ref={timerRefs.progressFill}></div>
      </section>

      <section className="break-screen full-screen" id="breakScreen">
        <div className="screen-stack">
          <div className="screen-block">
            <div className="break-label">WILL BE BACK</div>
            <div className="break-timer" ref={timerRefs.breakTime}>
              00:00:00
            </div>
          </div>

          <div className="screen-time-stack">
            <div className="screen-time" ref={timerRefs.nowTimeBreak}>
              --:-- --
            </div>
            <div className="screen-date" ref={timerRefs.nowDateBreak}>
              ----
            </div>
          </div>

          <div className="screen-divider"></div>

          <div className="screen-task-stack">
            <div className="screen-task-label">To Continue</div>
            {tasks.filter(t => t.status === "in_progress").length > 0 ? (
              <div className="screen-task-list">
                {tasks.filter(t => t.status === "in_progress").map(t => (
                  <div key={t.id} className="screen-task-item">
                    {t.name}
                  </div>
                ))}
              </div>
            ) : (
              <div className="screen-task-empty">Enjoy your break</div>
            )}
          </div>
        </div>
      </section>

      <section className="standby-screen full-screen" id="standbyScreen">
        <div className="screen-stack">
          <div className="screen-block">
            <div className="standby-title" ref={timerRefs.standbyTitle}>Coming Soon</div>
          </div>

          <div className="screen-time-stack">
            <div className="screen-time" ref={timerRefs.nowTimeStandby}>
              --:-- --
            </div>
            <div className="screen-date" ref={timerRefs.nowDateStandby}>
              ----
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
