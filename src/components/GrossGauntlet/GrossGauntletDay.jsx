import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { API } from '../../config/api';
import { formatDate, deriveSubtitle } from './utils';
import SessionCard from './SessionCard';
import './GrossGauntletPages.css';

export default function GrossGauntletDay() {
  const { dayNumber } = useParams();
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDay() {
      try {
        const res = await fetch(API.getDay(dayNumber));
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setDay(data?.data || data);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load day');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDay();
    return () => { cancelled = true; };
  }, [dayNumber]);

  useEffect(() => {
    if (!day || loading) return;
    const sessions = Array.isArray(day.sessions) && day.sessions.length > 0
      ? day.sessions
      : [{ session_number: 1, title: day.title || day.name || `Day ${dayNumber}`, subtitle: day.subtitle || null }];
    if (sessions.length === 1) {
      const sessNum = sessions[0].session_number ?? 1;
      navigate(`/grossgauntlet/${dayNumber}/${sessNum}`, { replace: true });
    }
  }, [day, loading, dayNumber, navigate]);

  const sessions = Array.isArray(day?.sessions) && day.sessions.length > 0
    ? day.sessions
    : [{ session_number: 1, title: day?.title || day?.name || `Day ${dayNumber}`, subtitle: day?.subtitle || null }];

  useEffect(() => {
    if (!containerRef.current || loading || error) return;
    const cards = containerRef.current.children;
    if (cards && cards.length > 0) {
      gsap.from(cards, {
        opacity: 0,
        y: 6,
        duration: 0.3,
        stagger: 0.05,
        ease: 'power2.out',
      });
    }
  }, [sessions, loading, error]);

  if (loading) {
    return (
      <div className="gg-log-view">
        <Link to="/grossgauntlet" className="gg-back-link">← Days</Link>
        <p className="gg-page-subtitle">Loading Day {dayNumber}…</p>
      </div>
    );
  }

  if (error || !day) {
    return (
      <div className="gg-log-view">
        <Link to="/grossgauntlet" className="gg-back-link">← Days</Link>
        <h1 className="gg-page-title">Day {dayNumber}</h1>
        <p className="gg-page-subtitle gg-error">{error || 'Day not found.'}</p>
      </div>
    );
  }

  const title = day.title || day.name || `Day ${dayNumber}`;
  const subtitle = day.subtitle || day.timestamps || '';

  return (
    <div className="gg-log-view">
      <Link to="/grossgauntlet" className="gg-back-link">← Days</Link>
      <div className="gg-session-meta">
        <div className="gg-log-card-number">Day {dayNumber}</div>
        <h1 className="gg-page-title">{title}</h1>
        <p className="gg-page-subtitle">{subtitle}</p>
        <p className="gg-session-date">{formatDate(day.date || day.created_at)}</p>
      </div>

      <h2 className="gg-section-title">Stream Sessions</h2>
      <div className="gg-session-list" ref={containerRef}>
        {sessions.map((session) => {
          const sessNum = session.session_number ?? 1;
          const streamTitle = session.title || title;
          const sessionSubtitle = session.subtitle || deriveSubtitle(streamTitle);
          const isLive = session.is_streaming || false;
          const streamUrl = session.stream_url || null;
          const todaySeconds = session.today_seconds || 0;
          const taskCounts = {
            todo: session.todo_count || 0,
            up_next: session.up_next_count || 0,
            in_progress: session.in_progress_count || 0,
            in_review: session.in_review_count || 0,
            done: session.done_count || 0,
          };

          return (
            <SessionCard
              key={`${sessNum}`}
              dayNumber={dayNumber}
              title={sessionSubtitle || streamTitle}
              date={day.date || day.created_at}
              todaySeconds={todaySeconds}
              taskCounts={taskCounts}
              isStreaming={isLive}
              streamUrl={streamUrl}
              sessionCount={1}
              onClick={() => navigate(`/grossgauntlet/${dayNumber}/${sessNum}`)}
            />
          );
        })}
      </div>
    </div>
  );
}