import { createRoot } from 'react-dom/client';
import { loadAllData } from './utils/dataCache';
import { preloadImagesAsync } from './utils/preloader';
import { WELCOME_IMAGE_IDS } from './config/welcome-images';
import { DESKTOP_SLOTS, MOBILE_SLOTS } from './config/generateSlots';
import App from './App';
import './styles/global.css';

function preloadWelcomeImages() {
  // computeAssignment maps images by index, so only the first slotCount images
  // are ever rendered. Preload exactly those — no wasted requests.
  const slotCount = window.innerWidth >= 768 ? DESKTOP_SLOTS.length : MOBILE_SLOTS.length;
  const toPreload = WELCOME_IMAGE_IDS.slice(0, slotCount);
  return preloadImagesAsync(toPreload, { threshold: 1.0, maxMs: 2500 });
}

createRoot(document.getElementById('root')).render(<App />);

Promise.all([
  loadAllData(),
  preloadWelcomeImages(),
]).catch(console.error);
