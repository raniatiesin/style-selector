/* eslint-disable react-hooks/refs, react-hooks/exhaustive-deps */

import { useState, useEffect, useRef } from 'react';
import { API } from '../../config/api';
import { 
  clamp, 
  formatHMS, 
  formatTime12, 
  formatMillis, 
  formatDateLong, 
  formatDateCA,
  formatHours, 
  relativeTime,
  getLocalStorageItem,
  setLocalStorageItem
} from './utils';
import { 
  HOURS_TARGET, 
  CONTEXT_WIDTH, 
  STORAGE_KEYS,
  DAILY_WORK_TARGET_SECONDS 
} from './constants';
import './GrossGauntletApp.css';

export default function GrossGauntletApp() {
  // Purely data-driven state for UI lists (tasks, counts)
  const [tasks, setTasks] = useState([]);
  const [counts, setCounts] = useState({ content: 0, sales: 0 });
  const [modeReact, setModeReact] = useState("standby"); // for changing class names

  // Refs for requestAnimationFrame clock updates
  const timerRefs = {
    todayTime: useRef(null),
    sessionTime: useRef(null),
    mcSessionTime: useRef(null),
    mcProgressFill: useRef(null),
    dayHoursTrack: useRef(null),
    progressFill: useRef(null),
    breakTime: useRef(null),
    nowTimeBreak: useRef(null),
    nowDateBreak: useRef(null),
    nowTimeStandby: useRef(null),
    nowDateStandby: useRef(null),
    nowDateMain: useRef(null),
    nowTimeMain: useRef(null),
    explainDate: useRef(null),
    explainDay: useRef(null),
    explainTime: useRef(null),
    explainAccumulated: useRef(null),
    explainTopicText: useRef(null),
    standbyTitle: useRef(null),
    grossTotal: useRef(null),
    grossAlpha: useRef(null)
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
    standbySelection: "Coming Soon",
    timestamps: "",
    streamNumber: 1,
    isPaused: false,
    pausedTimestamp: null,
    lastBreakEndTimestamp: Date.now(),
    date: null,
    totalGross: 0,
    alphaGross: 0
  });

  // Ref for the timeline list container to enable scroll-to-in-progress
  const timelineListRef = useRef(null);

  // Ref for the overlay scaler
  const scalerRef = useRef(null);

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

  // Dynamic scaling for overlay to fit any viewport
  useEffect(() => {
    function updateScale() {
      if (!scalerRef.current) return;
      const scaleX = window.innerWidth / 1440;
      const scaleY = window.innerHeight / 1080;
      const scale = Math.min(scaleX, scaleY);
      scalerRef.current.style.transform = `scale(${scale})`;
    }
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const getStoredExplainTopic = () => getLocalStorageItem(STORAGE_KEYS.EXPLAIN_TOPIC, "");
  const setStoredExplainTopic = (topic) => setLocalStorageItem(STORAGE_KEYS.EXPLAIN_TOPIC, topic);

  // Animation Loop - Updates DOM directly
  useEffect(() => {
    let frame;
    function tick() {
      const nowMs = Date.now();
      const d = new Date(nowMs);
      const ls = liveStateRef.current;
      
      const isWorking = ls.mode === 'work';
      const isBreak = ls.mode === 'break';
      const isStreaming = ls.isStreaming ?? false;
      const isPaused = ls.isPaused ?? false;
      
      let todaySecs = ls.accumulatedTodaySeconds || 0;
      let sessionSecs = 0;
      let breakSecs = 0;
      
      if (isStreaming && isWorking && !isPaused) {
        const elapsed = Math.floor(Math.max(0, nowMs - ls.modeTimestamp) / 1000);
        todaySecs += elapsed;
        sessionSecs = Math.floor(Math.max(0, nowMs - (ls.lastBreakEndTimestamp || ls.modeTimestamp)) / 1000);
      } else if (isStreaming && isBreak) {
        breakSecs = Math.floor(Math.max(0, nowMs - ls.modeTimestamp) / 1000);
      }
      
      if (timerRefs.todayTime.current) {
        timerRefs.todayTime.current.innerText = formatHMS(todaySecs);
      }
      if (timerRefs.sessionTime.current) {
        // Hide session timer when paused
        if (isPaused && isWorking && isStreaming) {
          timerRefs.sessionTime.current.style.display = 'none';
        } else {
          timerRefs.sessionTime.current.style.display = '';
          timerRefs.sessionTime.current.innerText = formatHMS(sessionSecs);
        }
      }
      if (timerRefs.breakTime.current) timerRefs.breakTime.current.innerText = formatHMS(breakSecs);
      const time12 = formatTime12(d);
      const ldate = formatDateLong(d);
      const shortDate = formatDateCA(d);
      const weekdayShort = d.toLocaleDateString("en-US", { weekday: "short" });
      const sideDate = `${weekdayShort} - ${time12}`;

      if (timerRefs.nowTimeBreak.current) timerRefs.nowTimeBreak.current.innerText = time12;
      if (timerRefs.nowDateBreak.current) timerRefs.nowDateBreak.current.innerText = ldate;
      
      if (timerRefs.nowTimeStandby.current) timerRefs.nowTimeStandby.current.innerText = time12;
      if (timerRefs.nowDateStandby.current) timerRefs.nowDateStandby.current.innerText = ldate;

      if (timerRefs.nowDateMain.current) timerRefs.nowDateMain.current.innerText = shortDate;
      if (timerRefs.nowTimeMain.current) timerRefs.nowTimeMain.current.innerText = sideDate;

      if (timerRefs.explainDate.current) timerRefs.explainDate.current.innerText = shortDate;
      if (timerRefs.explainDay.current) timerRefs.explainDay.current.innerText = `Day ${ls.totalDays || 1}`;
      if (timerRefs.explainTime.current) timerRefs.explainTime.current.innerText = sideDate;

      const progressVal = clamp(todaySecs / DAILY_WORK_TARGET_SECONDS, 0, 1);
      if (timerRefs.progressFill.current) {
        timerRefs.progressFill.current.style.width = `${(progressVal * CONTEXT_WIDTH).toFixed(2)}px`;
      }

      const accumulatedTotalSeconds = (ls.previousDaysSeconds || 0) + todaySecs;
      const hoursString = `Day ${ls.totalDays || 1} - ${formatHours(accumulatedTotalSeconds)}/${HOURS_TARGET} Hours Accumulated`;
      
      // Update the hours track for work/standby modes
      if (timerRefs.dayHoursTrack.current) {
        timerRefs.dayHoursTrack.current.innerText = hoursString;
      }

      // Update session label based on pause state
      const sessionLabel = document.querySelector('.session-label');
      if (sessionLabel) {
        if (isPaused && isWorking && isStreaming) {
          sessionLabel.innerText = 'Just Chilling Right Now';
        } else {
          sessionLabel.innerText = 'since last break';
        }
      }



      // Update standby title
      if (timerRefs.standbyTitle.current) {
        timerRefs.standbyTitle.current.innerText = ls.standbySelection || "Coming Soon";
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

      // Update gross display
      const grossTotal = Number(ls.totalGross ?? 0);
      const alphaGross = Number(ls.alphaGross ?? 0);
      if (timerRefs.grossTotal.current) {
        timerRefs.grossTotal.current.innerText = `GROSS: $${grossTotal.toLocaleString()}`;
      }
      if (timerRefs.grossAlpha.current) {
        timerRefs.grossAlpha.current.innerText = `TODAY +: $${alphaGross.toLocaleString()}`;
      }

      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // API Polling Loop
  useEffect(() => {
    let pollingInterval;
    async function fetchState() {
      try {
        const response = await fetch(API.getStreamState());
        if (!response.ok) return;

        const stateData = await response.json();
        
        // Update Live Refs for the clock
        if (stateData?.metrics) {
          const m = stateData.metrics;
          
          let acc = Number(m.accumulatedTodaySeconds ?? 0);
          
          if (acc === -1) {
            acc = 0;
            liveStateRef.current.modeTimestamp = Date.now();
          }

          // Detect mode change: if poll says different mode, reset local timestamp
          const pollMode = m.mode || "standby";
          if (pollMode !== liveStateRef.current.mode) {
            liveStateRef.current.mode = pollMode;
            liveStateRef.current.modeTimestamp = Date.now();
          }
          // If mode is same, leave modeTimestamp completely untouched.

          // Only update streaming state if explicitly provided (fixes the "not streaming" bug)
          if (m.isStreaming !== undefined) {
            liveStateRef.current.isStreaming = m.isStreaming;
          }
          
          // Only update pause state if explicitly provided (fixes the "paused when not paused" bug)
          if (m.isPaused !== undefined) {
            liveStateRef.current.isPaused = m.isPaused;
          }
          if (m.pausedTimestamp !== undefined) {
            liveStateRef.current.pausedTimestamp = m.pausedTimestamp;
          }

          if (m.lastBreakEndTimestamp) {
            liveStateRef.current.lastBreakEndTimestamp = Number(m.lastBreakEndTimestamp);
          } else if (!liveStateRef.current.lastBreakEndTimestamp) {
            liveStateRef.current.lastBreakEndTimestamp = Date.now();
          }
          // Day-aware monotonic guard: the running day total may only increase within
          // the same day. It MAY reset only when the server reports a different date.
          // This is the definitive protection against the total visually "resetting"
          // when a stale/partial value is broadcast or polled.
          const serverDate = m.date || null;
          const currentDate = liveStateRef.current.date;
          if (serverDate && serverDate !== currentDate) {
            liveStateRef.current.date = serverDate;
            liveStateRef.current.accumulatedTodaySeconds = acc;
          } else if (Number.isFinite(acc) && acc >= (liveStateRef.current.accumulatedTodaySeconds || 0)) {
            liveStateRef.current.accumulatedTodaySeconds = acc;
          }
          // Otherwise: keep the current (higher) accumulated value.
          liveStateRef.current.previousDaysSeconds = Number(m.previousDaysSeconds || 0);
          liveStateRef.current.totalDays = Number(m.totalDays || 1);
          liveStateRef.current.standbySelection = m.standbySelection ?? "Coming Soon";
          liveStateRef.current.timestamps = m.timestamps ?? "";
          liveStateRef.current.streamNumber = m.streamNumber ?? 1;
          liveStateRef.current.totalGross = Number(m.totalGross ?? 0);
          liveStateRef.current.alphaGross = Number(m.alphaGross ?? 0);
          
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
            content: Number(m.contentCount ?? m.contactedCount ?? 0),
            sales: Number(m.salesCount ?? m.convertedCount ?? 0)
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
              completedAt: data.completedAt ? Number(data.completedAt) : null,
              due: data.due || data.due_date || data.dueDate || null
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
    
    return () => {
      clearInterval(pollingInterval);
    };
  }, []);

  // --- Render Mappings ---
  const rawMode = modeReact;
  const normalizedMode = rawMode === 'play' || rawMode === 'minecraft' ? 'work' : rawMode;
  const activeMode = normalizedMode.startsWith('explain') ? 'explain' : normalizedMode;
  const inProgressIds = new Set(tasks.filter(t => t.status === "in_progress").map(t => t.id));

  // Get today's date in YYYY-MM-DD format (Europe/Paris timezone to match API)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  
  // Use the API's date if available (for active streams across day boundaries)
  // Otherwise fall back to today
  const activeDate = today; // This will be updated from API data if needed

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const displayTasks = [
    ...tasks.filter(t => {
      const isWaiting = t.status === "waiting" && !inProgressIds.has(t.id);
      return isWaiting;
    }).sort((a, b) => a.createdAt - b.createdAt),
    ...tasks.filter(t => {
      const isUpNext = t.status === "up_next" && !inProgressIds.has(t.id);
      return isUpNext;
    }).sort((a, b) => a.createdAt - b.createdAt),
    ...tasks.filter(t => {
      const isInProgress = t.status === "in_progress";
      return isInProgress;
    }).sort((a, b) => b.createdAt - a.createdAt),
    ...tasks.filter(t => {
      const isInReview = t.status === "in_review" && !inProgressIds.has(t.id);
      return isInReview;
    }).sort((a, b) => b.createdAt - a.createdAt),
    ...tasks.filter(t => {
      const isDone = t.status === "done" && !inProgressIds.has(t.id) && (t.completedAt || t.createdAt) >= startOfToday.getTime();
      return isDone;
    }).sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt))
  ];

  return (
    <div className={`overlay-root mode-${activeMode}`}>
      <div className="overlay-scaler" ref={scalerRef}>
      
      {/* Top Banner specific for Explain Mode */}
      <div className="explain-banner">
        <div className="explain-banner-date" ref={timerRefs.explainDate}>--/--/----</div>
        <div className="explain-banner-day" ref={timerRefs.explainDay}>Day --</div>
        <div className="explain-banner-time" ref={timerRefs.explainTime}>--- - --:-- --</div>
      </div>

      <div className="obs-frame frame-display" aria-hidden="true"></div>
      <div className="obs-frame frame-webcam" aria-hidden="true"></div>
      <div className="obs-frame frame-context" aria-hidden="true"></div>

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
              <div className="side-line">CONTENT: {counts.content}</div>
              <div className="side-line">SALES: {counts.sales}</div>
            </div>
            <div className="context-pill stack side-line-counts">
              <div className="side-line" ref={timerRefs.grossTotal}>GROSS: $0</div>
              <div className="side-line" ref={timerRefs.grossAlpha}>TODAY +: $0</div>
            </div>
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
    </div>
  );
}
