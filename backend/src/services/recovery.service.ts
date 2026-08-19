import { prisma } from '../db';
import { emailQueue } from '../queues/email.queue';
import { env } from '../config/env';

export class RecoveryService {
  /**
   * Scans PostgreSQL for uncompleted Recipient records (PENDING or QUEUED),
   * verifies whether their corresponding BullMQ job exists in Redis,
   * and automatically restores/re-enqueues any missing jobs.
   *
   * This provides full self-healing if Redis is restarted, crashed, or flushed.
   */
  public static async recoverStalePendingRecipients(): Promise<void> {
    console.log('🔄 Running orphaned/stale recipients recovery check...');
    const cutoff = new Date(Date.now() - env.PENDING_RECOVERY_THRESHOLD_MS);

    try {
      // Find all non-terminal recipients created before cutoff threshold or in QUEUED state
      const candidates = await prisma.recipient.findMany({
        where: {
          status: { in: ['PENDING', 'QUEUED'] },
          createdAt: {
            lte: cutoff,
          },
        },
      });

      if (candidates.length === 0) {
        console.log('🔄 No orphaned recipients found.');
        return;
      }

      console.log(`🔄 Found ${candidates.length} candidate recipient(s) to verify in BullMQ.`);

      for (const recipient of candidates) {
        const jobId = recipient.jobId || `email-${recipient.id}`;

        try {
          // Check if job exists in Redis/BullMQ
          const job = await emailQueue.getJob(jobId);

          if (job) {
            // Job exists in Redis. If status was PENDING, promote to QUEUED
            if (recipient.status === 'PENDING') {
              await prisma.recipient.update({
                where: { id: recipient.id },
                data: {
                  status: 'QUEUED',
                  jobId,
                },
              });
            }
            continue;
          }

          // Job does NOT exist in Redis (e.g. Redis restart without persistence or cache eviction)
          console.log(`⚠️ Job "${jobId}" is missing from BullMQ. Restoring...`);
          const delayMs = Math.max(0, new Date(recipient.scheduledAt).getTime() - Date.now());

          const newJob = await emailQueue.add(
            'send-email',
            { recipientId: recipient.id },
            {
              jobId: `email-${recipient.id}`,
              delay: delayMs,
            }
          );

          // Update PostgreSQL status only after queue.add() succeeds
          await prisma.recipient.update({
            where: { id: recipient.id },
            data: {
              status: 'QUEUED',
              jobId: newJob.id,
            },
          });

          console.log(`✅ Successfully restored job "${newJob.id}" for recipient ${recipient.id}.`);
        } catch (err) {
          console.error(`❌ Failed to recover recipient ${recipient.id}:`, err);
        }
      }
    } catch (err) {
      console.error('❌ Global error during recipient recovery:', err);
    }
  }
}
