import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined' && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onOfflineReady() {
      (window as unknown as { __APEX_OFFLINE_READY__?: boolean }).__APEX_OFFLINE_READY__ = true;
      window.dispatchEvent(new CustomEvent('apex-pwa-offline-ready'));
    },
    onNeedRefresh() {
      void updateSW(true);
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
