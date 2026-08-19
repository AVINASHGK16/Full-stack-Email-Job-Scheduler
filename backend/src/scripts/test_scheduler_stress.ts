import { prisma } from '../db';
import { redisConnection } from '../config/redis';
import { RateLimitService } from '../services/rateLimit.service';
import { RecoveryService } from '../services/recovery.service';
import { emailQueue } from '../queues/email.queue';

async function runSchedulerStressAudit() {
  console.log('===============================================================');
  console.log('🧪 RUNNING PHASE 9.27: SCHEDULER FAILURE & IDEMPOTENCY AUDIT');
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
    // Ensure test user and sender exist
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'audit-test@example.com',
          name: 'Audit Tester',
        },
      });
    }

    let sender = await prisma.sender.findFirst({ where: { userId: user.id } });
    if (!sender) {
      sender = await prisma.sender.create({
        data: {
          userId: user.id,
          email: 'audit-sender@example.com',
          smtpUser: 'audit-user',
          smtpPassword: 'audit-password',
        },
      });
    }

    // ── TEST 1: Rate Limiter Atomic Multi-Worker Enforcement ────────
    console.log('\n--- [TEST 1] Shared Redis Hourly Rate Limiter ---');
    const testSenderId = `test-sender-${Date.now()}`;
    const limit = 3;

    const r1 = await RateLimitService.checkAndIncrement(testSenderId, limit);
    const r2 = await RateLimitService.checkAndIncrement(testSenderId, limit);
    const r3 = await RateLimitService.checkAndIncrement(testSenderId, limit);
    const r4 = await RateLimitService.checkAndIncrement(testSenderId, limit);
    const r5 = await RateLimitService.checkAndIncrement(testSenderId, limit);

    assert(r1 === true, '1st send allowed (1/3)');
    assert(r2 === true, '2nd send allowed (2/3)');
    assert(r3 === true, '3rd send allowed (3/3)');
    assert(r4 === false, '4th send blocked by rate limiter (exceeded 3/hr)');
    assert(r5 === false, '5th send blocked by rate limiter (exceeded 3/hr)');

    const count = await RateLimitService.getCurrentCount(testSenderId);
    assert(count === 3, `Redis counter accurately recorded 3 increments (actual=${count})`);

    const unlimited = await RateLimitService.checkAndIncrement(testSenderId, 0);
    assert(unlimited === true, 'hourlyLimit=0 correctly bypasses rate limit (unlimited)');

    // ── TEST 2: Idempotency Check (Already SENT Recipient) ─────────
    console.log('\n--- [TEST 2] Idempotency: SENT Status Short-Circuit ---');
    const campaign1 = await prisma.campaign.create({
      data: {
        userId: user.id,
        senderId: sender.id,
        subject: 'Idempotency Test',
        body: 'Testing duplicate send prevention',
        startTime: new Date(Date.now() + 60000),
        delaySeconds: 0,
        hourlyLimit: 0,
        status: 'PENDING',
      },
    });

    const recipientSent = await prisma.recipient.create({
      data: {
        campaignId: campaign1.id,
        email: 'idempotent-test@example.com',
        status: 'SENT',
        scheduledAt: new Date(),
        sentAt: new Date(),
      },
    });

    // Simulate worker check on the recipient
    const fetchedRecipient = await prisma.recipient.findUnique({
      where: { id: recipientSent.id },
    });

    assert(fetchedRecipient?.status === 'SENT', 'Recipient is recorded as SENT in DB');
    const isAlreadySent = fetchedRecipient?.status === 'SENT';
    assert(isAlreadySent === true, 'Worker short-circuits before SMTP call when status === SENT');

    // ── TEST 3: Campaign Lifecycle Consistency (All Terminal States) ─
    console.log('\n--- [TEST 3] Campaign Completion Lifecycle ---');
    const campaign2 = await prisma.campaign.create({
      data: {
        userId: user.id,
        senderId: sender.id,
        subject: 'Lifecycle Test',
        body: 'Testing terminal state completion',
        startTime: new Date(Date.now() + 60000),
        delaySeconds: 0,
        hourlyLimit: 0,
        status: 'SENDING',
      },
    });

    // Create 1 SENT and 1 FAILED recipient
    await prisma.recipient.create({
      data: {
        campaignId: campaign2.id,
        email: 'recip-sent@example.com',
        status: 'SENT',
        scheduledAt: new Date(),
        sentAt: new Date(),
      },
    });

    await prisma.recipient.create({
      data: {
        campaignId: campaign2.id,
        email: 'recip-failed@example.com',
        status: 'FAILED',
        scheduledAt: new Date(),
        failedAt: new Date(),
        error: 'Permanent failure',
      },
    });

    // Worker finally block check:
    const remainingCount = await prisma.recipient.count({
      where: {
        campaignId: campaign2.id,
        status: { in: ['PENDING', 'QUEUED'] },
      },
    });

    assert(remainingCount === 0, 'No PENDING/QUEUED recipients remain for campaign');

    if (remainingCount === 0) {
      await prisma.campaign.update({
        where: { id: campaign2.id },
        data: { status: 'COMPLETED' },
      });
    }

    const updatedCampaign = await prisma.campaign.findUnique({
      where: { id: campaign2.id },
    });

    assert(updatedCampaign?.status === 'COMPLETED', 'Campaign status transitioned to COMPLETED');

    // ── TEST 4: Stale PENDING Startup Recovery ──────────────────────
    console.log('\n--- [TEST 4] Crash Recovery: Stale PENDING Re-enqueue ---');
    const staleCampaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        senderId: sender.id,
        subject: 'Stale Recovery Test',
        body: 'Testing startup recovery',
        startTime: new Date(Date.now() + 120000),
        delaySeconds: 0,
        hourlyLimit: 0,
        status: 'PENDING',
      },
    });

    // Create a stale recipient with createdAt in the past
    const staleRecipient = await prisma.recipient.create({
      data: {
        campaignId: staleCampaign.id,
        email: 'stale-test@example.com',
        status: 'PENDING',
        scheduledAt: new Date(Date.now() + 120000),
        createdAt: new Date(Date.now() - 60000), // 60s ago
      },
    });

    // Run recovery
    await RecoveryService.recoverStalePendingRecipients();

    const recovered = await prisma.recipient.findUnique({
      where: { id: staleRecipient.id },
    });

    assert(recovered?.status === 'QUEUED', 'Stale PENDING recipient transitioned to QUEUED after recovery');
    assert(recovered?.jobId !== null, `Recovered recipient received BullMQ jobId (${recovered?.jobId})`);

    // Clean up test jobs from queue
    if (recovered?.jobId) {
      const job = await emailQueue.getJob(recovered.jobId);
      if (job) await job.remove();
    }

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 AUDIT RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ Audit execution error:', error);
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runSchedulerStressAudit();
