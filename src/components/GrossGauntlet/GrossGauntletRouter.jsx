import { Routes, Route } from 'react-router-dom';
import GrossGauntletShell from './GrossGauntletShell';
import GrossGauntletHome from './GrossGauntletHome';
import GrossGauntletDay from './GrossGauntletDay';
import GrossGauntletSession from './GrossGauntletSession';
import GrossGauntletNow from './GrossGauntletNow';

export default function GrossGauntletRouter() {
  return (
    <Routes>
      <Route path="/grossgauntlet" element={<GrossGauntletShell><GrossGauntletHome /></GrossGauntletShell>} />
      <Route path="/grossgauntlet/now" element={<GrossGauntletNow />} />
      <Route path="/grossgauntlet/:dayNumber" element={<GrossGauntletShell><GrossGauntletDay /></GrossGauntletShell>} />
      <Route path="/grossgauntlet/:dayNumber/:sessionNumber" element={<GrossGauntletSession />} />
    </Routes>
  );
}
