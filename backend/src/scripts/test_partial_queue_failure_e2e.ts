import { prisma } from '../db';
import { emailQueue } from '../queues/email.queue';
import { redisConnection } from '../config/redis';

/**
 * Simulates CampaignService.createCampaign logic with an injected partial BullMQ failure on Recipient C.
 */
async function simulatePartialQueueCampaignCreation(userId: string, payload: {
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  recipients: string[];
  failEmailPattern?: string;
}) {
  const { senderId, subject, body, startTime, delaySeconds, hourlyLimit, recipients, failEmailPattern } = payload;
  const startTimestamp = new Date(startTime).getTime();

  const uniqueEmails = Array.from(new Set(recipients.map(e => e.trim().toLowerCase())));

  const recipientData = uniqueEmails.map((email, index) => ({
    email,
    status: 'PENDING' as const,
    scheduledAt: new Date(startTimestamp + index * delaySeconds * 1000),
  }));

  // Create Campaign in PostgreSQL
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

  const scheduledRecipients = [];
  const queueFailures = [];

  for (const recipient of campaign.recipients) {
    const deterministicJobId = `email-${recipient.id}`;
    const delayMs = Math.max(0, new Date(recipient.scheduledAt).getTime() - Date.now());

    try {
      // Simulate intentional queue failure on matching recipient pattern (e.g. Recipient C)
      if (failEmailPattern && recipient.email.includes(failEmailPattern)) {
        throw new Error('Simulated Redis connection timeout on job enqueue');
      }

      const job = await emailQueue.add(
        'send-email',
        { recipientId: recipient.id },
        { delay: delayMs, jobId: deterministicJobId }
      );

      const updated = await prisma.recipient.update({
        where: { id: recipient.id },
        data: { status: 'QUEUED', jobId: job.id },
      });

      scheduledRecipients.push({
        id: updated.id,
        email: updated.email,
        scheduledAt: updated.scheduledAt.toISOString(),
        jobId: updated.jobId,
        status: updated.status,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      queueFailures.push({
        id: recipient.id,
        email: recipient.email,
        error: errorMessage,
      });
    }
  }

  const statusCode = queueFailures.length > 0 ? 207 : 201;

  return {
    statusCode,
    body: {
      status: queueFailures.length > 0 ? 'partial_success' : 'success',
      campaign: {
        id: campaign.id,
        userId: campaign.userId,
        senderId: campaign.senderId,
        subject: campaign.subject,
        body: campaign.body,
        startTime: campaign.startTime.toISOString(),
        delaySeconds: campaign.delaySeconds,
        hourlyLimit: campaign.hourlyLimit,
        status: campaign.status,
      },
      recipients: scheduledRecipients,
      ...(queueFailures.length > 0 && { failures: queueFailures }),
    },
  };
}

async function runPartialQueueFailureAudit() {
  console.log('===============================================================');
  console.log('⚠️ RUNNING PHASE 9.28.10: PARTIAL QUEUE FAILURE (207) AUDIT');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
    }
  }

  try {
    // ── Setup User and Sender ─────────────────────────────────────
    const user = await prisma.user.upsert({
      where: { email: 'partial-fail-user@example.com' },
      update: {},
      create: {
        email: 'partial-fail-user@example.com',
        name: 'Partial Failure Tester',
      },
    });

    const sender = await prisma.sender.upsert({
      where: { id: '00000000-0000-0000-0000-000000000008' },
      update: { userId: user.id },
      create: {
        id: '00000000-0000-0000-0000-000000000008',
        userId: user.id,
        email: 'partial-sender@example.com',
        smtpUser: 'partial_user',
        smtpPassword: 'partial_password',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // ── Schedule 4 Recipients with Simulated Failure on Recipient C ──
    console.log('--- [TEST 1] Simulate 4 Recipients with Queue Failure on Recipient C ---');
    const recipientsList = [
      'recipient-a@example.com',
      'recipient-b@example.com',
      'recipient-c@example.com', // Injected failure
      'recipient-d@example.com',
    ];

    const futureTime = new Date(Date.now() + 60000).toISOString();

    const response = await simulatePartialQueueCampaignCreation(user.id, {
      senderId: sender.id,
      subject: 'Partial Queue Enqueue Test',
      body: 'Testing HTTP 207 Multi-Status handling',
      startTime: futureTime,
      delaySeconds: 1,
      hourlyLimit: 50,
      recipients: recipientsList,
      failEmailPattern: 'recipient-c',
    });

    // 1. Verify HTTP status code is 207 Multi-Status (NOT 201)
    assert(response.statusCode === 207, `HTTP Status Code is 207 Multi-Status (actual=${response.statusCode})`);
    assert(response.statusCode !== 201, 'Status code is NOT 201 Created');
    assert(response.body.status === 'partial_success', 'Response status property is "partial_success"');

    // 2. Verify recipient breakdown
    const scheduled = response.body.recipients;
    const failures = response.body.failures || [];
    const totalSubmitted = scheduled.length + failures.length;

    assert(scheduled.length === 3, `Scheduled count is 3 (actual=${scheduled.length})`);
    assert(failures.length === 1, `Failures count is 1 (actual=${failures.length})`);
    assert(totalSubmitted === 4, `Total submitted count is 4 (actual=${totalSubmitted})`);

    // 3. Verify failure details for Recipient C
    const failedC = failures[0];
    assert(failedC.email === 'recipient-c@example.com', 'Failed recipient is recipient-c@example.com');
    assert(Boolean(failedC.error?.includes('Simulated Redis connection timeout')), 'Failure contains specific error details');

    // 4. Verify A, B, and D were queued and remain valid
    const scheduledEmails = scheduled.map(r => r.email);
    assert(scheduledEmails.includes('recipient-a@example.com'), 'Recipient A is successfully QUEUED');
    assert(scheduledEmails.includes('recipient-b@example.com'), 'Recipient B is successfully QUEUED');
    assert(scheduledEmails.includes('recipient-d@example.com'), 'Recipient D is successfully QUEUED');
    assert(!scheduledEmails.includes('recipient-c@example.com'), 'Recipient C is NOT in scheduled list');

    // 5. Verify PostgreSQL state
    const campaignInDb = await prisma.campaign.findUnique({
      where: { id: response.body.campaign.id },
      include: { recipients: true },
    });

    assert(campaignInDb !== null, 'Campaign record saved in PostgreSQL');
    assert(campaignInDb?.recipients.length === 4, 'All 4 recipient records exist in PostgreSQL');

    const queuedRecipientsInDb = campaignInDb?.recipients.filter(r => r.status === 'QUEUED');
    const pendingRecipientsInDb = campaignInDb?.recipients.filter(r => r.status === 'PENDING');

    assert(queuedRecipientsInDb?.length === 3, '3 recipients in DB have status QUEUED');
    assert(pendingRecipientsInDb?.length === 1, '1 recipient in DB remained in status PENDING (failed enqueue)');

    // Clean up created jobs
    for (const rec of scheduled) {
      if (rec.jobId) {
        const job = await emailQueue.getJob(rec.jobId);
        if (job) await job.remove();
      }
    }

    // Clean up DB records
    await prisma.recipient.deleteMany({ where: { campaignId: response.body.campaign.id } });
    await prisma.campaign.delete({ where: { id: response.body.campaign.id } });
    await prisma.sender.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: user.id } });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 PARTIAL QUEUE FAILURE AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ Partial Queue Failure Audit Error:', error);
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runPartialQueueFailureAudit();
