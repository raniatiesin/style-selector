import { Routes, Route, Navigate } from 'react-router-dom';
import LogIndex from './LogIndex';
import LogView from './LogView';
import SessionView from './SessionView';
import TasksEditor from './TasksEditor';
import ReplayScrubber from './ReplayScrubber';
import TasksOverlay from './TasksOverlay';

export default function GrossGauntletRouter() {
  return (
    <Routes>
      {/* Master Log Index – displays all records sequentially */}
      <Route path="/grossgauntlet" element={<LogIndex />} />

      {/* Single Log View – with session selector if multi-session */}
      <Route path="/grossgauntlet/log:logNumber" element={<LogView />} />

      {/* Exact Session View – permanent read-only, ignores auth */}
      <Route path="/grossgauntlet/log:logNumber/:slug" element={<SessionView />} />

      {/* Current Live Editor – editable if streaming AND unlocked */}
      <Route path="/tasks" element={<TasksEditor />} />

      {/* Phase 2 Event Replay – read-only timeline scrubber */}
      <Route path="/tasks/:slug/replay" element={<ReplayScrubber />} />

      {/* Isolated OBS Overlay – read-only, polls, no dnd-kit */}
      <Route path="/overlay/tasks" element={<TasksOverlay />} />

      {/* Redirect old /grossgauntlet paths to new routing */}
      <Route path="/grossgauntlet/*" element={<Navigate to="/grossgauntlet" replace />} />
    </Routes>
  );
}