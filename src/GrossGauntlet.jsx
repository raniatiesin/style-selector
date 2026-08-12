import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TasksOverlay from './components/GrossGauntlet/TasksOverlay';
import GrossGauntletApp from './components/GrossGauntlet/GrossGauntletApp';
import GrossGauntletControl from './components/GrossGauntlet/GrossGauntletControl';

const rootElement = document.getElementById('root');

if (rootElement) {
  const path = window.location.pathname;

  if (path.includes('overlays/explain')) {
    createRoot(rootElement).render(
      <StrictMode>
        <GrossGauntletApp displayMode="explain" />
      </StrictMode>
    );
  } else if (path.includes('overlays/break')) {
    createRoot(rootElement).render(
      <StrictMode>
        <GrossGauntletApp displayMode="break" />
      </StrictMode>
    );
  } else if (path.includes('overlays/work')) {
    createRoot(rootElement).render(
      <StrictMode>
        <GrossGauntletApp displayMode="work" />
      </StrictMode>
    );
  } else if (path.includes('overlays/standby')) {
    createRoot(rootElement).render(
      <StrictMode>
        <GrossGauntletApp displayMode="standby" />
      </StrictMode>
    );
  } else if (path.includes('overlays/tasks')) {
    createRoot(rootElement).render(
      <StrictMode>
        <TasksOverlay />
      </StrictMode>
    );
  } else if (path.includes('/controls') || window.location.search.includes('controls')) {
    createRoot(rootElement).render(
      <StrictMode>
        <GrossGauntletControl />
      </StrictMode>
    );
  }
} else {
  console.error('Failed to find root element');
}
