import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const testQueue = new Queue('email-scheduler-test', {
  connection: redisConnection,
});

testQueue.on('error', (err) => {
  console.error('❌ Test Queue Error:', err);
});
