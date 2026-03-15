import { useEffect } from 'react';
import gsap from 'gsap';
import { useQuizStore } from './store/quizStore';
import Background from './components/Background/Background';
import Welcome from './components/Welcome/Welcome';
import Quiz from './components/Quiz/Quiz';
import OutputScreen from './components/Output/OutputScreen';
import Confirmation from './components/Confirmation/Confirmation';

export default function App() {
  const screen = useQuizStore(s => s.screen);
  const activeImageIds = useQuizStore(s => s.activeImageIds);
  const blurred = screen === 'output' || screen === 'confirmation';
  const isOutputVisible = screen === 'output';

  useEffect(() => {
    const el = document.getElementById('app-loading');
    if (!el) return;
    gsap.to(el, { opacity: 0, duration: 0.4, ease: 'power2.in', delay: 0.1, onComplete: () => el.remove() });
  }, []);

  return (
    <>
      <Background imageIds={activeImageIds} blurred={blurred} isOutputVisible={isOutputVisible} />
      {screen === 'welcome' && <Welcome />}
      {screen === 'quiz' && <Quiz />}
      {screen === 'output' && <OutputScreen />}
      {screen === 'confirmation' && <Confirmation />}
    </>
  );
}
