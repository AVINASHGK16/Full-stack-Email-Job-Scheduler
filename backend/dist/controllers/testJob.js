"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestJob = void 0;
const zod_1 = require("zod");
const test_queue_1 = require("../queues/test.queue");
const testJobSchema = zod_1.z.object({
    delay: zod_1.z.coerce.number().int().nonnegative().default(0),
});
/**
 * Controller to add a delayed test job to BullMQ.
 */
const createTestJob = async (req, res, next) => {
    try {
        const parsed = testJobSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                status: 'error',
                message: 'Invalid request body',
                errors: parsed.error.format(),
            });
            return;
        }
        const { delay } = parsed.data;
        // Enqueue the job with the specified delay in milliseconds
        const job = await test_queue_1.testQueue.add('test-job', {
            message: 'Hello World from Antigravity!',
            createdAt: new Date().toISOString(),
            delay,
        }, {
            delay,
        });
        res.status(201).json({
            status: 'success',
            jobId: job.id,
            name: job.name,
            delay,
            scheduledAt: new Date(Date.now() + delay).toISOString(),
        });
    }
    catch (error) {
        next(error);
    }
};
exports.createTestJob = createTestJob;
