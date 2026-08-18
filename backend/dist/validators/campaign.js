"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCampaignSchema = void 0;
const zod_1 = require("zod");
exports.createCampaignSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, 'userId is required'),
    senderId: zod_1.z.string().min(1, 'senderId is required'),
    subject: zod_1.z.string().min(1, 'subject is required'),
    body: zod_1.z.string().min(1, 'body is required'),
    startTime: zod_1.z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'startTime must be a valid date timestamp',
    }),
    delaySeconds: zod_1.z.coerce.number().int().nonnegative('delaySeconds must be a non-negative integer'),
    hourlyLimit: zod_1.z.coerce.number().int().positive('hourlyLimit must be a positive integer'),
    recipients: zod_1.z
        .array(zod_1.z.string().email('Invalid email address format'))
        .nonempty('recipients list cannot be empty'),
    forceFailAttempts: zod_1.z.coerce.number().int().nonnegative().optional(),
});
