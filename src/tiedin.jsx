import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css'; // Reuse existing styles
import TiedInApp from './components/TiedIn/TiedInApp';

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <TiedInApp />
    </StrictMode>
  );
} else {
  console.error('Failed to find root element');
}
