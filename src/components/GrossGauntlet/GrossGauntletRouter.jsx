import { Routes, Route } from 'react-router-dom';
import LogIndex from './LogIndex';
import LogView from './LogView';
import SessionView from './SessionView';

export default function GrossGauntletRouter() {
  return (
    <Routes>
      <Route path="/Logs" element={<LogIndex />} />
      <Route path="/Logs/:n" element={<LogView />} />
      <Route path="/Logs/:n/:slug" element={<SessionView />} />
    </Routes>
  );
}
