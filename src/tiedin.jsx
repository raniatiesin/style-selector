import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css'; // Reuse existing styles
import TiedInApp from './components/TiedIn/TiedInApp';
import TiedInControl from './components/TiedIn/TiedInControl';

const rootElement = document.getElementById('root');

if (rootElement) {
  // Simple client-side routing
  const path = window.location.pathname;
  
  let componentToRender;
  
  if (path.includes('/control') || window.location.search.includes('control')) {
    componentToRender = <TiedInControl />;
  } else if (path.includes('explain')) {
    componentToRender = <TiedInApp displayMode="explain" />;
  } else if (path.includes('break')) {
    componentToRender = <TiedInApp displayMode="break" />;
  } else if (path.includes('work')) {
    componentToRender = <TiedInApp displayMode="work" />;
  } else {
    // Default fallback
    componentToRender = <div style={{ color: 'white', padding: '20px' }}>Please specify an overlay path like /tiedin/work, /tiedin/explain, or /tiedin/break</div>;
  }
  
  createRoot(rootElement).render(
    <StrictMode>
      {componentToRender}
    </StrictMode>
  );
} else {
  console.error('Failed to find root element');
}
