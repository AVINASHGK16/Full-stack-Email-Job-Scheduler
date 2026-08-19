/**
 * api.ts — Centralised API configuration and fetch helpers.
 *
 * VITE_API_BASE_URL is read from the .env file at build time.
 * All API calls import from this module rather than hard-coding the backend URL.
 *
 * Example .env:
 *   VITE_API_BASE_URL=http://localhost:5000
 */
import type {
  ScheduleCampaignRequest,
  ScheduleCampaignResponse,
  ApiErrorResponse,
} from '../types/campaign';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

/* ── Campaigns ───────────────────────────────────────────────────────────── */

/**
 * POST /campaigns
 *
 * Schedules a new email campaign.
 * Requires an active Google OAuth session cookie (`requireAuth` middleware).
 *
 * On success (201 or 207) resolves with the parsed response body.
 * On any HTTP error rejects with an `ApiError` containing the server message.
 */
export async function scheduleCampaign(
  payload: ScheduleCampaignRequest
): Promise<ScheduleCampaignResponse> {
  const res = await fetch(`${API_BASE_URL}/campaigns`, {
    method: 'POST',
    credentials: 'include', // send the session cookie cross-origin
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    // 201 Created or 207 Multi-Status — both are considered usable responses
    return res.json() as Promise<ScheduleCampaignResponse>;
  }

  // Parse the error body for a user-facing message
  let errBody: ApiErrorResponse | null = null;
  try {
    errBody = (await res.json()) as ApiErrorResponse;
  } catch {
    // response body was not valid JSON — fall through to generic message
  }

  const message =
    errBody?.message ??
    `Request failed with status ${res.status}`;

  throw new ApiError(message, res.status);
}

/* ── Error class ─────────────────────────────────────────────────────────── */

/**
 * Structured error thrown by API helpers.
 * `statusCode` reflects the HTTP response status (401, 400, 500, etc.).
 */
export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}
