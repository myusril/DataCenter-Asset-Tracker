/**
 * Session bridge between the auth store and the HTTP client.
 *
 * The client must not import the store: that previously created the Metro
 * require cycle store/auth -> api/auth -> api/client -> store/auth. The store
 * and the root layout push their values in here instead, so the dependency
 * direction stays api/client -> api/session with no back edge.
 */

let sessionToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

export function getSessionToken(): string | null {
  return sessionToken;
}

/** Registered once by the root layout; kept as a seam so tests can replace it. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized(): void {
  unauthorizedHandler?.();
}
