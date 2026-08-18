import { z } from 'zod';

export const createCampaignSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
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
