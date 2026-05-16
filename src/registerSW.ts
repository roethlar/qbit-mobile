import { registerSW } from 'virtual:pwa-register';

// autoUpdate handles reload-on-new-build via vite-plugin-pwa. We just
// register so the service worker picks up the precache manifest at first
// page load.
registerSW({ immediate: true });
