import { useState, useEffect, useRef } from 'react';
import './TiedInApp.css?v=20260529l';

const HOURS_TARGET = 2000;
const CONTEXT_WIDTH = 1075.33;
const EXPLAIN_TOPIC_KEY = 'EXPLAIN_TOPIC';
const MINECRAFT_OVERLAY_VERSION = 'mc-overlay-v2';

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
    totals: { totalRuns: 0, completedRuns: 0 },
    averages: { avgFinalIgtCompleted: 0, avgEnterNetherIgt: 0, avgEnterEndIgt: 0 },
    bests: { bestFinalIgt: 0 }
  });
  const [modeReact, setModeReact] = useState("standby"); // for changing class names

  // Refs for requestAnimationFrame clock updates
  const timerRefs = {
    todayTime: useRef(null),
    sessionTime: useRef(null),
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
    explainTopicText: useRef(null)
  };

  // Mutable source of truth for the animation loop
  const liveStateRef = useRef({
    mode: "standby",
    accumulatedTodaySeconds: 0,
    modeTimestamp: Date.now(),
    previousDaysSeconds: 0,
    totalDays: 1,
    explainTopic: ""
  });

  const getStoredExplainTopic = () => {
    try { return localStorage.getItem(EXPLAIN_TOPIC_KEY) || ""; }
    catch { return ""; }
  };

  const setStoredExplainTopic = (topic) => {
    try { localStorage.setItem(EXPLAIN_TOPIC_KEY, topic); } catch {}
  };

  // Animation Loop - Updates DOM directly
  useEffect(() => {
    let frame;
    function tick() {
      const nowMs = Date.now();
      const d = new Date(nowMs);
      const ls = liveStateRef.current;
      
      const isWorking = ls.mode === 'work';
      const isBreak = ls.mode === 'break';
      
      let todaySecs = ls.accumulatedTodaySeconds || 0;
      let sessionSecs = 0;
      let breakSecs = 0;
      
      if (isWorking) {
        const elapsed = Math.floor(Math.max(0, nowMs - ls.modeTimestamp) / 1000);
        todaySecs += elapsed;
        sessionSecs = elapsed;
      } else if (isBreak) {
        breakSecs = Math.floor(Math.max(0, nowMs - ls.modeTimestamp) / 1000);
      }
      
      if (timerRefs.todayTime.current) timerRefs.todayTime.current.innerText = formatHMS(todaySecs);
      if (timerRefs.sessionTime.current) timerRefs.sessionTime.current.innerText = formatHMS(sessionSecs);
      if (timerRefs.breakTime.current) timerRefs.breakTime.current.innerText = formatHMS(breakSecs);
      
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
        timerRefs.dayHoursTrack.current.innerText = hoursString;
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

    const source = new EventSource('http://localhost:2026/events');
    const handleStats = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setMinecraftStats(payload);
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
  const explainTopicDisplay = rawMode.startsWith('explain|') ? rawMode.split('|').slice(1).join('|') : "";
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
      {activeMode === 'minecraft' ? (
        <div className="tl-pill current minecraft-run-badge">
          <div className="tl-title">Run # {(Number(minecraftStats.totals.totalRuns) || 0) + 1} -</div>
        </div>
      ) : null}
      {activeMode === 'minecraft' ? (
        <div className="minecraft-test-stamp">{MINECRAFT_OVERLAY_VERSION}</div>
      ) : null}

      <section className="zone-top">
        <aside className="timeline" id="timeline">
          <div className="timeline-list">
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
                  <div key={task.id} className="tl-item">
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
          <div className="hero-col">
            {activeMode === 'minecraft' ? (
              <div className="minecraft-summary">
                <div className="minecraft-box minecraft-box-today">
                  <div className="tl-meta minecraft-box-title">Today</div>
                  <div className="minecraft-today-grid">
                    <div className="minecraft-metric">
                      <div className="tl-title">{minecraftStats.totals.totalRuns}</div>
                      <div className="tl-meta">Runs</div>
                    </div>
                    <div className="minecraft-metric">
                      <div className="tl-title">{minecraftStats.totals.completedRuns}</div>
                      <div className="tl-meta">Completed</div>
                    </div>
                    <div className="minecraft-metric minecraft-metric-wide">
                      <div className="tl-title">{formatMillis(minecraftStats.averages.avgFinalIgtCompleted)}</div>
                      <div className="tl-meta">Avg IGT</div>
                    </div>
                  </div>
                </div>
                <div className="minecraft-box minecraft-box-total">
                  <div className="tl-meta minecraft-box-title">Total</div>
                  <div className="minecraft-total-grid">
                    <div className="minecraft-metric">
                      <div className="tl-title">{formatMillis(minecraftStats.bests.bestFinalIgt)}</div>
                      <div className="tl-meta">PB IGT</div>
                    </div>
                    <div className="minecraft-metric">
                      <div className="tl-title">{formatMillis(minecraftStats.averages.avgFinalIgtCompleted)}</div>
                      <div className="tl-meta">Avg IGT</div>
                    </div>
                    <div className="minecraft-metric">
                      <div className="tl-title">{formatMillis(minecraftStats.averages.avgEnterNetherIgt)}</div>
                      <div className="tl-meta">Avg Nether</div>
                    </div>
                    <div className="minecraft-metric">
                      <div className="tl-title">{formatMillis(minecraftStats.averages.avgEnterEndIgt)}</div>
                      <div className="tl-meta">Avg End</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
          <div className="side-col">
            {activeMode === 'minecraft' ? null : (
              <>
                <div className="context-pill stack">
                  <div className="side-line" ref={timerRefs.nowDateMain}>--/--/----</div>
                  <div className="side-line" ref={timerRefs.nowTimeMain}>--- - --:-- --</div>
                </div>
                <div className="context-pill stack side-line-counts">
                  <div className="side-line">Contacted: {counts.contacted}</div>
                  <div className="side-line">Converted: {counts.converted}</div>
                </div>
              </>
            )}
          </div>
          <div className="webcam-col"></div>
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
            <div className="standby-title">STANDBY</div>
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
