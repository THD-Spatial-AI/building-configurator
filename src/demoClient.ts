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

import { createFetchHttpClient, HttpError, type HttpClient, type RequestOptions } from './app/lib/http';
import { devLogin } from './app/lib/enerplanetApi';

/** Unwrapped, so a failed login cannot trigger the re-login below. */
const baseHttp = createFetchHttpClient();

let session: Promise<void> | null = null;

/**
 * Logs in again and repeats the request once when the backend reports no
 * session.
 *
 * The session is established once per page load and the backend expires it on
 * its own schedule, so without this a page left open long enough answers every
 * later request with a 401 and only a reload recovers it.
 */
async function retryOnExpiredSession<T>(send: () => Promise<T>): Promise<T> {
  try {
    return await send();
  } catch (err) {
    if (!(err instanceof HttpError) || err.status !== 401) throw err;
    session = null;
    await ensureDemoSession();
    return send();
  }
}

/** Module constant, so the provider's clients are built once. */
export const demoHttp: HttpClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    retryOnExpiredSession<T>(() => baseHttp.get<T>(path, options)),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    retryOnExpiredSession<T>(() => baseHttp.post<T>(path, body, options)),
};

/**
 * Logs in with the local development seed account, holding one login for every
 * caller until the session is discarded above.
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
        await devLogin(baseHttp, email, password);
      } catch (err) {
        console.error('[demo] login failed', err);
      }
    })();
  }
  return session;
}
