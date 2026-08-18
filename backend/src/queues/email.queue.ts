import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';

// Dedicated email-scheduler queue instance
export const emailQueue = new Queue('email-scheduler', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: env.EMAIL_JOB_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('❌ Email Queue Error:', err);
});
