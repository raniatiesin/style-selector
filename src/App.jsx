import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useQuizStore } from './store/quizStore';
import Background from './components/Background/Background';
import Welcome from './components/Welcome/Welcome';
import Quiz from './components/Quiz/Quiz';
import OutputScreen from './components/Output/OutputScreen';
import Confirmation from './components/Confirmation/Confirmation';

export default function App() {
  const canvasRef = useRef(null);
  const screen = useQuizStore(s => s.screen);
  const welcomePanel = useQuizStore(s => s.welcomePanel);
  const currentStep = useQuizStore(s => s.currentStep);
  const activeImageIds = useQuizStore(s => s.activeImageIds);
  const blurred = screen === 'output' || screen === 'confirmation' || (screen === 'welcome' && welcomePanel === 'faq');
  const isOutputVisible = screen === 'output';
  const showCard1 = screen === 'quiz' && currentStep === 0;
  const showCard2 = screen === 'quiz' && currentStep === 1;
  const showCard3 = screen === 'quiz' && currentStep === 2;

  useEffect(() => {
    const el = document.getElementById('app-loading');
    if (!el) return;
    gsap.to(el, { opacity: 0, duration: 0.4, ease: 'power2.in', delay: 0.1, onComplete: () => el.remove() });
  }, []);

  return (
    <>
      <Background
        ref={canvasRef}
        imageIds={activeImageIds}
        blurred={blurred}
        isOutputVisible={isOutputVisible}
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
