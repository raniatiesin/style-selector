import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import GrossGauntletApp from './components/GrossGauntlet/GrossGauntletApp';
import GrossGauntletControl from './components/GrossGauntlet/GrossGauntletControl';

function dismissLoadingScreen() {
  const el = document.getElementById('app-loading');
  if (!el) return;
  // Simple CSS transition — no gsap dependency needed here
  el.style.transition = 'opacity 0.3s ease';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 350);
}

function renderOverlay(element) {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Failed to find root element');
    return;
  }
  createRoot(rootElement).render(
    <StrictMode>{element}</StrictMode>
  );
  setTimeout(dismissLoadingScreen, 100);
}

const path = window.location.pathname;

if (path.includes('overlays/explain')) {
  renderOverlay(<GrossGauntletApp displayMode="explain" />);
} else if (path.includes('overlays/break')) {
  renderOverlay(<GrossGauntletApp displayMode="break" />);
} else if (path.includes('overlays/work')) {
  renderOverlay(<GrossGauntletApp displayMode="work" />);
} else if (path.includes('overlays/standby')) {
  renderOverlay(<GrossGauntletApp displayMode="standby" />);
} else if (path.includes('/controls') || window.location.search.includes('controls')) {
  renderOverlay(<GrossGauntletControl />);
}