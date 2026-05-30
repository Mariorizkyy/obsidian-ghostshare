// ── Node polyfills for browser (eciesjs + ethers need Buffer/global) ──
import { Buffer } from 'buffer';
if (typeof window !== 'undefined') {
  (window as any).Buffer  = Buffer;
  (window as any).global  = window;
  (window as any).process = { env: {}, version: '', versions: {} };
}

import { StrictMode } from 'react';
import { createRoot }  from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
