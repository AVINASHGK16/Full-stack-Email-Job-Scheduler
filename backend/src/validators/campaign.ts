import { z } from 'zod';

/**
 * Zod schema for POST /campaigns request body.
 *
 * NOTE: `userId` is intentionally excluded from this schema.
 * The authenticated user's ID is sourced exclusively from req.user.id
 * (the server-side session) inside the controller. Accepting it from the
 * client would allow identity tampering.
 */
export const createCampaignSchema = z.object({
  senderId: z.string().min(1, 'senderId is required'),
  subject: z.string().min(1, 'subject is required'),
  body: z.string().min(1, 'body is required'),
  startTime: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'startTime must be a valid date timestamp',
  }),
  delaySeconds: z.coerce.number().int().nonnegative('delaySeconds must be a non-negative integer'),
  hourlyLimit: z.coerce.number().int().nonnegative('hourlyLimit must be a non-negative integer'),
  recipients: z
    .array(z.string().email('Invalid email address format'))
    .nonempty('recipients list cannot be empty'),
  forceFailAttempts: z.coerce.number().int().nonnegative().optional(),
});

export type CreateCampaignPayload = z.infer<typeof createCampaignSchema>;

