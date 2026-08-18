"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const env_1 = require("../config/env");
// Dedicated email-scheduler queue instance
exports.emailQueue = new bullmq_1.Queue('email-scheduler', {
    connection: redis_1.redisConnection,
    defaultJobOptions: {
        attempts: env_1.env.EMAIL_JOB_ATTEMPTS,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});
exports.emailQueue.on('error', (err) => {
    console.error('❌ Email Queue Error:', err);
});
