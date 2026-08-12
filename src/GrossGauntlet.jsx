import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import GrossGauntletApp from './components/GrossGauntlet/GrossGauntletApp';
import GrossGauntletControl from './components/GrossGauntlet/GrossGauntletControl';

const rootElement = document.getElementById('root');

if (rootElement) {
  // Simple client-side routing
  const path = window.location.pathname;
  
  let componentToRender;

  if (path.includes('/controls') || window.location.search.includes('controls')) {
    componentToRender = <GrossGauntletControl />;
  } else if (path.includes('overlays/explain')) {
    componentToRender = <GrossGauntletApp displayMode="explain" />;
  } else if (path.includes('overlays/break')) {
    componentToRender = <GrossGauntletApp displayMode="break" />;
  } else if (path.includes('overlays/work')) {
    componentToRender = <GrossGauntletApp displayMode="work" />;
  } else if (path.includes('overlays/standby')) {
    componentToRender = <GrossGauntletApp displayMode="standby" />;
  } else {
    // Default fallback
    componentToRender = <div style={{ color: 'white', padding: '20px' }}>Please specify an overlay path like /GrossGauntlet/overlays/work, /GrossGauntlet/overlays/explain, /GrossGauntlet/overlays/break, or /GrossGauntlet/controls</div>;
  }

  createRoot(rootElement).render(
    <StrictMode>
      {componentToRender}
    </StrictMode>
  );
} else {
  console.error('Failed to find root element');
}
