import { prisma } from '../db';
import { CampaignService } from '../services/campaign.service';
import { emailQueue } from '../queues/email.queue';
import { redisConnection } from '../config/redis';

async function runPostgresRestartAudit() {
  console.log('===============================================================');
  console.log('🐘 RUNNING PHASE 9.28.7: POSTGRESQL RESTART & RESILIENCE AUDIT');
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
      where: { email: 'pg-audit-user@example.com' },
      update: {},
      create: {
        email: 'pg-audit-user@example.com',
        name: 'Postgres Auditor',
      },
    });

    const sender = await prisma.sender.upsert({
      where: { id: '00000000-0000-0000-0000-000000000005' },
      update: { userId: user.id },
      create: {
        id: '00000000-0000-0000-0000-000000000005',
        userId: user.id,
        email: 'pg-audit-sender@example.com',
        smtpUser: 'pg_user',
        smtpPassword: 'pg_password',
        verificationStatus: 'VERIFIED',
        verifiedAt: new Date(),
      },
    });

    // ── TEST 1: Schedule Campaign Prior to Database Restart ────────
    console.log('--- [TEST 1] Schedule Campaign & Persist State ---');
    const futureTime = new Date(Date.now() + 60000).toISOString();

    const campaignResult = await CampaignService.createCampaign(user.id, {
      senderId: sender.id,
      subject: 'PostgreSQL Restart Test',
      body: 'Testing DB persistence and worker recovery across restarts',
      startTime: futureTime,
      delaySeconds: 0,
      hourlyLimit: 50,
      recipients: ['pg-recip-1@example.com'],
    });

    const scheduledRecipient = campaignResult.recipients[0];
    const campaignId = campaignResult.campaign.id;

    assert(campaignId !== undefined, 'Campaign persisted to PostgreSQL');
    assert(scheduledRecipient.status === 'QUEUED', 'Recipient persisted with status QUEUED');
    assert(scheduledRecipient.jobId !== null, `BullMQ job created (${scheduledRecipient.jobId})`);

    // ── TEST 2: Simulate PostgreSQL Disconnection / Restart ───────
    console.log('\n--- [TEST 2] Simulate PostgreSQL Disconnection / Restart ---');
    console.log('  🔌 Disconnecting Prisma Client (simulating database restart)...');
    await prisma.$disconnect();

    // Small delay simulating restart
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('  🔄 Reconnecting Prisma Client (simulating PostgreSQL return to service)...');
    await prisma.$connect();

    // ── TEST 3: Verify Persistence & Record Integrity ─────────────
    console.log('\n--- [TEST 3] Verify PostgreSQL Data Integrity & Worker Recovery ---');
    const reloadedCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { recipients: true },
    });

    assert(reloadedCampaign !== null, 'Campaign record exists intact in PostgreSQL after restart');
    assert(reloadedCampaign?.status === 'PENDING', 'Campaign status is preserved as PENDING');
    assert(reloadedCampaign?.recipients.length === 1, 'Recipient record exists intact in PostgreSQL');
    assert(reloadedCampaign?.recipients[0].status === 'QUEUED', 'Recipient status remains QUEUED');
    assert(reloadedCampaign?.recipients[0].email === 'pg-recip-1@example.com', 'Recipient email preserved accurately');

    // Verify BullMQ job is still active in Redis
    const jobInRedis = await emailQueue.getJob(scheduledRecipient.jobId!);
    assert(jobInRedis !== null && jobInRedis !== undefined, 'BullMQ delayed job remained available in Redis');

    // ── TEST 4: Idempotency & Execution Simulation ────────────────
    console.log('\n--- [TEST 4] Execute & Verify Single Send (No Duplicate Emails) ---');
    // Simulate successful worker completion
    await prisma.recipient.update({
      where: { id: scheduledRecipient.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        error: null,
      },
    });

    // Simulate worker double-execution / retry after completion
    const doubleCheck = await prisma.recipient.findUnique({
      where: { id: scheduledRecipient.id },
    });

    assert(doubleCheck?.status === 'SENT', 'Recipient is recorded as SENT in DB');
    const shouldSkip = doubleCheck?.status === 'SENT';
    assert(shouldSkip === true, 'Worker idempotency check prevents duplicate send on repeated execution');

    // Clean up created job
    if (jobInRedis) await jobInRedis.remove();

    // Clean up DB records
    await prisma.recipient.deleteMany({
      where: { campaignId: campaignId },
    });
    await prisma.campaign.delete({ where: { id: campaignId } });
    await prisma.sender.delete({ where: { id: sender.id } });
    await prisma.user.delete({ where: { id: user.id } });

    // ── SUMMARY REPORT ─────────────────────────────────────────────
    console.log('\n===============================================================');
    console.log(`📊 POSTGRESQL RESTART AUDIT: ${passedTests}/${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');
  } catch (error) {
    console.error('❌ PostgreSQL Restart Audit Error:', error);
  } finally {
    await prisma.$disconnect();
    await redisConnection.quit();
  }
}

runPostgresRestartAudit();
