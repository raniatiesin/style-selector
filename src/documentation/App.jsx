import { useState, useEffect, useRef } from 'react';
import '../styles/global.css';
import styles from './App.module.css';
import Background from '../components/Background/Background';
import { WELCOME_IMAGE_IDS } from '../config/welcome-images';

const SIDEBAR_STRUCTURE = [
  {
    id: 'peripherals',
    title: '0 — Peripherals',
    pages: [{ id: 'overview', title: 'Overview', path: '/tiedin/peripherals' }]
  },
  {
    id: 'playbook',
    title: '1 — Playbook',
    pages: [{ id: 'overview', title: 'Overview', path: '/tiedin/playbook' }]
  },
  {
    id: 'prospecting',
    title: '2 — Prospecting',
    pages: [{ id: 'overview', title: 'Overview', path: '/tiedin/prospecting' }]
  },
  {
    id: 'production',
    title: '3 — Production',
    pages: [{ id: 'overview', title: 'Overview', path: '/tiedin/production' }]
  },
  {
    id: 'progression',
    title: '4 — Progression',
    pages: [{ id: 'overview', title: 'Overview', path: '/tiedin/progression' }]
  }
];

export default function DocsApp() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    setIsMobileMenuOpen(false);
  };

  // Determine active section and page
  let activeSection = null;
  let activePage = null;

  for (const section of SIDEBAR_STRUCTURE) {
    const foundPage = section.pages.find(p => p.path === currentPath);
    if (foundPage) {
      activeSection = section;
      activePage = foundPage;
      break;
    }
  }

  // Fallback to first page if nothing matches perfectly
  if (!activeSection) {
    const pathSegments = currentPath.split('/').filter(Boolean);
    const possibleSectionId = pathSegments[pathSegments.length - 1];
    activeSection = SIDEBAR_STRUCTURE.find(s => s.id === possibleSectionId) || SIDEBAR_STRUCTURE[0];
    activePage = activeSection.pages[0];
  }

  // Find previous and next pages
  const allPages = SIDEBAR_STRUCTURE.flatMap(s => s.pages);
  const activePageIndex = allPages.findIndex(p => p.path === activePage.path);
  const prevPage = activePageIndex > 0 ? allPages[activePageIndex - 1] : null;
  const nextPage = activePageIndex < allPages.length - 1 ? allPages[activePageIndex + 1] : null;

  const canvasRef = useRef(null);

  return (
    <div className={styles.layout}>
      <Background
        ref={canvasRef}
        imageIds={WELCOME_IMAGE_IDS}
        blurred={true}
        isOutputVisible={false}
        rapidSwapActive={false}
      />
      {/* Top Bar */}
      <header className={styles.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            className={styles.menuButton}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <a 
            href="/tiedin" 
            className={styles.logo}
            onClick={(e) => { e.preventDefault(); navigate('/tiedin/' + SIDEBAR_STRUCTURE[0].id); }}
          >
            Tiesin
          </a>
        </div>
        <div>
          {/* Optional search placeholder */}
        </div>
      </header>

      {/* Mobile Overlay */}
      <div 
        className={`${styles.overlay} ${isMobileMenuOpen ? styles.overlayOpen : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <nav className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
        {SIDEBAR_STRUCTURE.map((section) => (
          <div key={section.id} className={styles.section}>
            <div className={styles.sectionTitle}>{section.title}</div>
            {section.pages.map((page) => {
              const isActive = activePage.path === page.path;
              return (
                <a
                  key={page.id}
                  href={page.path}
                  className={`${styles.link} ${isActive ? styles.linkActive : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(page.path);
                  }}
                >
                  {page.title}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Content Area */}
      <main className={styles.main}>
        <div key={activePage.path} className={styles.contentContainer}>
          <h1>{activeSection.title.split('—')[1]?.trim() || activeSection.title}</h1>
          <p>Coming soon</p>
          
          <div className={styles.pageNav}>
            {prevPage ? (
              <a 
                href={prevPage.path} 
                className={styles.navLink}
                onClick={(e) => { e.preventDefault(); navigate(prevPage.path); }}
              >
                <span className={styles.navLabel}>Previous</span>
                <span className={styles.navTitle}>{prevPage.title}</span>
              </a>
            ) : <div />}
            
            {nextPage ? (
              <a 
                href={nextPage.path} 
                className={`${styles.navLink} ${styles.navLinkNext}`}
                onClick={(e) => { e.preventDefault(); navigate(nextPage.path); }}
              >
                <span className={styles.navLabel}>Next</span>
                <span className={styles.navTitle}>{nextPage.title}</span>
              </a>
            ) : <div />}
          </div>
        </div>
      </main>
    </div>
  );
}
