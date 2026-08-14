import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useQuizStore } from './store/quizStore';
import Background from './components/Background/Background';
import Welcome from './components/Welcome/Welcome';
import Quiz from './components/Quiz/Quiz';
import OutputScreen from './components/Output/OutputScreen';
import Confirmation from './components/Confirmation/Confirmation';
import GrossGauntletRouter from './components/GrossGauntlet/GrossGauntletRouter';
import GrossGauntletApp from './components/GrossGauntlet/GrossGauntletApp';
import GrossGauntletControl from './components/GrossGauntlet/GrossGauntletControl';
import { WELCOME_IMAGE_IDS } from './config/welcome-images';

// GrossGauntlet route paths that should render the router instead of the quiz
const GROSSGAUNTLET_ROUTES = ['/grossgauntlet', '/overlay'];
const OVERLAY_ROUTES = ['/GrossGauntlet/overlays/', '/GrossGauntlet/controls'];

function isGrossGauntletRoute(pathname) {
  return GROSSGAUNTLET_ROUTES.some((route) => pathname.startsWith(route));
}

function isOverlayRoute(pathname) {
  return OVERLAY_ROUTES.some(r => pathname.includes(r));
}

export default function App() {
  const location = useLocation();
  const canvasRef = useRef(null);
  const didBootstrapRef = useRef(false);
  const screen = useQuizStore(s => s.screen);
  const welcomePanel = useQuizStore(s => s.welcomePanel);
  const currentStep = useQuizStore(s => s.currentStep);
  const activeImageIds = useQuizStore(s => s.activeImageIds);
  const isSearching = useQuizStore(s => s.isSearching);
  const outputResults = useQuizStore(s => s.outputResults);
  const bootstrapSession = useQuizStore(s => s.bootstrapSession);
  const blurred = screen === 'output' || screen === 'confirmation';
  const isOutputVisible = screen === 'output';
  const isResultFlow = screen === 'output' || screen === 'confirmation';
  const isInitialMatchLoading = screen === 'output' && isSearching && outputResults.length === 0;
  const backgroundImageIds = isResultFlow ? WELCOME_IMAGE_IDS : activeImageIds;
  const showCard1 = screen === 'quiz' && currentStep === 0;
  const showCard2 = screen === 'quiz' && currentStep === 1;
  const showCard3 = screen === 'quiz' && currentStep === 2;

  // Check if we're on a GrossGauntlet route
  const isGGRoute = isGrossGauntletRoute(location.pathname);
  const isOvlRoute = isOverlayRoute(location.pathname);

  useEffect(() => {
    const el = document.getElementById('app-loading');
    if (!el) return;
    gsap.to(el, { opacity: 0, duration: 0.4, ease: 'power2.in', delay: 0.1, onComplete: () => el.remove() });
  }, []);

  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;

    const pathname = window.location.pathname || '/';
    const extractedHandle = pathname.startsWith('/@')
      ? decodeURIComponent(pathname.slice(2)) || null
      : null;

    bootstrapSession(extractedHandle);
  }, [bootstrapSession]);

  // Render overlay components for OBS browser source paths
  if (isOvlRoute) {
    const path = location.pathname;
    if (path.includes('overlays/explain')) return <GrossGauntletApp displayMode="explain" />;
    if (path.includes('overlays/break'))   return <GrossGauntletApp displayMode="break" />;
    if (path.includes('overlays/work'))    return <GrossGauntletApp displayMode="work" />;
    if (path.includes('overlays/standby')) return <GrossGauntletApp displayMode="standby" />;
    if (path.includes('/controls'))        return <GrossGauntletControl />;
  }

  // Render GrossGauntlet router for /grossgauntlet, /tasks, /overlay paths
  if (isGGRoute) {
    return <GrossGauntletRouter />;
  }

  // Render the existing style quiz flow for all other paths
  return (
    <>
      <Background
        ref={canvasRef}
        imageIds={backgroundImageIds}
        blurred={blurred}
        isOutputVisible={isOutputVisible}
        rapidSwapActive={isInitialMatchLoading}
        showCard1={showCard1}
        showCard2={showCard2}
        showCard3={showCard3}
      />
      {screen === 'welcome' && <Welcome canvasRef={canvasRef} />}
      {screen === 'quiz' && <Quiz />}
      {screen === 'output' && <OutputScreen />}
      {screen === 'confirmation' && <Confirmation />}
    </>
  );
}