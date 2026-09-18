/**
 * Transport for running this component as its own application.
 *
 * Not part of the published package. An application hosting the component
 * passes its own configured client to BuildingConfiguratorProvider instead;
 * this file exists so the component can be developed and exercised against a
 * local EnerPlanET backend without one.
 *
 * Requests are relative, so Vite's dev proxy (see vite.config.ts) carries them
 * to the backend and the browser stays same-origin with it. Its session and
 * csrf_token cookies would otherwise be third-party cookies a browser may
 * refuse to store.
 */

import { createFetchHttpClient } from './app/lib/http';
import { devLogin } from './app/lib/enerplanetApi';

/** Module constant, so the provider's clients are built once. */
export const demoHttp = createFetchHttpClient();

let session: Promise<void> | null = null;

/**
 * Logs in with the local development seed account, once per page load.
 *
 * Every call in this app needs the session it establishes, so failure is
 * logged rather than thrown: the individual requests then fail with their own
 * 401, which says more about what went wrong than an empty screen would.
 */
export function ensureDemoSession(): Promise<void> {
  if (!session) {
    session = (async () => {
      const email = import.meta.env.VITE_ENERPLANET_DEV_EMAIL as string | undefined;
      const password = import.meta.env.VITE_ENERPLANET_DEV_PASSWORD as string | undefined;
      if (!email || !password) {
        console.error('[demo] VITE_ENERPLANET_DEV_EMAIL/PASSWORD not set in .env.local');
        return;
      }
      try {
        await devLogin(demoHttp, email, password);
      } catch (err) {
        console.error('[demo] login failed', err);
      }
    })();
  }
  return session;
}
