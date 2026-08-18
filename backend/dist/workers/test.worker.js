"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const env_1 = require("../config/env");
exports.testWorker = new bullmq_1.Worker('email-scheduler-test', async (job) => {
    console.log(`👷 Worker started processing job ${job.id}`);
    console.log(`📦 Job Data:`, JSON.stringify(job.data, null, 2));
    console.log(`✅ Job ${job.id} executed successfully!`);
    return { success: true };
}, {
    connection: redis_1.redisConnection,
    concurrency: env_1.env.WORKER_CONCURRENCY,
});
exports.testWorker.on('completed', (job) => {
    console.log(`🎉 Job ${job.id} completed successfully`);
});
exports.testWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed with error:`, err);
});
exports.testWorker.on('error', (err) => {
    console.error(`💥 Worker Error:`, err);
});
