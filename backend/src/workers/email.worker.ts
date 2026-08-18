import { Worker, Job } from 'bullmq';
import { prisma } from '../db';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';
import { EmailService } from '../services/email.service';

export const emailWorker = new Worker(
  'email-scheduler',
  async (job: Job) => {
    const { recipientId } = job.data;
    console.log(`👷 Worker picked up job ${job.id} for Recipient ID: ${recipientId}`);

    // 1. Fetch Recipient with Campaign and Sender info
    const recipient = await prisma.recipient.findUnique({
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

    // 2. Check if already sent
    if (recipient.status === 'SENT') {
      console.log(`ℹ️ Recipient ${recipient.email} is already marked SENT. Skipping.`);
      return { skipped: true, reason: 'already_sent' };
    }

    const campaign = recipient.campaign;
    const sender = campaign.sender;

    // 3. Update Campaign status to SENDING if it is PENDING
    if (campaign.status === 'PENDING') {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'SENDING' },
      });
      console.log(`📈 Campaign ${campaign.id} status updated to SENDING`);
    }

    try {
      console.log(`✉️ Sending email to ${recipient.email} via Ethereal SMTP...`);
      
      // 4. Call Nodemailer EmailService
      const result = await EmailService.sendEmail({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
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

      // 5. Update Recipient to SENT
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          error: null,
        },
      });

      return { success: true, messageId: result.messageId, previewUrl: result.previewUrl };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`❌ SMTP Send Failed for ${recipient.email}:`, errorMessage);

      // 6. Update Recipient to FAILED
      await prisma.recipient.update({
        where: { id: recipient.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          error: errorMessage,
        },
      });

      // Throw error to trigger BullMQ retry mechanics
      throw err;
    } finally {
      // 7. Check Campaign completion: Campaign is COMPLETED if all recipients are in a terminal state (SENT or FAILED)
      const remainingCount = await prisma.recipient.count({
        where: {
          campaignId: campaign.id,
          status: {
            in: ['PENDING', 'QUEUED'],
          },
        },
      });

      if (remainingCount === 0) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'COMPLETED' },
        });
        console.log(`🎉 Campaign ${campaign.id} status updated to COMPLETED! All recipients processed.`);
      }
    }
  },
  {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`🎉 Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed with error:`, err);
});

emailWorker.on('error', (err) => {
  console.error(`💥 Email Worker Error:`, err);
});
