import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Aggressively clear any stale/lingering Service Workers and Cache Storages to prevent offline caching issues
if (typeof window !== "undefined") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log("Stale Service Worker unregistered successfully.");
            window.location.reload();
          }
        });
      }
    }).catch((err) => console.error("Error unregistering service worker:", err));
  }

  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        caches.delete(key).then((success) => {
          if (success) {
            console.log(`Cache storage '${key}' cleared successfully.`);
          }
        });
      });
    }).catch((err) => console.error("Error clearing caches:", err));
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
