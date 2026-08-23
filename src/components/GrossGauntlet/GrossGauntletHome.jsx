import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { API } from '../../config/api';
import SessionCard from './SessionCard';
import './GrossGauntletPages.css';

function getMonthKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getWeekNumber(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const diff = d - startOfYear + (startOfYear.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
  return Math.ceil((diff / 86400000 + startOfYear.getDay() + 1) / 7);
}

function getDayNumber(dateStr) {
  if (!dateStr) return 0;
  return new Date(dateStr).getDate();
}

function getWeekLabel(dateStr) {
  if (!dateStr) return '';
  const week = getWeekNumber(dateStr);
  return `WK ${week}`;
}

function groupDaysByMonthWeek(days) {
  const months = [];
  const monthMap = {};

  for (const day of days) {
    const monthKey = getMonthKey(day.date);
    const weekLabel = getWeekLabel(day.date);

    if (!monthMap[monthKey]) {
      monthMap[monthKey] = { key: monthKey, weeks: {} };
      months.push(monthMap[monthKey]);
    }

    if (!monthMap[monthKey].weeks[weekLabel]) {
      monthMap[monthKey].weeks[weekLabel] = { label: weekLabel, days: [] };
    }
    monthMap[monthKey].weeks[weekLabel].days.push(day);
  }

  return months;
}

export default function GrossGauntletHome() {
  const gridRef = useRef(null);
  const navigate = useNavigate();
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeLabel, setActiveLabel] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchDays() {
      try {
        const res = await fetch(API.getAllDays());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const records = Array.isArray(json) ? json : (json?.data || []);
        setDays(records);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load days');
        if (!cancelled) setDays([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDays();
    return () => { cancelled = true; };
  }, []);

  const monthWeekGroups = useMemo(() => groupDaysByMonthWeek(days), [days]);

  function handleLabelClick(key) {
    setActiveLabel(key);
    // key is either a month key (e.g. "AUG 2026") or combined month-week key (e.g. "AUG 2026-WK 32")
    const monthEl = document.querySelector(`[data-month="${key}"]`);
    if (monthEl) {
      monthEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    // Week keys include the month prefix, but data-week on cards is just "WK XX"
    // Find the first card with the matching month prefix + week
    const parts = key.split('-');
    const weekLabel = parts.length > 1 ? parts.slice(1).join('-') : key;
    const weekEl = document.querySelector(`[data-week="${weekLabel}"]`);
    if (weekEl) {
      weekEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (loading) {
    return (
      <div className="gg-log-index gg-log-index--bottom-pad">
        <h1 className="gg-page-title">GrossGauntlet</h1>
        <p className="gg-page-subtitle">Loading days…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gg-log-index gg-log-index--bottom-pad">
        <h1 className="gg-page-title">GrossGauntlet</h1>
        <p className="gg-page-subtitle gg-error">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="gg-log-index gg-log-index--bottom-pad">
        <header className="gg-index-header">
          <h1 className="gg-page-title">GrossGauntlet</h1>
          <p className="gg-page-subtitle">Historical Log Index</p>
        </header>

        <div className="gg-log-grid" ref={gridRef}>
          {console.log('DAYS DATA:', JSON.stringify(days, null, 2))}
          {days.map((day) => {
            const sessionCount = day.sessions?.length || 0;
            const isLive = day.sessions?.some(s => s.is_streaming);
            const streamUrl = day.sessions?.find(s => s.is_streaming)?.stream_url || null;
            const totalSeconds = day.sessions?.reduce((acc, s) => acc + (s.today_seconds || 0), 0) || 0;
            const taskCounts = {
              todo: day.sessions?.reduce((acc, s) => acc + (s.todo_count || 0), 0) || 0,
              up_next: day.sessions?.reduce((acc, s) => acc + (s.up_next_count || 0), 0) || 0,
              in_progress: day.sessions?.reduce((acc, s) => acc + (s.in_progress_count || 0), 0) || 0,
              in_review: day.sessions?.reduce((acc, s) => acc + (s.in_review_count || 0), 0) || 0,
              done: day.sessions?.reduce((acc, s) => acc + (s.done_count || 0), 0) || 0,
            };
            const displayTitle = day.dayNumber ? `Day ${day.dayNumber}` : day.date;
            const monthKey = getMonthKey(day.date);
            const weekLabel = getWeekLabel(day.date);

            const navTarget = sessionCount === 1
              ? `/grossgauntlet/${day.dayNumber}/1`
              : `/grossgauntlet/${day.dayNumber}`;

            return (
              <SessionCard
                key={day.date}
                dayNumber={day.dayNumber}
                title={displayTitle}
                date={day.date}
                todaySeconds={totalSeconds}
                taskCounts={taskCounts}
                isStreaming={isLive}
                streamUrl={streamUrl}
                sessionCount={sessionCount}
                onClick={() => navigate(navTarget)}
                dataMonth={monthKey}
                dataWeek={weekLabel}
              />
            );
          })}

          {days.length === 0 && (
            <p className="gg-empty">No challenge days recorded yet.</p>
          )}
        </div>
        {!loading && !error && days.length > 0 && <StaggerAnimation gridRef={gridRef} />}
      </div>

      {!loading && !error && days.length > 0 && (
        <div className="gg-bottom-bar">
          {monthWeekGroups.map((month) => (
            <div key={month.key} className="gg-bottom-bar-group">
              <span
                className={`gg-bottom-label ${activeLabel === month.key ? 'gg-bottom-label--active' : ''}`}
                onClick={() => handleLabelClick(month.key)}
              >
                {month.key}
              </span>
              {Object.values(month.weeks).map((week) => (
                <span
                  key={week.label}
                  className={`gg-bottom-label ${activeLabel === `${month.key}-${week.label}` ? 'gg-bottom-label--active' : ''}`}
                  onClick={() => handleLabelClick(`${month.key}-${week.label}`)}
                >
                  {week.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function StaggerAnimation({ gridRef }) {
  useGSAP(() => {
    const cards = gridRef.current?.children;
    if (cards && cards.length > 0) {
      gsap.from(cards, {
        opacity: 0,
        y: 6,
        stagger: 0.05,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, { scope: gridRef });

  return null;
}