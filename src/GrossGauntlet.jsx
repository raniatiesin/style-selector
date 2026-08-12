import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LogIndex from './components/GrossGauntlet/LogIndex';
import LogView from './components/GrossGauntlet/LogView';
import SessionView from './components/GrossGauntlet/SessionView';
import TasksEditor from './components/GrossGauntlet/TasksEditor';
import ReplayScrubber from './components/GrossGauntlet/ReplayScrubber';
import TasksOverlay from './components/GrossGauntlet/TasksOverlay';
import GrossGauntletApp from './components/GrossGauntlet/GrossGauntletApp';
import GrossGauntletControl from './components/GrossGauntlet/GrossGauntletControl';

const rootElement = document.getElementById('root');

if (rootElement) {
  const path = window.location.pathname;

  // Legacy OBS overlay paths — render the original GrossGauntletApp
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
  } else if (path.includes('/controls') || window.location.search.includes('controls')) {
    createRoot(rootElement).render(
      <StrictMode>
        <GrossGauntletControl />
      </StrictMode>
    );
  } else {
    // New router-based paths — render all new routes
    createRoot(rootElement).render(
      <StrictMode>
        <BrowserRouter>
          <Routes>
            <Route path="/grossgauntlet" element={<LogIndex />} />
            <Route path="/grossgauntlet/log:logNumber" element={<LogView />} />
            <Route path="/grossgauntlet/log:logNumber/:slug" element={<SessionView />} />
            <Route path="/tasks" element={<TasksEditor />} />
            <Route path="/tasks/:slug/replay" element={<ReplayScrubber />} />
            <Route path="/overlay/tasks" element={<TasksOverlay />} />
            <Route path="*" element={<Navigate to="/grossgauntlet" replace />} />
          </Routes>
        </BrowserRouter>
      </StrictMode>
    );
  }
} else {
  console.error('Failed to find root element');
}