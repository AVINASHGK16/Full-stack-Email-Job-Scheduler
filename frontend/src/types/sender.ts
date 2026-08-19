/**
 * sender.ts — Frontend TypeScript types for the Sender API.
 *
 * Derived from GET /senders backend response.
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
