/**
 * Service worker registration with automatic updates.
 *
 * The generated sw.js already calls skipWaiting/clientsClaim, so a new
 * version takes control as soon as it's installed, but the page keeps
 * running the old code until it reloads. An installed PWA on Android is
 * rarely closed, and the browser only looks for a new sw.js on navigation,
 * so drivers could stay on an old version for days. Here we:
 *   - check for a new version every 30 min and whenever the app comes back
 *     to the foreground;
 *   - once the new version controls the page, reload when the driver isn't
 *     looking (page hidden), so nothing disappears under their finger.
 */

const UPDATE_CHECK_MS = 30 * 60 * 1000;

export function registerServiceWorker(): void {
  // The dev server has no sw.js.
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  // Without a controller this is the first install: nothing to reload.
  const hadController = !!navigator.serviceWorker.controller;
  let reloadPending = false;
  let reloaded = false;

  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    console.info('[SW] New version active, reloading when the app is in the background');
    if (document.visibilityState === 'hidden') {
      reload();
    } else {
      reloadPending = true;
    }
  });

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        const checkForUpdate = () => {
          registration.update().catch(() => {
            // offline or server unreachable: try again later
          });
        };

        setInterval(checkForUpdate, UPDATE_CHECK_MS);

        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            if (reloadPending) reload();
          } else {
            checkForUpdate();
          }
        });
      })
      .catch((err) => {
        console.error('[SW] Registration failed:', err);
      });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }
}
