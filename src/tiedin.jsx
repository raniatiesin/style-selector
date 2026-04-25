import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TiedInApp from './components/TiedIn/TiedInApp';
import TiedInControl from './components/TiedIn/TiedInControl';

const rootElement = document.getElementById('root');

if (rootElement) {
  // Simple client-side routing
  const path = window.location.pathname;
  
  let componentToRender;

  if (path.includes('/controls') || window.location.search.includes('controls')) {
    componentToRender = <TiedInControl />;
  } else if (path.includes('overlays/explain')) {
    componentToRender = <TiedInApp displayMode="explain" />;
  } else if (path.includes('overlays/break')) {
    componentToRender = <TiedInApp displayMode="break" />;
  } else if (path.includes('overlays/work')) {
    componentToRender = <TiedInApp displayMode="work" />;
  } else if (path.includes('overlays/standby')) {
    componentToRender = <TiedInApp displayMode="standby" />;
  } else {
    // Default fallback
    componentToRender = <div style={{ color: 'white', padding: '20px' }}>Please specify an overlay path like /tiedin/overlays/work, /tiedin/overlays/explain, /tiedin/overlays/break, or /tiedin/controls</div>;
  }

  createRoot(rootElement).render(
    <StrictMode>
      {componentToRender}
    </StrictMode>
  );
} else {
  console.error('Failed to find root element');
}
