/**
 * Centralised API configuration.
 *
 * VITE_API_BASE_URL is read from the .env file at build time.
 * All API calls in later phases should import from this module
 * rather than hard-coding the backend URL.
 *
 * Example .env:
 *   VITE_API_BASE_URL=http://localhost:5000
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
