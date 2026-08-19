/**
 * sender.ts — Frontend TypeScript types for the Sender API.
 *
 * Derived from GET /senders, POST /senders, and POST /senders/:id/verify backend responses.
 */

export type SenderVerificationStatus = 'PENDING' | 'VERIFIED' | 'FAILED';

export interface SenderItem {
  id: string;
  email: string;
  createdAt: string;
  verificationStatus: SenderVerificationStatus;
  verifiedAt: string | null;
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

export interface VerifySenderResponse {
  status: 'success';
  data: {
    verified: boolean;
    message: string;
  };
}
