import { z } from 'zod';

/**
 * Zod schema for POST /senders request body.
 *
 * NOTE: `userId` is intentionally excluded from this schema.
 * The authenticated user's ID is sourced exclusively from req.user.id
 * (the server-side session) inside the controller.
 */
export const createSenderSchema = z.object({
  email: z.string().email('Invalid email address format'),
  smtpHost: z.string().min(1, 'smtpHost must not be empty').optional(),
  smtpPort: z.coerce.number().int().positive('smtpPort must be a positive integer').optional(),
  smtpUser: z.string().min(1, 'smtpUser is required'),
  smtpPassword: z.string().min(1, 'smtpPassword is required'),
});

export type CreateSenderPayload = z.infer<typeof createSenderSchema>;
