"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignService = void 0;
const db_1 = require("../db");
const email_queue_1 = require("../queues/email.queue");
const error_1 = require("../middleware/error");
class CampaignService {
    /**
     * Validates details, saves Campaign and Recipients to DB, and schedules BullMQ jobs.
     */
    static async createCampaign(input) {
        const { userId, senderId, subject, body, startTime, delaySeconds, hourlyLimit, recipients, forceFailAttempts, } = input;
        // 1. Verify User exists
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new error_1.AppError('User not found', 404);
        }
        // 2. Verify Sender exists and belongs to User
        const sender = await db_1.prisma.sender.findUnique({
            where: { id: senderId },
        });
        if (!sender) {
            throw new error_1.AppError('Sender not found', 404);
        }
        if (sender.userId !== userId) {
            throw new error_1.AppError('Sender does not belong to the specified user', 400);
        }
        // 3. Reject startTime in the past
        const startTimestamp = new Date(startTime).getTime();
        if (startTimestamp <= Date.now()) {
            throw new error_1.AppError('startTime must be in the future', 400);
        }
        // 4. Normalize and deduplicate recipient emails
        const uniqueEmails = Array.from(new Set(recipients
            .map(email => email.trim().toLowerCase())
            .filter(email => email.length > 0)));
        if (uniqueEmails.length === 0) {
            throw new error_1.AppError('At least one valid recipient email is required', 400);
        }
        // 5. Calculate recipient schedule times
        // Recipient i scheduledAt = startTime + i * delaySeconds
        const recipientData = uniqueEmails.map((email, index) => {
            const scheduledAt = new Date(startTimestamp + index * delaySeconds * 1000);
            return {
                email,
                status: 'PENDING',
                scheduledAt,
            };
        });
        // 6. DB Transaction - Save Campaign & Recipients
        const campaign = await db_1.prisma.campaign.create({
            data: {
                userId,
                senderId,
                subject,
                body,
                startTime: new Date(startTime),
                delaySeconds,
                hourlyLimit,
                status: 'PENDING',
                recipients: {
                    create: recipientData,
                },
            },
            include: {
                recipients: true,
            },
        });
        // 7. Enqueue BullMQ jobs with failure-safety
        const scheduledRecipients = [];
        const queueFailures = [];
        for (const recipient of campaign.recipients) {
            const deterministicJobId = `email-${recipient.id}`;
            const delayMs = Math.max(0, new Date(recipient.scheduledAt).getTime() - Date.now());
            try {
                // Add job to BullMQ queue
                const job = await email_queue_1.emailQueue.add('send-email', {
                    recipientId: recipient.id,
                    forceFailAttempts,
                }, {
                    delay: delayMs,
                    jobId: deterministicJobId,
                });
                // Update recipient state to QUEUED only after queue.add() succeeds
                const updatedRecipient = await db_1.prisma.recipient.update({
                    where: { id: recipient.id },
                    data: {
                        status: 'QUEUED',
                        jobId: job.id,
                    },
                });
                scheduledRecipients.push({
                    id: updatedRecipient.id,
                    email: updatedRecipient.email,
                    scheduledAt: updatedRecipient.scheduledAt,
                    jobId: updatedRecipient.jobId,
                    status: updatedRecipient.status,
                });
            }
            catch (err) {
                console.error(`❌ Failed to enqueue BullMQ job for recipient ${recipient.id} (${recipient.email}):`, err);
                queueFailures.push({
                    id: recipient.id,
                    email: recipient.email,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        // Return structured campaign info along with scheduled recipients and queue failures (if any)
        return {
            campaign: {
                id: campaign.id,
                userId: campaign.userId,
                senderId: campaign.senderId,
                subject: campaign.subject,
                body: campaign.body,
                startTime: campaign.startTime,
                delaySeconds: campaign.delaySeconds,
                hourlyLimit: campaign.hourlyLimit,
                status: campaign.status,
            },
            recipients: scheduledRecipients,
            ...(queueFailures.length > 0 && { failures: queueFailures }),
        };
    }
}
exports.CampaignService = CampaignService;
