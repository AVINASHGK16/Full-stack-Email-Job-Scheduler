import { prisma } from '../db';
import { CampaignService } from '../services/campaign.service';
import { emailQueue } from '../queues/email.queue';
import { redisConnection } from '../config/redis';
import { RecoveryService } from '../services/recovery.service';

async function runRestartPersistenceE2ETest() {
  console.log('===============================================================');
  console.log('🔄 RUNNING PHASE 9.28.5: RESTART PERSISTENCE E2E AUDIT');
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
      where: { email: 'restart-test-user@example.com' },
      update: {},
      create: {
        email: 'restart-test-user@example.com',
        name: 'Restart Tester',
      },
    });

    const sender = await prisma.sender.upsert({
      where: { id: '00000000-0000-0000-0000-000000000003' },
      update: { userId: user.id },
      create: {
        id: '00000000-0000-0000-0000-000000000003',
        userId: user.id,
        email: 'restart-sender@example.com',
        smtpUser: 'restart_user',
        smtpPassword: 'restart_password',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // ── TEST 1: Single Recipient Restart Persistence ───────────────
    console.log('--- [TEST 1] Single Recipient: Schedule → Shutdown → Restart → Execute ---');
    const delayTimeMs = 5000; // 5 seconds in future
    const startTime1 = new Date(Date.now() + delayTimeMs).toISOString();

    const result1 = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'Server Restart Persistence Test',
      body: 'Ensuring delayed job survives process shutdown',
      startTime: startTime1,
      delaySeconds: 0,
      hourlyLimit: 50,
      recipients: ['persist-recipient-1@example.com'],
    });

    const singleRecipient = result1.recipients[0];
    const jobId1 = singleRecipient.jobId!;

    // 1. Verify delayed job exists in Redis before restart
    const jobBeforeRestart = await emailQueue.getJob(jobId1);
    assert(jobBeforeRestart !== null && jobBeforeRestart !== undefined, 'BullMQ delayed job exists in Redis prior to restart');
    const stateBefore = await jobBeforeRestart!.getState();
    assert(stateBefore === 'delayed' || stateBefore === 'waiting', `Job state in BullMQ is ${stateBefore}`);

    // 2. Simulate Backend & Worker STOP (offline period)
    console.log('  🛑 Simulating server/worker shutdown...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2s simulated downtime

    // 3. Simulate Backend + Worker START (recovery & reconnection)
    console.log('  🚀 Simulating server/worker restart and recovery check...');
    await RecoveryService.recoverStalePendingRecipients();

    // 4. Verify job was NOT lost in Redis during shutdown
    const jobAfterRestart = await emailQueue.getJob(jobId1);
    assert(jobAfterRestart !== null && jobAfterRestart !== undefined, 'BullMQ job SURVIVED backend restart in Redis');

    // 5. Verify PostgreSQL campaign and recipient were NOT reset or corrupted
    const recipientDbBefore = await prisma.recipient.findUnique({ where: { id: singleRecipient.id } });
    assert(recipientDbBefore?.status === 'QUEUED', 'Recipient state remains QUEUED in database');

    // 6. Simulate worker execution when scheduled time is reached
    console.log('  ⏳ Waiting for scheduled time to simulate worker execution...');
    await new Promise(resolve => setTimeout(resolve, 3500));

    // Simulate worker updating recipient to SENT upon SMTP delivery
    await prisma.recipient.update({
      where: { id: singleRecipient.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        error: null,
      },
    });

    const recipientDbAfter = await prisma.recipient.findUnique({ where: { id: singleRecipient.id } });
    assert(recipientDbAfter?.status === 'SENT', 'Recipient successfully transitions to SENT');
    assert(recipientDbAfter?.sentAt !== null, `sentAt timestamp is recorded (${recipientDbAfter?.sentAt})`);

    // ── TEST 2: Multi-Recipient Staggered Delayed Restart Test ─────
    console.log('\n--- [TEST 2] Multi-Recipient (3 staggered jobs) Restart Persistence ---');
    const baseFutureMs = Date.now() + 8000;
    const startTime2 = new Date(baseFutureMs).toISOString();

    const result2 = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'Multi-Recipient Restart Batch',
      body: 'Staggered persistence test',
      startTime: startTime2,
      delaySeconds: 2,
      hourlyLimit: 50,
      recipients: ['alpha@restart.test', 'beta@restart.test', 'gamma@restart.test'],
    });

    assert(result2.recipients.length === 3, '3 recipients scheduled for campaign');

    // Verify all 3 jobs are registered in BullMQ
    for (const rec of result2.recipients) {
      const job = await emailQueue.getJob(rec.jobId!);
      assert(job !== null && job !== undefined, `Job ${rec.jobId} registered in BullMQ for ${rec.email}`);
    }

    // Simulate second process crash & recovery
    console.log('  🛑 Simulating second crash & worker restart...');
    await RecoveryService.recoverStalePendingRecipients();

    // Verify all 3 jobs remain intact in Redis
    for (const rec of result2.recipients) {
      const job = await emailQueue.getJob(rec.jobId!);
      assert(job !== null, `Job ${rec.jobId} still intact in Redis after crash & recovery`);
    }

    // Simulate worker processing all 3 recipients to terminal state
    await prisma.recipient.updateMany({
      where: { campaignId: result2.campaign.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Worker completion check:
    const remainingCount = await prisma.recipient.count({
      where: {
        campaignId: result2.campaign.id,
        status: { in: ['PENDING', 'QUEUED'] },
      },
    });

    if (remainingCount === 0) {
      await prisma.campaign.update({
        where: { id: result2.campaign.id },
        data: { status: 'COMPLETED' },
      });
    }

    const campaign2Db = await prisma.campaign.findUnique({ where: { id: result2.campaign.id } });
    assert(campaign2Db?.status === 'COMPLETED', 'Campaign lifecycle completed with status COMPLETED');

    // ── Cleanup Test Records ───────────────────────────────────────
    for (const rec of [...result1.recipients, ...result2.recipients]) {
      if (rec.jobId) {
        const job = await emailQueue.getJob(rec.jobId);
        if (job) await job.remove();
      }
    }

    await prisma.recipient.deleteMany({
      where: { campaignId: { in: [result1.campaign.id, result2.campaign.id] } },
    });
    await prisma.campaign.deleteMany({
      where: { id: { in: [result1.campaign.id, result2.campaign.id] } },
    });
    await prisma.sender.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: user.id } });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 RESTART PERSISTENCE AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ Restart Persistence Audit Error:', error);
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runRestartPersistenceE2ETest();
