import { Routes, Route } from 'react-router-dom';
import GrossGauntletHome from './GrossGauntletHome';
import GrossGauntletDay from './GrossGauntletDay';
import GrossGauntletSession from './GrossGauntletSession';
import GrossGauntletNow from './GrossGauntletNow';
import ReplayScrubber from './ReplayScrubber';

export default function GrossGauntletRouter() {
  return (
    <Routes>
      <Route path="/grossgauntlet" element={<GrossGauntletHome />} />
      <Route path="/grossgauntlet/now" element={<GrossGauntletNow />} />
      <Route path="/grossgauntlet/:date" element={<GrossGauntletDay />} />
      <Route path="/grossgauntlet/:date/:sessionNumber" element={<GrossGauntletSession />} />
      <Route path="/grossgauntlet/:date/:sessionNumber/replay" element={<ReplayScrubber />} />
    </Routes>
  );
}
