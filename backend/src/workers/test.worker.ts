import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';

export const testWorker = new Worker(
  'email-scheduler-test',
  async (job: Job) => {
    console.log(`👷 Worker started processing job ${job.id}`);
    console.log(`📦 Job Data:`, JSON.stringify(job.data, null, 2));
    console.log(`✅ Job ${job.id} executed successfully!`);
    return { success: true };
  },
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

testWorker.on('completed', (job) => {
  console.log(`🎉 Job ${job.id} completed successfully`);
});

testWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed with error:`, err);
});

testWorker.on('error', (err) => {
  console.error(`💥 Worker Error:`, err);
});
