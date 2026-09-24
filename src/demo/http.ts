/**
 * The transport contract between this component and whichever application
 * hosts it.
 *
 * Paths passed to an HttpClient are relative to the EnerPlanET API root, so
 * `/v2/ignis/fields`, never `/api/v2/ignis/fields` and never an absolute URL.
 * Origin, the `/api` prefix, credentials, CSRF and session renewal all belong
 * to the host: EnerPlanET already solves them in its own configured client,
 * and a component that reads them from its own environment cannot be
 * installed into an application that solves them differently.
 */

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
}

/** Carries the status code so callers can tell "no such variant" from "service down". */
export class HttpError extends Error {
  constructor(readonly status: number, readonly path: string, readonly body: string) {
    super(`${path} failed: HTTP ${status}${body ? ` ${body}` : ''}`);
    this.name = 'HttpError';
  }
}

export interface FetchHttpClientOptions {
  /** Prefixed to every path. Defaults to `/api`, which is where EnerPlanET mounts its API. */
  baseUrl?: string;
  /** Read for the CSRF double-submit header. Defaults to the browser's cookies. */
  readCookie?: (name: string) => string | null;
}

function browserCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * An HttpClient over `fetch` for hosts that do not already have a configured
 * client, which in practice means standalone development against a local
 * EnerPlanET backend. It sends cookies and the CSRF double-submit header on
 * writes; it does not refresh an expired session, so an application with its
 * own client should pass that instead.
 */
export function createFetchHttpClient(options: FetchHttpClientOptions = {}): HttpClient {
  const baseUrl = options.baseUrl ?? '/api';
  const readCookie = options.readCookie ?? browserCookie;

  async function send<T>(method: string, path: string, body?: unknown, requestOptions?: RequestOptions): Promise<T> {
    const headers = new Headers();
    if (body !== undefined) headers.set('Content-Type', 'application/json');

    // Only mutating requests are checked, and only once a csrf_token cookie
    // exists (issued by /csrf-token or any response after login).
    if (method !== 'GET') {
      const token = readCookie('csrf_token');
      if (token) headers.set('X-CSRF-Token', token);
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requestOptions?.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, path, text);
    // Endpoints that exist only for their Set-Cookie header answer with no body.
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    get: (path, requestOptions) => send('GET', path, undefined, requestOptions),
    post: (path, body, requestOptions) => send('POST', path, body, requestOptions),
  };
}
