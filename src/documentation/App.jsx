import { useState, useEffect } from 'react';
import '../styles/global.css';

const SECTIONS = [
  { id: 'peripherals', title: '0 — Peripherals' },
  { id: 'playbook', title: '1 — Playbook' },
  { id: 'prospecting', title: '2 — Prospecting' },
  { id: 'production', title: '3 — Production' },
  { id: 'progression', title: '4 — Progression' }
];

export default function DocsApp() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const getActiveSection = () => {
    // Expected paths might look like /tiedin/playbook etc.
    const pathSegments = currentPath.split('/').filter(Boolean);
    // If it's just /tiedin or /documentation
    const sectionId = pathSegments[pathSegments.length - 1]; 
    const section = SECTIONS.find(s => s.id === sectionId);
    return section ? section.id : 'peripherals'; // default to first
  };

  const activeId = getActiveSection();

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-color, #ffffff)',
      color: 'var(--text-color, #000000)',
      fontFamily: 'Space Grotesk, sans-serif'
    }}>
      {/* Sidebar */}
      <nav style={{
        width: '250px',
        borderRight: '1px solid var(--border-color, #eaeaea)',
        padding: '2rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', paddingLeft: '1rem' }}>TiedIn Docs</h2>
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`/tiedin/${section.id}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/tiedin/${section.id}`);
            }}
            style={{
              padding: '0.5rem 1rem',
              textDecoration: 'none',
              color: activeId === section.id ? 'var(--primary-color, #000)' : 'var(--text-muted, #666)',
              fontWeight: activeId === section.id ? 'bold' : 'normal',
              borderRadius: '6px',
              backgroundColor: activeId === section.id ? 'var(--hover-bg, #f5f5f5)' : 'transparent',
              transition: 'all 0.2s ease'
            }}
          >
            {section.title}
          </a>
        ))}
      </nav>

      {/* Content Area */}
      <main style={{
        flex: 1,
        padding: '3rem 4rem',
        maxWidth: '800px',
        lineHeight: 1.6
      }}>
        <h1>{SECTIONS.find(s => s.id === activeId)?.title}</h1>
        <div style={{ marginTop: '2rem', fontSize: '1.1rem' }}>
          <p>Coming soon</p>
        </div>
      </main>
    </div>
  );
}
