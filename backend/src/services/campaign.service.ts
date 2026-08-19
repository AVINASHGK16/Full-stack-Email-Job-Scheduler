import { prisma } from '../db';
import { emailQueue } from '../queues/email.queue';
import { AppError } from '../middleware/error';

/**
 * The subset of campaign data that comes from the validated client request body.
 * userId is intentionally excluded — it is passed separately from the authenticated session.
 */
export interface CreateCampaignPayload {
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  recipients: string[];
  forceFailAttempts?: number;
}

export class CampaignService {
  /**
   * Validates ownership, saves Campaign and Recipients to DB, and schedules BullMQ jobs.
   *
   * @param userId  - The authenticated user's ID from req.user.id (never from client input).
   * @param payload - The validated campaign payload (no userId field).
   */
  public static async createCampaign(userId: string, payload: CreateCampaignPayload) {
    const {
      senderId,
      subject,
      body,
      startTime,
      delaySeconds,
      hourlyLimit,
      recipients,
      forceFailAttempts,
    } = payload;

    // 1. Verify User exists (the authenticated user is always the owner)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // 2. Verify Sender exists
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });
    if (!sender) {
      throw new AppError('Sender not found', 404);
    }

    // 3. Enforce sender ownership — 403 Forbidden if the sender belongs to another user.
    //    This prevents cross-user campaign creation even if a valid senderId is guessed.
    if (sender.userId !== userId) {
      throw new AppError(
        'Forbidden: you do not have permission to use this sender.',
        403
      );
    }

    // 4. Reject startTime in the past
    const startTimestamp = new Date(startTime).getTime();
    if (startTimestamp <= Date.now()) {
      throw new AppError('startTime must be in the future', 400);
    }

    // 5. Normalize and deduplicate recipient emails
    const uniqueEmails = Array.from(
      new Set(
        recipients
          .map(email => email.trim().toLowerCase())
          .filter(email => email.length > 0)
      )
    );

    if (uniqueEmails.length === 0) {
      throw new AppError('At least one valid recipient email is required', 400);
    }

    // 6. Calculate recipient schedule times
    // Recipient i scheduledAt = startTime + i * delaySeconds
    const recipientData = uniqueEmails.map((email, index) => {
      const scheduledAt = new Date(startTimestamp + index * delaySeconds * 1000);
      return {
        email,
        status: 'PENDING' as const,
        scheduledAt,
      };
    });

    // 7. DB Transaction — Save Campaign & Recipients.
    //    userId is sourced from the authenticated session; never from the client payload.
    const campaign = await prisma.campaign.create({
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

    // 8. Enqueue BullMQ jobs with failure-safety
    const scheduledRecipients = [];
    const queueFailures = [];

    for (const recipient of campaign.recipients) {
      const deterministicJobId = `email-${recipient.id}`;
      const delayMs = Math.max(0, new Date(recipient.scheduledAt).getTime() - Date.now());

      try {
        // Add job to BullMQ queue
        const job = await emailQueue.add(
          'send-email',
          {
            recipientId: recipient.id,
            forceFailAttempts,
          },
          {
            delay: delayMs,
            jobId: deterministicJobId,
          }
        );

        // Update recipient state to QUEUED only after queue.add() succeeds
        const updatedRecipient = await prisma.recipient.update({
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
      } catch (err) {
        console.error(
          `❌ Failed to enqueue BullMQ job for recipient ${recipient.id} (${recipient.email}):`,
          err
        );
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

  /**
   * Returns all scheduled (PENDING or QUEUED) recipients belonging to the
   * authenticated user, ordered by scheduledAt ascending.
   *
   * Data isolation: the WHERE clause filters by campaign.userId, so a user
   * can never see another user's records — even if they guess a recipient ID.
   *
   * Read-only: no DB mutations, no queue interactions.
   *
   * @param userId - The authenticated user's ID from req.user.id.
   */
  public static async getScheduled(userId: string) {
    const recipients = await prisma.recipient.findMany({
      where: {
        // Status filter: only recipients that have not yet been sent or failed
        status: { in: ['PENDING', 'QUEUED'] },
        // Data-isolation: join through campaign to enforce user ownership
        campaign: { userId },
      },
      select: {
        id: true,
        email: true,
        status: true,
        scheduledAt: true,
        jobId: true,
        campaign: {
          select: {
            id: true,
            subject: true,
            // Return the first 200 characters of the body as a preview.
            // The full body is not needed by the list UI.
            body: true,
            status: true,
            startTime: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    interface ScheduledRecipientItem {
      id: string;
      email: string;
      status: string;
      scheduledAt: Date;
      jobId: string | null;
      campaign: {
        id: string;
        subject: string;
        body: string;
        status: string;
        startTime: Date;
      };
    }

    // Shape the response: flatten campaign fields and add a truncated preview
    return (recipients as unknown as ScheduledRecipientItem[]).map((r: ScheduledRecipientItem) => ({
      id: r.id,
      email: r.email,
      status: r.status,
      scheduledAt: r.scheduledAt,
      jobId: r.jobId,
      campaignId: r.campaign.id,
      campaignStatus: r.campaign.status,
      subject: r.campaign.subject,
      // Trim body to 200 chars for the dashboard preview snippet
      bodyPreview: r.campaign.body.slice(0, 200),
      startTime: r.campaign.startTime,
    }));
  }
}
