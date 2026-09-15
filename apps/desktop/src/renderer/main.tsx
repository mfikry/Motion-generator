import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { useGenerationStore } from './store/generationStore';

if (import.meta.env.DEV) {
  (window as unknown as { __motionTest?: unknown }).__motionTest = {
    useGenerationStore,
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
