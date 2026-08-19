/**
 * sender.ts — Frontend TypeScript types for the Sender API.
 *
 * Derived from GET /senders and POST /senders backend responses.
 */

export interface SenderItem {
  id: string;
  email: string;
  createdAt: string;
}

export interface GetSendersResponse {
  status: 'success';
  data: SenderItem[];
}

export interface CreateSenderRequest {
  email: string;
  smtpUser: string;
  smtpPassword: string;
  smtpHost?: string;
  smtpPort?: number;
}

export interface CreateSenderResponse {
  status: 'success';
  data: SenderItem;
}
