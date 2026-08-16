import { Routes, Route } from 'react-router-dom';
import GrossGauntletHome from './GrossGauntletHome';
import GrossGauntletDay from './GrossGauntletDay';
import GrossGauntletSession from './GrossGauntletSession';
import GrossGauntletNow from './GrossGauntletNow';

export default function GrossGauntletRouter() {
  return (
    <Routes>
      <Route path="/grossgauntlet" element={<GrossGauntletHome />} />
      <Route path="/grossgauntlet/now" element={<GrossGauntletNow />} />
      <Route path="/grossgauntlet/:dayNumber" element={<GrossGauntletDay />} />
      <Route path="/grossgauntlet/:dayNumber/:sessionNumber" element={<GrossGauntletSession />} />
    </Routes>
  );
}
