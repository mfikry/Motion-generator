import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { useGenerationStore } from './store/generationStore';

import { SandboxedCodeExecutor } from './sandbox/sandboxed-code-executor';
import { validateCodeWithDryRun } from './sandbox/pixel-loop-validator';

// Setup sandboxed dry-run validator for IPC code validation from AI Architect
const dryRunExecutor = new SandboxedCodeExecutor({ defaultTimeoutMs: 50 });
dryRunExecutor.warmup();
window.__sandboxedValidator = {
  validate: (code: string) => validateCodeWithDryRun(dryRunExecutor, code),
};

import { SPIRAL_GALAXY_CODE } from './fixtures/demo-spiral';

if (import.meta.env.DEV) {
  (window as unknown as { __motionTest?: unknown }).__motionTest = {
    useGenerationStore,
    SPIRAL_GALAXY_CODE,
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
