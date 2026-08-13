import { Routes, Route } from 'react-router-dom';
import LogIndex from './LogIndex';
import LogView from './LogView';
import SessionView from './SessionView';
import TasksEditor from './TasksEditor';
import TasksHistorical from './TasksHistorical';
import ReplayScrubber from './ReplayScrubber';
import TasksOverlay from './TasksOverlay';

export default function GrossGauntletRouter() {
  return (
    <Routes>
      <Route path="/Logs" element={<LogIndex />} />
      <Route path="/Logs/:n" element={<LogView />} />
      <Route path="/Logs/:n/:slug" element={<SessionView />} />
      <Route path="/tasks" element={<TasksEditor />} />
      <Route path="/tasks/:streamNumber/replay" element={<ReplayScrubber />} />
      <Route path="/tasks/:streamNumber" element={<TasksHistorical />} />
      <Route path="/overlay/tasks" element={<TasksOverlay />} />
    </Routes>
  );
}
