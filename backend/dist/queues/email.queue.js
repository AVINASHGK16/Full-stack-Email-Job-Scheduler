"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
// Dedicated email-scheduler queue instance
exports.emailQueue = new bullmq_1.Queue('email-scheduler', {
    connection: redis_1.redisConnection,
});
exports.emailQueue.on('error', (err) => {
    console.error('❌ Email Queue Error:', err);
});
