import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// Dedicated email-scheduler queue instance
export const emailQueue = new Queue('email-scheduler', {
  connection: redisConnection,
});

emailQueue.on('error', (err) => {
  console.error('❌ Email Queue Error:', err);
});
