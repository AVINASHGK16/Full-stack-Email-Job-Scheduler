import { prisma } from '../db';
import { CampaignService } from '../services/campaign.service';
import { RateLimitService } from '../services/rateLimit.service';
import { redisConnection } from '../config/redis';
import { emailQueue } from '../queues/email.queue';

/**
 * Simulates worker processing logic for a single recipient under rate-limiting conditions.
 */
async function processRecipientJob(recipientId: string, customHourBucket?: number) {
  const recipient = await prisma.recipient.findUnique({
    where: { id: recipientId },
    include: {
      campaign: {
        include: { sender: true },
      },
    },
  });

  if (!recipient || recipient.status === 'SENT') {
    return { skipped: true };
  }

  const { campaign } = recipient;
  const { sender } = campaign;

  // Rate limiter check with hour-bucket simulation support
  let allowed = false;
  if (customHourBucket !== undefined) {
    // Test mode: inject explicit hourly bucket key
    const customKey = `ratelimit:sender:${sender.id}:hour:${customHourBucket}`;
    const result = (await (redisConnection as any).eval(
      `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local current = redis.call('GET', key)
      if current and tonumber(current) >= limit then
        return 0
      end
      redis.call('INCR', key)
      redis.call('EXPIRE', key, 3600)
      return 1
      `,
      1,
      customKey,
      campaign.hourlyLimit
    )) as number;
    allowed = result === 1;
  } else {
    allowed = await RateLimitService.checkAndIncrement(sender.id, campaign.hourlyLimit);
  }

  if (!allowed) {
    // Recipient stays QUEUED, NOT FAILED
    return { skipped: true, reason: 'rate_limited' };
  }

  // Simulate successful send
  await prisma.recipient.update({
    where: { id: recipient.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      error: null,
    },
  });

  // Check Campaign completion
  const remainingCount = await prisma.recipient.count({
    where: {
      campaignId: campaign.id,
      status: { in: ['PENDING', 'QUEUED'] },
    },
  });

  if (remainingCount === 0) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'COMPLETED' },
    });
  }

  return { success: true };
}

