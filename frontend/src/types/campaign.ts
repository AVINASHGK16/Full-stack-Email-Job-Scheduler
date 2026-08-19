/**
 * campaign.ts — Frontend TypeScript types for the Campaign API.
 *
 * Derived directly from:
 *  - backend/src/validators/campaign.ts (Zod schema → request shape)
 *  - backend/src/services/campaign.service.ts (return value → response shape)
 *  - backend/prisma/schema.prisma (CampaignStatus / RecipientStatus enums)
 *
 * Phase 9.6: read-only — no backend files modified.
 */

/* ── Enums (mirrors Prisma schema) ───────────────────────────────────────── */

export type CampaignStatus = 'PENDING' | 'SENDING' | 'COMPLETED' | 'PAUSED';
export type RecipientStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'FAILED';

/* ── POST /campaigns ─────────────────────────────────────────────────────── */

/**
 * Request body for POST /campaigns.
 * Maps exactly to the Zod schema `createCampaignSchema` in the backend.
 * `userId` is intentionally absent — sourced from the server-side session.
 */
export interface ScheduleCampaignRequest {
  /** UUID of an existing Sender record owned by the authenticated user. */
  senderId: string;
  subject: string;
  body: string;
  /**
   * ISO 8601 timestamp string. Must be in the future.
   * Example: "2026-08-25T09:00:00.000Z"
   */
  startTime: string;
  /** Seconds between each recipient send. 0 = send all immediately. */
  delaySeconds: number;
  /** Max emails per hour. 0 = unlimited. */
  hourlyLimit: number;
  /** Array of valid recipient email addresses. Non-empty. */
  recipients: string[];
  /** Internal testing only — forces job failures. Optional. */
  forceFailAttempts?: number;
}

/* ── Response shapes ─────────────────────────────────────────────────────── */

export interface ScheduledRecipient {
  id: string;
  email: string;
  scheduledAt: string;
  jobId: string | null;
  status: RecipientStatus;
}

export interface QueueFailure {
  id: string;
  email: string;
  error: string;
}

export interface CampaignSummary {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  status: CampaignStatus;
}

/**
 * Successful response from POST /campaigns (HTTP 201).
 * `status` is 'success', no `failures` field.
 */
export interface ScheduleCampaignSuccess {
  status: 'success';
  campaign: CampaignSummary;
  recipients: ScheduledRecipient[];
}

/**
 * Partial success response from POST /campaigns (HTTP 207).
 * Some BullMQ jobs failed to enqueue. Campaign and partial recipients still created.
 */
export interface ScheduleCampaignPartial {
  status: 'partial_success';
  campaign: CampaignSummary;
  recipients: ScheduledRecipient[];
  failures: QueueFailure[];
}

export type ScheduleCampaignResponse = ScheduleCampaignSuccess | ScheduleCampaignPartial;

/**
 * Error response shape returned by the backend on 4xx/5xx.
 */
export interface ApiErrorResponse {
  status: 'error';
  message: string;
  errors?: unknown;
}

/* ── GET /campaigns/scheduled ────────────────────────────────────────────── */

export interface ScheduledEmailItem {
  id: string;
  email: string;
  status: RecipientStatus;
  scheduledAt: string;
  jobId: string | null;
  campaignId: string;
  campaignStatus: CampaignStatus;
  subject: string;
  bodyPreview: string;
  startTime: string;
}

export interface GetScheduledEmailsResponse {
  status: 'success';
  data: ScheduledEmailItem[];
}

