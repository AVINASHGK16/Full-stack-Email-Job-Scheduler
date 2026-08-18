"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecoveryService = void 0;
const db_1 = require("../db");
const email_queue_1 = require("../queues/email.queue");
const env_1 = require("../config/env");
class RecoveryService {
    /**
     * Scans PostgreSQL for stale Recipient records in PENDING status,
     * checks if they exist in BullMQ, and recreates/re-enqueues them if missing.
     */
    static async recoverStalePendingRecipients() {
        console.log('🔄 Running stale PENDING recipients recovery check...');
        const cutoff = new Date(Date.now() - env_1.env.PENDING_RECOVERY_THRESHOLD_MS);
        try {
            // Find all PENDING recipients that were created before the cutoff threshold
            const staleRecipients = await db_1.prisma.recipient.findMany({
                where: {
                    status: 'PENDING',
                    createdAt: {
                        lte: cutoff,
                    },
                },
            });
            if (staleRecipients.length === 0) {
                console.log('🔄 No stale PENDING recipients found.');
                return;
            }
            console.log(`🔄 Found ${staleRecipients.length} stale PENDING recipient(s) to check.`);
            for (const recipient of staleRecipients) {
                const jobId = `email-${recipient.id}`;
                console.log(`🔄 Checking BullMQ job for recipient ${recipient.id} (${recipient.email})...`);
                try {
                    // Check if job exists in Redis/BullMQ
                    const job = await email_queue_1.emailQueue.getJob(jobId);
                    if (job) {
                        console.log(`ℹ️ Job "${jobId}" already exists in BullMQ. Updating recipient state to QUEUED.`);
                        // Update DB status to QUEUED
                        await db_1.prisma.recipient.update({
                            where: { id: recipient.id },
                            data: {
                                status: 'QUEUED',
                                jobId,
                            },
                        });
                        continue;
                    }
                    // Job does not exist. Recreate it preserving original scheduling intent
                    console.log(`⚠️ Job "${jobId}" is missing from BullMQ. Re-enqueuing...`);
                    const delayMs = Math.max(0, new Date(recipient.scheduledAt).getTime() - Date.now());
                    const newJob = await email_queue_1.emailQueue.add('send-email', { recipientId: recipient.id }, {
                        jobId,
                        delay: delayMs,
                    });
                    // Update PostgreSQL status only after queue.add() succeeds
                    await db_1.prisma.recipient.update({
                        where: { id: recipient.id },
                        data: {
                            status: 'QUEUED',
                            jobId: newJob.id,
                        },
                    });
                    console.log(`✅ Successfully re-enqueued job "${newJob.id}" for recipient ${recipient.id}.`);
                }
                catch (err) {
                    console.error(`❌ Failed to recover recipient ${recipient.id}:`, err);
                    // Catch inner error so one failure doesn't block other recipients
                }
            }
        }
        catch (err) {
            console.error('❌ Global error during stale PENDING recipients recovery:', err);
        }
    }
}
exports.RecoveryService = RecoveryService;
