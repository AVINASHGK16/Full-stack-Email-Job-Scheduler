"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailWorker = void 0;
const bullmq_1 = require("bullmq");
const db_1 = require("../db");
const redis_1 = require("../config/redis");
const env_1 = require("../config/env");
const email_service_1 = require("../services/email.service");
const rateLimit_service_1 = require("../services/rateLimit.service");
const email_queue_1 = require("../queues/email.queue");
exports.emailWorker = new bullmq_1.Worker('email-scheduler', async (job) => {
    const { recipientId } = job.data;
    console.log(`[${new Date().toISOString()}] 👷 Worker picked up job ${job.id} for Recipient ID: ${recipientId}`);
    // 1. Fetch Recipient with Campaign and Sender info
    const recipient = await db_1.prisma.recipient.findUnique({
        where: { id: recipientId },
        include: {
            campaign: {
                include: {
                    sender: true,
                },
            },
        },
    });
    if (!recipient) {
        console.warn(`⚠️ Recipient ${recipientId} not found in database. Skipping.`);
        return { skipped: true, reason: 'not_found' };
    }
    // 2. Check if already sent (Idempotency guarantee)
    if (recipient.status === 'SENT') {
        console.log(`ℹ️ Recipient ${recipient.email} is already marked SENT. Skipping.`);
        return { skipped: true, reason: 'already_sent' };
    }
    const campaign = recipient.campaign;
    const sender = campaign.sender;
    // 3. Hourly rate-limit check (sender-scoped, shared Redis counter across all workers)
    // Must happen AFTER SENT check so already-sent recipients don't consume a slot.
    const allowed = await rateLimit_service_1.RateLimitService.checkAndIncrement(sender.id, campaign.hourlyLimit);
    if (!allowed) {
        const ttl = await rateLimit_service_1.RateLimitService.getTTL(sender.id);
        const delayMs = Math.max(ttl > 0 ? ttl * 1000 : 60000, 10000);
        console.warn(`🚫 Rate limit reached for sender ${sender.id} (hourlyLimit=${campaign.hourlyLimit}). ` +
            `Job ${job.id} denied. Recipient ${recipient.email} stays QUEUED and rescheduled in ${Math.round(delayMs / 1000)}s.`);
        // Reschedule job to automatically run in the next hourly window
        await email_queue_1.emailQueue.add('send-email', { recipientId: recipient.id }, { delay: delayMs });
        return { skipped: true, reason: 'rate_limited', rescheduledInMs: delayMs };
    }
    // 4. Update Campaign status to SENDING if it is PENDING
    if (campaign.status === 'PENDING') {
        await db_1.prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: 'SENDING' },
        });
        console.log(`📈 Campaign ${campaign.id} status updated to SENDING`);
    }
    try {
        // Simulation hook for controlled testing
        const { forceFailAttempts } = job.data;
        if (forceFailAttempts && job.attemptsMade < forceFailAttempts) {
            console.log(`🧪 [TEST MODE] Simulating intentional worker failure (attempt ${job.attemptsMade + 1}/${forceFailAttempts})`);
            throw new Error(`Controlled simulation failure (attempt ${job.attemptsMade + 1})`);
        }
        console.log(`✉️ Sending email to ${recipient.email} via Ethereal SMTP...`);
        // 5. Call Nodemailer EmailService
        const result = await email_service_1.EmailService.sendEmail({
            host: env_1.env.SMTP_HOST,
            port: env_1.env.SMTP_PORT,
            user: sender.smtpUser,
            pass: sender.smtpPassword,
            from: sender.email,
            to: recipient.email,
            subject: campaign.subject,
            body: campaign.body,
        });
        console.log(`✅ SMTP Send Success for ${recipient.email}. Message ID: ${result.messageId}`);
        if (result.previewUrl) {
            console.log(`🔗 Ethereal Preview URL: ${result.previewUrl}`);
        }
        // 6. Update Recipient to SENT
        await db_1.prisma.recipient.update({
            where: { id: recipient.id },
            data: {
                status: 'SENT',
                sentAt: new Date(),
                error: null,
            },
        });
        return { success: true, messageId: result.messageId, previewUrl: result.previewUrl };
    }
    catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`❌ SMTP Send Failed for ${recipient.email} (Attempt ${job.attemptsMade + 1}):`, errorMessage);
        const maxAttempts = job.opts.attempts || env_1.env.EMAIL_JOB_ATTEMPTS;
        const isFinalAttempt = job.attemptsMade + 1 >= maxAttempts;
        if (isFinalAttempt) {
            console.error(`❌ Final attempt (${job.attemptsMade + 1}/${maxAttempts}) failed for ${recipient.email}. Marking as FAILED.`);
            // 7. Update Recipient to FAILED only on final attempt
            await db_1.prisma.recipient.update({
                where: { id: recipient.id },
                data: {
                    status: 'FAILED',
                    failedAt: new Date(),
                    error: `Final attempt failed: ${errorMessage}`,
                },
            });
        }
        else {
            console.warn(`⚠️ Intermediate attempt (${job.attemptsMade + 1}/${maxAttempts}) failed for ${recipient.email}. Job will retry. Keep status QUEUED.`);
            // Update error log but preserve QUEUED status in DB
            await db_1.prisma.recipient.update({
                where: { id: recipient.id },
                data: {
                    error: `Attempt ${job.attemptsMade + 1} failed: ${errorMessage}`,
                },
            });
        }
        // Throw error to trigger BullMQ retry mechanics
        throw err;
    }
    finally {
        // 8. Check Campaign completion: Campaign is COMPLETED if all recipients are in a terminal state (SENT or FAILED)
        const remainingCount = await db_1.prisma.recipient.count({
            where: {
                campaignId: campaign.id,
                status: {
                    in: ['PENDING', 'QUEUED'],
                },
            },
        });
        if (remainingCount === 0) {
            await db_1.prisma.campaign.update({
                where: { id: campaign.id },
                data: { status: 'COMPLETED' },
            });
            console.log(`🎉 Campaign ${campaign.id} status updated to COMPLETED! All recipients processed.`);
        }
    }
}, {
    connection: redis_1.redisConnection,
    concurrency: env_1.env.WORKER_CONCURRENCY,
});
exports.emailWorker.on('completed', (job) => {
    console.log(`[${new Date().toISOString()}] 🎉 Job ${job.id} completed successfully`);
});
exports.emailWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed with error:`, err);
});
exports.emailWorker.on('error', (err) => {
    console.error(`💥 Email Worker Error:`, err);
});