async function runRateLimitWorkerE2ETest() {
  console.log('===============================================================');
  console.log('⏱️ RUNNING PHASE 9.28.8: RATE LIMIT WORKER E2E AUDIT');
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
      where: { email: 'ratelimit-audit-user@example.com' },
      update: {},
      create: {
        email: 'ratelimit-audit-user@example.com',
        name: 'Rate Limit Tester',
      },
    });

    const sender = await prisma.sender.upsert({
      where: { id: '00000000-0000-0000-0000-000000000006' },
      update: { userId: user.id },
      create: {
        id: '00000000-0000-0000-0000-000000000006',
        userId: user.id,
        email: 'ratelimit-sender@example.com',
        smtpUser: 'rl_user',
        smtpPassword: 'rl_password',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // ── Create Campaign with 10 recipients, hourlyLimit = 3 ───────
    console.log('--- [SETUP] Scheduling Campaign: 10 Recipients, hourlyLimit = 3 ---');
    const recipientEmails = Array.from({ length: 10 }, (_, i) => `rate-test-${i + 1}@example.com`);
    const futureTime = new Date(Date.now() + 60000).toISOString();

    const campaignResult = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'Rate Limit Worker Lifecycle Test',
      body: 'Testing multi-hour staggered delivery',
      startTime: futureTime,
      delaySeconds: 0,
      hourlyLimit: 3,
      recipients: recipientEmails,
    });

    const campaignId = campaignResult.campaign.id;
    const recipientIds = campaignResult.recipients.map(r => r.id);

    assert(recipientIds.length === 10, '10 recipients created in campaign');

    // ── SIMULATION HOUR 1 ──────────────────────────────────────────
    console.log('\n--- [HOUR 1] Worker processes all 10 jobs (Limit = 3) ---');
    const hour1Bucket = 10001;

    for (const id of recipientIds) {
      await processRecipientJob(id, hour1Bucket);
    }

    const sentCountH1 = await prisma.recipient.count({
      where: { campaignId, status: 'SENT' },
    });
    const queuedCountH1 = await prisma.recipient.count({
      where: { campaignId, status: 'QUEUED' },
    });
    const failedCountH1 = await prisma.recipient.count({
      where: { campaignId, status: 'FAILED' },
    });

    assert(sentCountH1 === 3, `Hour 1: Exactly 3 recipients are SENT (actual=${sentCountH1})`);
    assert(queuedCountH1 === 7, `Hour 1: Exactly 7 recipients remain QUEUED (actual=${queuedCountH1})`);
    assert(failedCountH1 === 0, 'Hour 1: ZERO recipients marked as FAILED due to rate limiting');

    // ── SIMULATION HOUR 2 ──────────────────────────────────────────
    console.log('\n--- [HOUR 2] New hourly window begins (Limit = 3) ---');
    const hour2Bucket = 10002;

    for (const id of recipientIds) {
      await processRecipientJob(id, hour2Bucket);
    }

    const sentCountH2 = await prisma.recipient.count({
      where: { campaignId, status: 'SENT' },
    });
    const queuedCountH2 = await prisma.recipient.count({
      where: { campaignId, status: 'QUEUED' },
    });

    assert(sentCountH2 === 6, `Hour 2: Cumulative 6 recipients are SENT (actual=${sentCountH2})`);
    assert(queuedCountH2 === 4, `Hour 2: Exactly 4 recipients remain QUEUED (actual=${queuedCountH2})`);

    // ── SIMULATION HOUR 3 ──────────────────────────────────────────
    console.log('\n--- [HOUR 3] Third hourly window begins (Limit = 3) ---');
    const hour3Bucket = 10003;

    for (const id of recipientIds) {
      await processRecipientJob(id, hour3Bucket);
    }

    const sentCountH3 = await prisma.recipient.count({
      where: { campaignId, status: 'SENT' },
    });
    const queuedCountH3 = await prisma.recipient.count({
      where: { campaignId, status: 'QUEUED' },
    });

    assert(sentCountH3 === 9, `Hour 3: Cumulative 9 recipients are SENT (actual=${sentCountH3})`);
    assert(queuedCountH3 === 1, `Hour 3: Exactly 1 recipient remains QUEUED (actual=${queuedCountH3})`);

    // ── SIMULATION HOUR 4 ──────────────────────────────────────────
    console.log('\n--- [HOUR 4] Final hourly window begins (Limit = 3) ---');
    const hour4Bucket = 10004;

    for (const id of recipientIds) {
      await processRecipientJob(id, hour4Bucket);
    }

    const sentCountH4 = await prisma.recipient.count({
      where: { campaignId, status: 'SENT' },
    });
    const queuedCountH4 = await prisma.recipient.count({
      where: { campaignId, status: 'QUEUED' },
    });
    const finalFailedCount = await prisma.recipient.count({
      where: { campaignId, status: 'FAILED' },
    });

    assert(sentCountH4 === 10, `Hour 4: All 10 recipients are SENT (actual=${sentCountH4})`);
    assert(queuedCountH4 === 0, 'Hour 4: 0 recipients remain queued');
    assert(finalFailedCount === 0, 'Final: 0 recipients ever entered FAILED state');

    // ── Final Campaign Completion Check ────────────────────────────
    const completedCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    assert(completedCampaign?.status === 'COMPLETED', 'Campaign transitioned to COMPLETED status');

    // ── Cleanup Test Records ───────────────────────────────────────
    for (const rec of campaignResult.recipients) {
      if (rec.jobId) {
        const job = await emailQueue.getJob(rec.jobId);
        if (job) await job.remove();
      }
    }

    await prisma.recipient.deleteMany({ where: { campaignId } });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await prisma.sender.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: user.id } });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 RATE LIMIT WORKER AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ Rate Limit Worker Audit Error:', error);
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runRateLimitWorkerE2ETest();
