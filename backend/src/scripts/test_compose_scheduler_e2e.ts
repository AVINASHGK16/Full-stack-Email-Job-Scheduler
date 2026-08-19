import { prisma } from '../db';
import { CampaignService } from '../services/campaign.service';
import { emailQueue } from '../queues/email.queue';
import { redisConnection } from '../config/redis';

async function runComposeSchedulerE2ETest() {
  console.log('===============================================================');
  console.log('🚀 RUNNING PHASE 9.28.3: COMPOSE → SCHEDULER E2E AUDIT');
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
    // ── Setup User and Verified Sender ────────────────────────────
    const user = await prisma.user.upsert({
      where: { email: 'e2e-user@example.com' },
      update: {},
      create: {
        email: 'e2e-user@example.com',
        name: 'E2E Tester',
      },
    });

    const sender = await prisma.sender.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: { userId: user.id },
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        userId: user.id,
        email: 'e2e-sender@example.com',
        smtpUser: 'e2e_user',
        smtpPassword: 'e2e_password',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // ── SCENARIO 1: Single Recipient Scheduling (0s delay) ─────────
    console.log('--- [SCENARIO 1] Single Recipient Scheduling (0 delay) ---');
    const startTime1 = new Date(Date.now() + 10000).toISOString(); // 10s future

    const result1 = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'E2E Single Test Email',
      body: 'Hello world from E2E single test',
      startTime: startTime1,
      delaySeconds: 0,
      hourlyLimit: 1,
      recipients: ['single-recipient@example.com'],
    });

    assert(result1.campaign.id !== undefined, 'Campaign record created successfully in DB');
    assert(result1.recipients.length === 1, '1 recipient returned in response');
    assert(result1.recipients[0].status === 'QUEUED', 'Recipient status is QUEUED in BullMQ');
    assert(result1.recipients[0].jobId !== null, `BullMQ job enqueued with ID: ${result1.recipients[0].jobId}`);

    // Verify presence in GET /campaigns/scheduled
    const scheduledList1 = await CampaignService.getScheduled(user.id);
    const foundScheduled1 = scheduledList1.find(r => r.id === result1.recipients[0].id);
    assert(foundScheduled1 !== undefined, 'Recipient is queryable via getScheduled (Scheduled Dashboard API)');
    assert(foundScheduled1?.subject === 'E2E Single Test Email', 'Subject matches campaign');
    assert(foundScheduled1?.status === 'QUEUED', 'Dashboard status is QUEUED');

    // ── SCENARIO 2: Multi-Recipient Delay Staggering (2s delay) ─────
    console.log('\n--- [SCENARIO 2] Multi-Recipient Scheduling (4 recipients, 2s delay) ---');
    const baseTimeMs = Date.now() + 60000; // 1 minute future
    const startTime2 = new Date(baseTimeMs).toISOString();
    const delaySeconds = 2;

    const recipientsList = [
      'recip-a@example.com',
      'recip-b@example.com',
      'recip-c@example.com',
      'recip-d@example.com',
    ];

    const result2 = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'E2E Multi-Recipient Delay Staggering',
      body: 'Staggered batch delivery test',
      startTime: startTime2,
      delaySeconds,
      hourlyLimit: 100,
      recipients: recipientsList,
    });

    assert(result2.recipients.length === 4, '4 recipients returned in response');

    // Inspect scheduled timestamps for each recipient
    const recipientA = result2.recipients.find(r => r.email === 'recip-a@example.com')!;
    const recipientB = result2.recipients.find(r => r.email === 'recip-b@example.com')!;
    const recipientC = result2.recipients.find(r => r.email === 'recip-c@example.com')!;
    const recipientD = result2.recipients.find(r => r.email === 'recip-d@example.com')!;

    const timeA = new Date(recipientA.scheduledAt).getTime();
    const timeB = new Date(recipientB.scheduledAt).getTime();
    const timeC = new Date(recipientC.scheduledAt).getTime();
    const timeD = new Date(recipientD.scheduledAt).getTime();

    assert(timeA === baseTimeMs, `Recipient A scheduled at t (expected=${baseTimeMs}, actual=${timeA})`);
    assert(timeB === baseTimeMs + 2000, `Recipient B scheduled at t + 2s (expected=${baseTimeMs + 2000}, actual=${timeB})`);
    assert(timeC === baseTimeMs + 4000, `Recipient C scheduled at t + 4s (expected=${baseTimeMs + 4000}, actual=${timeC})`);
    assert(timeD === baseTimeMs + 6000, `Recipient D scheduled at t + 6s (expected=${baseTimeMs + 6000}, actual=${timeD})`);

    // Verify BullMQ job delay registration in Redis
    for (let i = 0; i < result2.recipients.length; i++) {
      const rec = result2.recipients[i];
      const job = await emailQueue.getJob(rec.jobId!);
      assert(job !== undefined && job !== null, `BullMQ job ${rec.jobId} exists in Redis`);
    }

    // Clean up created test jobs
    for (const rec of [...result1.recipients, ...result2.recipients]) {
      if (rec.jobId) {
        const job = await emailQueue.getJob(rec.jobId);
        if (job) await job.remove();
      }
    }

    // Clean up test DB records
    await prisma.recipient.deleteMany({
      where: {
        campaignId: { in: [result1.campaign.id, result2.campaign.id] },
      },
    });
    await prisma.campaign.deleteMany({
      where: {
        id: { in: [result1.campaign.id, result2.campaign.id] },
      },
    });
    await prisma.sender.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: user.id } });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 E2E COMPOSE → SCHEDULER AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ E2E Audit execution error:', error);
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runComposeSchedulerE2ETest();
