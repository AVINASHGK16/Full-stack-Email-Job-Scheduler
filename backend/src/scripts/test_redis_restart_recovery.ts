import { prisma } from '../db';
import { CampaignService } from '../services/campaign.service';
import { emailQueue } from '../queues/email.queue';
import { redisConnection } from '../config/redis';
import { RecoveryService } from '../services/recovery.service';

async function runRedisRestartRecoveryTest() {
  console.log('===============================================================');
  console.log('💾 RUNNING PHASE 9.28.6: REDIS RESTART & DATA LOSS RECOVERY AUDIT');
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
      where: { email: 'redis-recovery-user@example.com' },
      update: {},
      create: {
        email: 'redis-recovery-user@example.com',
        name: 'Redis Recovery Tester',
      },
    });

    const sender = await prisma.sender.upsert({
      where: { id: '00000000-0000-0000-0000-000000000004' },
      update: { userId: user.id },
      create: {
        id: '00000000-0000-0000-0000-000000000004',
        userId: user.id,
        email: 'redis-recovery-sender@example.com',
        smtpUser: 'redis_user',
        smtpPassword: 'redis_password',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // ── TEST 1: Schedule Campaign & Simulate Redis Data Loss ──────
    console.log('--- [TEST 1] Schedule Campaign → Delete Redis Key → Recovery Self-Healing ---');
    const futureTime = new Date(Date.now() + 60000).toISOString();

    const campaignResult = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'Redis Data Loss Recovery Test',
      body: 'Testing PostgreSQL to Redis job reconstruction',
      startTime: futureTime,
      delaySeconds: 1,
      hourlyLimit: 50,
      recipients: ['loss-recip-1@example.com', 'loss-recip-2@example.com'],
    });

    const recip1 = campaignResult.recipients[0];
    const recip2 = campaignResult.recipients[1];

    // Verify jobs exist initially
    const job1Before = await emailQueue.getJob(recip1.jobId!);
    const job2Before = await emailQueue.getJob(recip2.jobId!);
    assert(job1Before !== null && job1Before !== undefined, 'Job 1 exists in BullMQ');
    assert(job2Before !== null && job2Before !== undefined, 'Job 2 exists in BullMQ');

    // Simulate Redis eviction or unpersisted Redis restart (jobs deleted from Redis)
    console.log('  💥 Simulating Redis job deletion / unpersisted restart...');
    if (job1Before) await job1Before.remove();
    if (job2Before) await job2Before.remove();

    // Confirm jobs are now missing from Redis
    const job1Missing = await emailQueue.getJob(recip1.jobId!);
    const job2Missing = await emailQueue.getJob(recip2.jobId!);
    assert(job1Missing === null || job1Missing === undefined, 'Job 1 is confirmed missing from Redis');
    assert(job2Missing === null || job2Missing === undefined, 'Job 2 is confirmed missing from Redis');

    // ── TEST 2: Run Recovery Service ──────────────────────────────
    console.log('\n--- [TEST 2] Execute RecoveryService Self-Healing ---');
    // Set createdAt back by 35 seconds to pass PENDING_RECOVERY_THRESHOLD_MS (30s)
    await prisma.recipient.updateMany({
      where: { campaignId: campaignResult.campaign.id },
      data: { createdAt: new Date(Date.now() - 35000) },
    });

    await RecoveryService.recoverStalePendingRecipients();

    // Verify jobs have been reconstructed in BullMQ
    const job1Recovered = await emailQueue.getJob(recip1.jobId!);
    const job2Recovered = await emailQueue.getJob(recip2.jobId!);

    assert(job1Recovered !== null && job1Recovered !== undefined, 'Job 1 was RESTORED in BullMQ from PostgreSQL state');
    assert(job2Recovered !== null && job2Recovered !== undefined, 'Job 2 was RESTORED in BullMQ from PostgreSQL state');

    // Clean up created jobs
    if (job1Recovered) await job1Recovered.remove();
    if (job2Recovered) await job2Recovered.remove();

    // Clean up DB records
    await prisma.recipient.deleteMany({
      where: { campaignId: campaignResult.campaign.id },
    });
    await prisma.campaign.delete({ where: { id: campaignResult.campaign.id } });
    await prisma.sender.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: user.id } });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 REDIS RECOVERY AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ Redis Recovery Audit Error:', error);
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runRedisRestartRecoveryTest();
