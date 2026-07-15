/**
 * Client configuration. All backend calls go to the same-origin Next route
 * handlers under /api, which proxy to the Railway server (see app/api/*). This
 * keeps the Railway URL server-side and avoids any CORS setup.
 */
export const API_BASE = '/api';
