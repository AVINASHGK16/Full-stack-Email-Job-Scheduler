"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
exports.testQueue = new bullmq_1.Queue('email-scheduler-test', {
    connection: redis_1.redisConnection,
});
exports.testQueue.on('error', (err) => {
    console.error('❌ Test Queue Error:', err);
});
